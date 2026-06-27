from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone
from db.database import get_session
from db.models import UserRecord, UserApiKeyRecord, TradeRecord, PositionRecord, SignalRecord
from web.auth import decode_token
from shared.plan_limits import get_plan_limits, is_trial_expired
from shared.config_loader import ConfigLoader
from backtest.backtester import Backtester
import secrets
import hashlib
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api")

bearer_scheme = HTTPBearer(auto_error=False)


async def _get_db_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    token: str = Query(None),
    session: AsyncSession = Depends(get_session),
) -> UserRecord:
    actual_token = None
    if credentials:
        actual_token = credentials.credentials
    elif token:
        actual_token = token
    if not actual_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(actual_token)
    uid = payload.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await session.execute(select(UserRecord).where(UserRecord.id == int(uid)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/strategy-performance")
async def get_strategy_performance(
    _user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(SignalRecord.strategy_results, SignalRecord.action, SignalRecord.confidence, SignalRecord.created_at)
        .order_by(desc(SignalRecord.created_at))
        .limit(500)
    )
    rows = result.all()

    strategy_data = {}
    for row in rows:
        strategies = row.strategy_results or []
        if isinstance(strategies, list):
            for s in strategies:
                name = s.get("strategy_name", s.get("name", "unknown")) if isinstance(s, dict) else str(s)
                if name not in strategy_data:
                    strategy_data[name] = {"signals": 0, "wins": 0, "losses": 0, "total_pnl": 0.0, "avg_confidence": 0.0}
                strategy_data[name]["signals"] += 1
                strategy_data[name]["avg_confidence"] += row.confidence or 0

    result2 = await session.execute(
        select(TradeRecord.pnl).where(TradeRecord.pnl.isnot(None))
    )
    trade_pnls = result2.scalars().all()

    total_wins = sum(1 for p in trade_pnls if p > 0)
    total_losses = sum(1 for p in trade_pnls if p < 0)
    total_pnl = sum(p for p in trade_pnls if p is not None)

    for name in strategy_data:
        if strategy_data[name]["signals"] > 0:
            strategy_data[name]["avg_confidence"] = round(strategy_data[name]["avg_confidence"] / strategy_data[name]["signals"], 1)
        ratio = strategy_data[name]["signals"] / max(sum(s["signals"] for s in strategy_data.values()), 1)
        strategy_data[name]["wins"] = round(total_wins * ratio)
        strategy_data[name]["losses"] = round(total_losses * ratio)
        strategy_data[name]["total_pnl"] = round(total_pnl * ratio, 2)
        strategy_data[name]["win_rate"] = round(strategy_data[name]["wins"] / max(strategy_data[name]["wins"] + strategy_data[name]["losses"], 1) * 100, 1)

    return strategy_data


@router.get("/portfolio")
async def get_portfolio(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):

    pos_result = await session.execute(
        select(PositionRecord).where(
            PositionRecord.user_id == user.id,
            PositionRecord.status == "open"
        )
    )
    positions = pos_result.scalars().all()

    total_unrealized = sum(p.unrealized_pnl or 0 for p in positions)
    total_invested = sum((p.entry_price or 0) * (p.quantity or 0) for p in positions)

    trade_result = await session.execute(
        select(func.count(), func.coalesce(func.sum(TradeRecord.pnl), 0))
        .where(TradeRecord.user_id == user.id, TradeRecord.pnl.isnot(None))
    )
    total_trades, total_pnl = trade_result.one()

    wins = await session.execute(
        select(func.count()).where(TradeRecord.user_id == user.id, TradeRecord.pnl > 0)
    )
    total_wins = wins.scalar() or 0
    win_rate = round(total_wins / total_trades * 100, 1) if total_trades > 0 else 0.0

    pair_result = await session.execute(
        select(TradeRecord.symbol, func.count(), func.coalesce(func.sum(TradeRecord.pnl), 0))
        .where(TradeRecord.user_id == user.id)
        .group_by(TradeRecord.symbol)
        .order_by(desc(func.count()))
    )
    pairs = [{"symbol": r[0], "trades": r[1], "pnl": round(r[2], 2)} for r in pair_result.all()]

    return {
        "total_pnl": round(total_pnl, 2),
        "total_trades": total_trades,
        "win_rate": win_rate,
        "open_positions": len(positions),
        "total_unrealized_pnl": round(total_unrealized, 2),
        "total_invested": round(total_invested, 2),
        "pair_breakdown": pairs,
    }


@router.get("/trades/export")
async def export_trades_csv(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(TradeRecord).where(TradeRecord.user_id == user.id).order_by(desc(TradeRecord.created_at)).limit(1000)
    )
    trades = result.scalars().all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Symbol", "Side", "Price", "Quantity", "Total", "Fee", "PNL", "Mode", "Date"])
    for t in trades:
        writer.writerow([t.id, t.symbol, t.side.value, t.price, t.quantity, t.total, t.fee, t.pnl, t.mode.value, t.created_at.isoformat()])

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=trades.csv"})


@router.get("/positions/export")
async def export_positions_csv(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(PositionRecord).where(PositionRecord.user_id == user.id).order_by(desc(PositionRecord.opened_at)).limit(1000)
    )
    positions = result.scalars().all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Symbol", "Side", "Entry", "Current", "Qty", "Unrealized PnL", "Realized PnL", "Status", "Opened", "Closed"])
    for p in positions:
        writer.writerow([p.id, p.symbol, p.side.value, p.entry_price, p.current_price, p.quantity, p.unrealized_pnl, p.realized_pnl, p.status.value, p.opened_at.isoformat(), p.closed_at.isoformat() if p.closed_at else ""])

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=positions.csv"})


@router.get("/user/data-export")
async def export_user_data(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    trades = await session.execute(select(TradeRecord).where(TradeRecord.user_id == user.id))
    positions = await session.execute(select(PositionRecord).where(PositionRecord.user_id == user.id))
    signals = await session.execute(select(SignalRecord).where(SignalRecord.user_id == user.id))

    return {
        "user": {
            "email": user.email,
            "plan": user.plan.value if hasattr(user.plan, 'value') else user.plan,
            "mode": user.mode.value if hasattr(user.mode, 'value') else user.mode,
            "created_at": user.created_at.isoformat(),
            "wallet_address": user.wallet_address,
            "bot_active": user.bot_active,
            "usage_api_calls": user.usage_api_calls,
            "usage_bot_hours": user.usage_bot_hours,
            "usage_trade_volume": user.usage_trade_volume,
        },
        "trades": [{"id": t.id, "symbol": t.symbol, "side": t.side.value, "price": t.price, "pnl": t.pnl, "created_at": t.created_at.isoformat()} for t in trades.scalars().all()],
        "positions": [{"id": p.id, "symbol": p.symbol, "side": p.side.value, "entry_price": p.entry_price, "status": p.status.value} for p in positions.scalars().all()],
        "signals_count": len(signals.scalars().all()),
    }


@router.delete("/user/data-delete")
async def delete_user_data(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):

    user.bot_active = False
    try:
        from shared.redis_client import RedisClient
        rc = RedisClient()
        await rc.connect()
        await rc.publish("bot:control", {"user_id": user.id, "action": "stop"})
        await rc.disconnect()
    except Exception:
        pass

    await session.execute(TradeRecord.__table__.delete().where(TradeRecord.user_id == user.id))
    await session.execute(PositionRecord.__table__.delete().where(PositionRecord.user_id == user.id))
    await session.execute(SignalRecord.__table__.delete().where(SignalRecord.user_id == user.id))
    await session.execute(UserApiKeyRecord.__table__.delete().where(UserApiKeyRecord.user_id == user.id))

    user.email = f"deleted-{user.id}@anon"
    user.password_hash = "DELETED"
    user.mexc_api_key = None
    user.mexc_api_secret = None
    user.wallet_address = None

    await session.commit()
    return {"detail": "All personal data deleted. Account anonymized."}


@router.get("/user/strategy-config")
async def get_strategy_config(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    return {"strategy_settings": user.strategy_settings or {}}


@router.put("/user/strategy-config")
async def update_strategy_config(
    data: dict,
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    user.strategy_settings = data.get("strategy_settings", {})
    await session.commit()
    return {"success": True}


@router.get("/user/notification-prefs")
async def get_notification_prefs(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    return {"notification_prefs": user.notification_prefs or {"email": True, "telegram": False, "push": False}}


@router.put("/user/notification-prefs")
async def update_notification_prefs(
    data: dict,
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    user.notification_prefs = data.get("notification_prefs", {})
    await session.commit()
    return {"success": True}


@router.get("/user/selected-pairs")
async def get_selected_pairs(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    return {"selected_pairs": user.selected_pairs or ["BTC/USDT", "ETH/USDT", "SOL/USDT"]}


@router.put("/user/selected-pairs")
async def update_selected_pairs(
    data: dict,
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    pairs = data.get("selected_pairs", [])
    limits = get_plan_limits(user.plan.value if hasattr(user.plan, 'value') else "basic")
    max_pairs = limits.get("max_pairs", 3)
    if len(pairs) > max_pairs:
        raise HTTPException(status_code=400, detail=f"Plan limit: max {max_pairs} pairs")
    user.selected_pairs = pairs
    await session.commit()
    return {"success": True, "selected_pairs": pairs}


def _generate_api_key() -> tuple[str, str, str]:
    raw = f"nt_{secrets.token_hex(24)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    prefix = raw[:10]
    return raw, key_hash, prefix


@router.post("/user/api-keys")
async def create_api_key(
    data: dict,
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    name = data.get("name", "Default")
    raw, key_hash, prefix = _generate_api_key()

    record = UserApiKeyRecord(
        user_id=user.id,
        key_prefix=prefix,
        key_hash=key_hash,
        name=name,
    )
    session.add(record)
    await session.commit()

    return {"success": True, "api_key": raw, "key_prefix": prefix, "name": name}


@router.get("/user/api-keys")
async def list_api_keys(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserApiKeyRecord).where(UserApiKeyRecord.user_id == user.id, UserApiKeyRecord.is_active == True)
    )
    keys = result.scalars().all()
    return {"api_keys": [{"id": k.id, "key_prefix": k.key_prefix, "name": k.name, "is_active": k.is_active, "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None, "created_at": k.created_at.isoformat()} for k in keys]}


@router.delete("/user/api-keys/{key_id}")
async def revoke_api_key(
    key_id: int,
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserApiKeyRecord).where(UserApiKeyRecord.id == key_id, UserApiKeyRecord.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    await session.commit()
    return {"success": True}


@router.get("/admin/analytics")
async def get_admin_analytics(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    total = await session.execute(select(func.count(UserRecord.id)))
    total_users = total.scalar() or 0

    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    monthly = await session.execute(
        select(func.count(UserRecord.id)).where(UserRecord.created_at >= month_ago)
    )
    monthly_users = monthly.scalar() or 0

    active = await session.execute(
        select(func.count(UserRecord.id)).where(UserRecord.bot_active == True)
    )
    active_bots = active.scalar() or 0

    basic = await session.execute(select(func.count(UserRecord.id)).where(UserRecord.plan == "basic"))
    pro = await session.execute(select(func.count(UserRecord.id)).where(UserRecord.plan == "pro"))
    enterprise = await session.execute(select(func.count(UserRecord.id)).where(UserRecord.plan == "enterprise"))
    plan_breakdown = {"basic": basic.scalar() or 0, "pro": pro.scalar() or 0, "enterprise": enterprise.scalar() or 0}

    growth = []
    for i in range(6):
        start = datetime.now(timezone.utc) - timedelta(days=30 * (i + 1))
        end = datetime.now(timezone.utc) - timedelta(days=30 * i)
        count = await session.execute(
            select(func.count(UserRecord.id)).where(
                UserRecord.created_at >= start,
                UserRecord.created_at < end
            )
        )
        growth.append({
            "month": start.strftime("%b %Y"),
            "new_users": count.scalar() or 0,
        })
    growth.reverse()

    total_trades = await session.execute(select(func.count(TradeRecord.id)))
    total_trades_val = total_trades.scalar() or 0

    total_pnl = await session.execute(select(func.coalesce(func.sum(TradeRecord.pnl), 0)))
    total_pnl_val = round(total_pnl.scalar() or 0, 2)

    return {
        "total_users": total_users,
        "monthly_users": monthly_users,
        "active_bots": active_bots,
        "total_trades": total_trades_val,
        "total_pnl": total_pnl_val,
        "plan_breakdown": plan_breakdown,
        "user_growth": growth,
    }


@router.get("/user/trial-status")
async def get_trial_status(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    now = datetime.now(timezone.utc)
    expired = is_trial_expired(user)

    if user.trial_end:
        remaining = (user.trial_end.replace(tzinfo=timezone.utc) - now).total_seconds()
        remaining_days = max(0, int(remaining / 86400))
    else:
        remaining_days = 14

    return {
        "trial_end": user.trial_end.isoformat() if user.trial_end else None,
        "is_expired": expired,
        "remaining_days": remaining_days,
        "plan": user.plan.value if hasattr(user.plan, 'value') else user.plan,
    }


@router.post("/backtest")
async def run_backtest(
    data: dict,
    _user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    pair = data.get("pair", "BTC/USDT")
    strategy = data.get("strategy", "rsi")
    days = data.get("days", 30)

    timeframe_map = {"15m": "15m", "1h": "60m", "4h": "1h"}
    period_map = {7: "5d", 14: "14d", 30: "1mo", 60: "2mo", 90: "3mo"}
    timeframe = timeframe_map.get(strategy, "1h")
    period = period_map.get(days, "3mo")

    try:
        config_loader = ConfigLoader()
        settings = config_loader.load_settings()
        strategies_config = config_loader.load_strategies()
    except Exception:
        settings = {"analyst": {}}
        strategies_config = {}

    bt = Backtester(settings, strategies_config)
    try:
        result = await bt.run(
            symbol=pair,
            timeframe=timeframe,
            period=period,
            initial_balance=10000.0,
        )
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {str(e)}")


@router.get("/user/usage")
async def get_usage_stats(
    user: UserRecord = Depends(_get_db_user),
    session: AsyncSession = Depends(get_session),
):
    return {
        "api_calls": user.usage_api_calls or 0,
        "bot_hours": user.usage_bot_hours or 0,
        "trade_volume": user.usage_trade_volume or 0,
    }
