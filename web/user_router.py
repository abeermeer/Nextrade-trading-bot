from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from db.models import UserRecord, BotModeDB, TradeTypeDB
from web.auth import get_current_user, get_admin_user
from shared.encryption import encrypt
from shared.plan_limits import get_plan_limits, enforce_plan_limit
from shared.redis_client import create_redis_client
from shared.wallet import verify_wallet_signature
from trader.exchange.factory import create_exchange

router = APIRouter(prefix="/api/user")


class ExchangeKeysRequest(BaseModel):
    api_key: str
    api_secret: str
    exchange: str = "mexc"


class UserSettingsRequest(BaseModel):
    mode: str = "paper"
    trade_type: str = "spot"
    max_position_usdt: float = 500.0


class BotActionRequest(BaseModel):
    action: str  # "start" | "stop"


class RegisterRequest(BaseModel):
    email: str
    password: str
    plan: str = "basic"


class LoginRequest(BaseModel):
    email: str
    password: str


@router.put("/exchange-keys")
async def update_exchange_keys(
    data: ExchangeKeysRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    exchange_name = data.exchange.lower()
    client = create_exchange(api_key=data.api_key, api_secret=data.api_secret, exchange_name=exchange_name, use_sandbox=False)
    try:
        validation = await client.validate_credentials()
        await client.close()
    except Exception as e:
        await client.close()
        raise HTTPException(status_code=503, detail=f"Cannot validate {exchange_name} keys: {str(e)}")

    if not validation["spot_ok"] and not validation["futures_ok"]:
        ex_domains = {"mexc": "mexc.com", "binance": "binance.com", "bybit": "bybit.com"}
        domain = ex_domains.get(exchange_name, f"{exchange_name}.com")
        raise HTTPException(
            status_code=400,
            detail=f"{exchange_name.upper()} API key verification failed. Check your key and secret at {domain}. "
                   "Ensure Spot & Margin Trading and Read-only permissions are enabled."
        )

    from db.models import ExchangeDB
    user.exchange = ExchangeDB(exchange_name)
    user.mexc_api_key = encrypt(data.api_key)
    user.mexc_api_secret = encrypt(data.api_secret)
    user.mexc_keys_verified = True
    await session.commit()
    return {
        "success": True,
        "exchange": exchange_name,
        "keys_verified": True,
        "spot_ok": validation["spot_ok"],
        "futures_ok": validation["futures_ok"],
        "message": f"{exchange_name.upper()} API keys saved and verified",
    }


@router.put("/settings")
async def update_settings(
    data: UserSettingsRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    limits = get_plan_limits(user.plan.value)
    if data.trade_type == "futures" and limits.get("spot_only", False):
        raise HTTPException(status_code=400, detail=f"Futures trading not available on {user.plan.value} plan")
    ok, msg = enforce_plan_limit(user.plan.value, "max_position_usdt", data.max_position_usdt)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    if data.mode in ("paper", "live"):
        user.mode = BotModeDB(data.mode)
    if data.trade_type in ("spot", "futures"):
        user.trade_type = TradeTypeDB(data.trade_type)
    user.max_position_usdt = data.max_position_usdt
    await session.commit()
    return {"success": True, "mode": user.mode.value, "trade_type": user.trade_type.value}


@router.post("/bot")
async def control_bot(
    data: BotActionRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if data.action == "start":
        exchange_name = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")
        if user.mode == BotModeDB.live:
            if not user.mexc_api_key or not user.mexc_api_secret:
                raise HTTPException(status_code=400, detail=f"Set {exchange_name.upper()} API keys first")
            if not user.mexc_keys_verified:
                raise HTTPException(status_code=400, detail=f"Cannot start bot in live mode: {exchange_name.upper()} API keys are not verified. Go to Settings and re-save your keys.")
        user.bot_active = True
    elif data.action == "stop":
        user.bot_active = False
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    await session.commit()
    try:
        rc = create_redis_client()
        await rc.connect()
        await rc.publish("bot:control", {"user_id": user.id, "action": data.action})
        await rc.disconnect()
    except Exception:
        pass
    return {"success": True, "bot_active": user.bot_active}


@router.get("/bot/status")
async def bot_status(user: UserRecord = Depends(get_current_user)):
    exchange_name = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")
    return {
        "bot_active": user.bot_active,
        "mode": user.mode.value,
        "trade_type": user.trade_type.value,
        "exchange": exchange_name,
        "has_api_keys": bool(user.mexc_api_key and user.mexc_api_secret),
        "plan": user.plan.value,
        "max_position_usdt": user.max_position_usdt,
    }


# Wallet endpoints
@router.get("/wallet")
async def get_wallet(user: UserRecord = Depends(get_current_user)):
    return {
        "wallet_address": user.wallet_address or "",
        "wallet_type": user.wallet_type or "",
        "has_wallet": bool(user.wallet_address),
    }


class WalletConnectRequest(BaseModel):
    address: str
    signature: str
    message: str
    wallet_type: str = "evm"


@router.put("/wallet")
async def save_wallet(
    data: WalletConnectRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    valid = verify_wallet_signature(data.message, data.signature, data.address, data.wallet_type)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid signature")

    from sqlalchemy import select
    wallet_exists = await session.execute(
        select(UserRecord).where(UserRecord.wallet_address == data.address.lower())
    )
    existing = wallet_exists.scalar_one_or_none()
    if existing and existing.id != user.id:
        raise HTTPException(status_code=400, detail="Wallet already linked to another account")

    user.wallet_address = data.address.lower()
    user.wallet_type = data.wallet_type
    await session.commit()
    return {"success": True, "wallet_address": user.wallet_address, "wallet_type": user.wallet_type}


@router.delete("/wallet")
async def delete_wallet(
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user.wallet_address = None
    user.wallet_type = None
    await session.commit()
    return {"success": True, "message": "Wallet disconnected"}


# Admin endpoints
@router.get("/admin/users")
async def list_users(
    admin: UserRecord = Depends(get_admin_user),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    result = await session.execute(select(UserRecord))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "plan": u.plan.value,
            "mode": u.mode.value,
            "trade_type": u.trade_type.value,
            "exchange": u.exchange.value if hasattr(u.exchange, 'value') else (u.exchange or "mexc"),
            "bot_active": u.bot_active,
            "is_admin": u.is_admin,
            "has_api_keys": bool(u.mexc_api_key and u.mexc_api_secret),
            "max_position_usdt": u.max_position_usdt,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "wallet_address": u.wallet_address or "",
            "wallet_type": u.wallet_type or "",
        }
        for u in users
    ]
