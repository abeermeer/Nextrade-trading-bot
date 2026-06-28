from datetime import datetime, timezone
from typing import Optional
from shared.models import Position, OrderSide, OrderStatus
from shared.logger import get_logger

logger = get_logger(__name__)


class PositionTracker:
    def __init__(self):
        self._positions: dict[str, Position] = {}
        self._closed: list[Position] = []
        self._total_realized_pnl = 0.0

    def open_position(
        self,
        symbol: str,
        side: OrderSide,
        entry_price: float,
        quantity: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> Position:
        pos = Position(
            id=f"pos_{symbol}_{datetime.now(timezone.utc).timestamp()}",
            symbol=symbol,
            side=side,
            entry_price=entry_price,
            current_price=entry_price,
            quantity=quantity,
            unrealized_pnl=0.0,
            stop_loss=stop_loss,
            take_profit=take_profit,
            opened_at=datetime.now(timezone.utc),
        )
        self._positions[symbol] = pos
        logger.info(
            "position_opened",
            symbol=symbol,
            side=side.value,
            price=entry_price,
            qty=quantity,
        )
        return pos

    def update_price(self, symbol: str, current_price: float) -> Optional[Position]:
        pos = self._positions.get(symbol)
        if not pos:
            return None
        pos.current_price = current_price
        if pos.side == OrderSide.BUY:
            pos.unrealized_pnl = (current_price - pos.entry_price) * pos.quantity
        else:
            pos.unrealized_pnl = (pos.entry_price - current_price) * pos.quantity
        return pos

    def close_position(
        self, symbol: str, exit_price: float, reason: str = "signal"
    ) -> Optional[Position]:
        pos = self._positions.pop(symbol, None)
        if not pos:
            return None

        if pos.side == OrderSide.BUY:
            realized = (exit_price - pos.entry_price) * pos.quantity
        else:
            realized = (pos.entry_price - exit_price) * pos.quantity

        pos.realized_pnl = realized
        pos.current_price = exit_price
        pos.unrealized_pnl = 0.0
        pos.status = OrderStatus.FILLED
        pos.closed_at = datetime.now(timezone.utc)

        self._closed.append(pos)
        self._total_realized_pnl += realized

        logger.info(
            "position_closed",
            symbol=symbol,
            entry=pos.entry_price,
            exit=exit_price,
            pnl=round(realized, 2),
            reason=reason,
        )
        return pos

    def get_open_position(self, symbol: str) -> Optional[Position]:
        return self._positions.get(symbol)

    def get_all_open_positions(self) -> list[Position]:
        return list(self._positions.values())

    def get_all_open_symbols(self) -> set[str]:
        return set(self._positions.keys())

    def get_closed_positions(self, limit: int = 50) -> list[Position]:
        return self._closed[-limit:]

    def get_total_unrealized_pnl(self) -> float:
        return sum(p.unrealized_pnl for p in self._positions.values())

    def get_total_realized_pnl(self) -> float:
        return self._total_realized_pnl

    def has_position(self, symbol: str) -> bool:
        return symbol in self._positions

    def position_count(self) -> int:
        return len(self._positions)
