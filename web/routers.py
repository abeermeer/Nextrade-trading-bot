import json
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session
from db.models import SignalRecord, PositionRecord, TradeRecord, SignalActionDB, OrderSideDB, OrderStatusDB, BotModeDB
from shared.models import Signal, Position, BotMode
from shared.redis_client import create_redis_client
from shared.config_loader import ConfigLoader

router = APIRouter(prefix="/api")


async def _get_redis():
    rc = create_redis_client()
    await rc.connect()
    return rc


def _get_bot_mode() -> str:
    try:
        cl = ConfigLoader()
        settings = cl.load_settings()
        return settings.get("bot", {}).get("mode", "paper")
    except Exception:
        return "paper"


# --- Status ---
@router.get("/status")
async def get_status():
    analyst_alive = False
    trader_alive = False
    now = datetime.now(timezone.utc)
    try:
        rc = await _get_redis()

        recent = await rc.lrange("signals:recent", 0, 0)
        if recent:
            data = json.loads(recent[0])
            ts = datetime.fromisoformat(data.get("timestamp", ""))
            if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 300:
                analyst_alive = True

        heartbeat = await rc.lrange("heartbeat:analyst", 0, 0)
        if heartbeat:
            ts = datetime.fromisoformat(json.loads(heartbeat[0]).get("timestamp", ""))
            if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 120:
                analyst_alive = True

        trader_hb = await rc.lrange("heartbeat:trader", 0, 0)
        if trader_hb:
            ts = datetime.fromisoformat(json.loads(trader_hb[0]).get("timestamp", ""))
            if (now - ts.replace(tzinfo=timezone.utc)).total_seconds() < 120:
                trader_alive = True

        await rc.disconnect()
    except Exception:
        pass

    mode = _get_bot_mode()

    return {
        "mode": mode,
        "analyst_alive": analyst_alive,
        "trader_alive": trader_alive,
        "uptime_seconds": 0,
    }


# --- Stats ---
@router.get("/stats")
async def get_stats(session: AsyncSession = Depends(get_session)):
    from db.models import UserRecord

    total = await session.execute(select(func.count(UserRecord.id)))
    total_users = total.scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    this_week = await session.execute(
        select(func.count(UserRecord.id)).where(UserRecord.created_at >= week_ago)
    )
    weekly_users = this_week.scalar() or 0

    trades = await session.execute(select(func.count(TradeRecord.id)))
    total_trades = trades.scalar() or 0

    closed_result = await session.execute(
        select(func.count(), func.coalesce(func.sum(TradeRecord.pnl), 0))
        .where(TradeRecord.pnl.isnot(None))
    )
    total_closed, total_pnl = closed_result.one()
    wins_result = await session.execute(
        select(func.count()).where(TradeRecord.pnl > 0)
    )
    wins = wins_result.scalar() or 0
    win_rate = round(wins / total_closed * 100, 1) if total_closed > 0 else 0.0

    return {
        "total_users": total_users,
        "weekly_users": weekly_users,
        "total_trades": total_trades,
        "win_rate": win_rate,
    }


# --- Signals ---
@router.get("/signals")
async def get_signals(
    limit: int = Query(50, le=200),
):
    try:
        rc = await _get_redis()
        raw = await rc.lrange("signals:recent", 0, limit - 1)
        await rc.disconnect()
        signals = []
        for item in raw:
            data = json.loads(item)
            signals.append({
                "symbol": data.get("symbol"),
                "action": data.get("action"),
                "confidence": data.get("confidence"),
                "price": data.get("price"),
                "timestamp": data.get("timestamp"),
                "timeframe": data.get("timeframe"),
                "strategy_results": data.get("strategy_results", []),
            })
        return signals
    except Exception:
        return []


# --- Positions ---
@router.get("/positions")
async def get_positions(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PositionRecord).where(PositionRecord.status == OrderStatusDB.open)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "symbol": r.symbol,
            "side": r.side.value,
            "entry_price": r.entry_price,
            "current_price": r.current_price,
            "quantity": r.quantity,
            "unrealized_pnl": r.unrealized_pnl,
            "realized_pnl": r.realized_pnl,
            "stop_loss": r.stop_loss,
            "take_profit": r.take_profit,
            "opened_at": r.opened_at.isoformat(),
            "closed_at": r.closed_at.isoformat() if r.closed_at else None,
            "status": r.status.value,
        }
        for r in rows
    ]


# --- Trades ---
@router.get("/trades")
async def get_trades(
    limit: int = Query(100, le=500),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(TradeRecord).order_by(desc(TradeRecord.created_at)).limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "symbol": r.symbol,
            "side": r.side.value,
            "price": r.price,
            "quantity": r.quantity,
            "total": r.total,
            "fee": r.fee,
            "timestamp": r.created_at.isoformat(),
        }
        for r in rows
    ]


# --- Performance ---
@router.get("/performance")
async def get_performance(session: AsyncSession = Depends(get_session)):
    closed_result = await session.execute(
        select(func.count(), func.coalesce(func.sum(TradeRecord.pnl), 0))
        .where(TradeRecord.pnl.isnot(None))
    )
    total_trades, total_pnl = closed_result.one()

    wins_result = await session.execute(
        select(func.count()).where(TradeRecord.pnl > 0)
    )
    wins = wins_result.scalar() or 0

    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0.0

    equity_result = await session.execute(
        select(TradeRecord.created_at, TradeRecord.pnl)
        .where(TradeRecord.pnl.isnot(None))
        .order_by(TradeRecord.created_at)
    )
    equity_rows = equity_result.all()

    running_total = 10000.0
    equity_curve = []
    for row in equity_rows:
        running_total += (row.pnl or 0)
        equity_curve.append({
            "date": row.created_at.isoformat(),
            "value": round(running_total, 2),
        })

    return {
        "total_pnl": round(total_pnl, 2),
        "win_rate": round(win_rate, 1),
        "total_trades": total_trades,
        "equity_curve": equity_curve,
    }


# --- Bot Logs ---
@router.get("/logs")
async def get_bot_logs(limit: int = Query(50, le=200)):
    try:
        rc = await _get_redis()
        raw = await rc.lrange("logs:bot", 0, limit - 1)
        await rc.disconnect()
        logs = []
        for item in raw:
            try:
                data = json.loads(item)
            except Exception:
                data = {"message": item}
            logs.append(data)
        return logs
    except Exception:
        return []


# --- Settings ---
@router.get("/settings")
async def get_settings():
    from shared.config_loader import ConfigLoader
    cl = ConfigLoader()
    return {
        "settings": cl.load_settings(),
        "strategies": cl.load_strategies(),
    }


@router.put("/settings")
async def update_settings(data: dict):
    return {"success": True, "message": "Settings update not implemented yet"}


# --- Manual Override ---
@router.post("/override")
async def manual_override(data: dict):
    action = data.get("action")
    symbol = data.get("symbol", "")
    if action not in ("buy", "sell", "close_all", "emergency_stop"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
    return {"success": True, "action": action, "symbol": symbol}
