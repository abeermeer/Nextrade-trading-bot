from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from cryptography.fernet import Fernet
import os
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from db.models import UserRecord, BotModeDB, TradeTypeDB
from web.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/user")

_CIPHER = None


def _get_cipher():
    global _CIPHER
    if _CIPHER is None:
        key = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
        if isinstance(key, str):
            key = key.encode()
        if len(key) != 44:
            key = Fernet.generate_key()
        _CIPHER = Fernet(key)
    return _CIPHER


def encrypt(val: str) -> str:
    return _get_cipher().encrypt(val.encode()).decode()


def decrypt(val: str) -> str:
    return _get_cipher().decrypt(val.encode()).decode()


class MexcKeysRequest(BaseModel):
    api_key: str
    api_secret: str


class UserSettingsRequest(BaseModel):
    mode: str = "paper"
    trade_type: str = "spot"
    max_position_usdt: float = 500.0


class BotActionRequest(BaseModel):
    action: str  # "start" | "stop"


@router.put("/mexc-keys")
async def update_mexc_keys(
    data: MexcKeysRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    user.mexc_api_key = encrypt(data.api_key)
    user.mexc_api_secret = encrypt(data.api_secret)
    await session.commit()
    return {"success": True, "message": "MEXC API keys saved"}


@router.get("/mexc-keys")
async def get_mexc_keys(user: UserRecord = Depends(get_current_user)):
    if not user.mexc_api_key:
        return {"api_key": "", "api_secret": "", "has_keys": False}
    return {
        "api_key": decrypt(user.mexc_api_key),
        "api_secret": decrypt(user.mexc_api_secret),
        "has_keys": True,
    }


@router.put("/settings")
async def update_settings(
    data: UserSettingsRequest,
    user: UserRecord = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
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
        if not user.mexc_api_key or not user.mexc_api_secret:
            raise HTTPException(status_code=400, detail="Set MEXC API keys first")
        user.bot_active = True
    elif data.action == "stop":
        user.bot_active = False
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    await session.commit()
    return {"success": True, "bot_active": user.bot_active}


@router.get("/bot/status")
async def bot_status(user: UserRecord = Depends(get_current_user)):
    return {
        "bot_active": user.bot_active,
        "mode": user.mode.value,
        "trade_type": user.trade_type.value,
        "has_mexc_keys": bool(user.mexc_api_key and user.mexc_api_secret),
        "plan": user.plan.value,
        "max_position_usdt": user.max_position_usdt,
    }


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
            "bot_active": u.bot_active,
            "is_admin": u.is_admin,
            "has_mexc_keys": bool(u.mexc_api_key and u.mexc_api_secret),
            "max_position_usdt": u.max_position_usdt,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]
