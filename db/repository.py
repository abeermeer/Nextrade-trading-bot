from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import async_session_factory
from db.models import SignalRecord, PositionRecord, TradeRecord, SignalActionDB, OrderSideDB, OrderStatusDB, BotModeDB
from shared.models import Signal, Position, BotMode

_signal_counter = 0
SIGNAL_RETENTION = 2000  # keep the signals table small so DB queries (and login) stay fast


async def reset_demo_data() -> dict:
    """Clear DEMO results only: all paper trades + paper positions, plus the signals
    table (ephemeral, regenerates). LIVE trades/positions are kept."""
    async with async_session_factory() as session:
        t = await session.execute(delete(TradeRecord).where(TradeRecord.mode == BotModeDB.paper))
        p = await session.execute(delete(PositionRecord).where(PositionRecord.mode == BotModeDB.paper))
        s = await session.execute(delete(SignalRecord))
        await session.commit()
        return {
            "trades_deleted": t.rowcount or 0,
            "positions_deleted": p.rowcount or 0,
            "signals_deleted": s.rowcount or 0,
        }


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if hasattr(obj, "item"):  # numpy scalars
        return obj.item()
    return obj


async def save_signal(signal: Signal, timeframe: Optional[str] = None) -> None:
    global _signal_counter
    async with async_session_factory() as session:
        record = SignalRecord(
            symbol=signal.symbol,
            action=SignalActionDB(signal.action.value),
            confidence=signal.confidence,
            price=signal.price,
            timeframe=timeframe,
            strategy_results=[_json_safe(r.model_dump(mode="json")) for r in signal.strategy_results],
            signal_metadata=_json_safe(signal.metadata),
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        session.add(record)
        await session.commit()
        # Cap the signals table so it never bloats the DB (unbounded inserts otherwise
        # slow every query, including login). Trim occasionally, not every insert.
        _signal_counter += 1
        if _signal_counter % 25 == 0:
            try:
                await session.execute(
                    text(
                        "DELETE FROM signals WHERE id NOT IN "
                        "(SELECT id FROM signals ORDER BY created_at DESC LIMIT :keep)"
                    ),
                    {"keep": SIGNAL_RETENTION},
                )
                await session.commit()
            except Exception:
                pass


async def save_trade(
    symbol: str,
    side: str,
    price: float,
    quantity: float,
    fee: float = 0.0,
    pnl: Optional[float] = None,
    mode: str = "paper",
    user_id: Optional[int] = None,
    exchange_order_id: Optional[str] = None,
) -> None:
    async with async_session_factory() as session:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        record = TradeRecord(
            user_id=user_id,
            symbol=symbol,
            side=OrderSideDB(side),
            price=price,
            quantity=quantity,
            total=price * quantity,
            fee=fee,
            pnl=pnl,
            mode=BotModeDB(mode),
            exchange_order_id=exchange_order_id,
            created_at=now,
        )
        session.add(record)
        await session.commit()


def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=None)


async def save_position(position: Position, mode: str = "paper", user_id: Optional[int] = None) -> None:
    async with async_session_factory() as session:
        record = PositionRecord(
            user_id=user_id,
            symbol=position.symbol,
            side=OrderSideDB(position.side.value),
            entry_price=position.entry_price,
            current_price=position.current_price,
            quantity=position.quantity,
            unrealized_pnl=position.unrealized_pnl,
            realized_pnl=position.realized_pnl,
            stop_loss=position.stop_loss,
            take_profit=position.take_profit,
            status=OrderStatusDB(position.status.value),
            mode=BotModeDB(mode),
            opened_at=_naive(position.opened_at),
            closed_at=_naive(position.closed_at),
        )
        session.add(record)
        await session.commit()
