from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from typing import Optional
from shared.models import OrderSide, OrderType, OrderStatus
from shared.logger import get_logger

logger = get_logger(__name__)


class PaperOrder:
    def __init__(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ):
        self.id = f"paper_{datetime.now(timezone.utc).timestamp()}_{id(self)}"
        self.symbol = symbol
        self.side = side
        self.order_type = order_type
        self.quantity = quantity
        self.price = price
        self.stop_loss = stop_loss
        self.take_profit = take_profit
        self.filled_quantity = 0.0
        self.average_fill_price = 0.0
        self.status = OrderStatus.PENDING
        self.created_at = datetime.now(timezone.utc)
        self.filled_at: Optional[datetime] = None
        self.fee = 0.0


class PaperEngine:
    def __init__(self, initial_balance_usdt: float = 10000.0, fee_rate: float = 0.001):
        self.balance = initial_balance_usdt
        self.fee_rate = fee_rate
        self.orders: list[PaperOrder] = []
        self.positions: dict[str, PaperOrder] = {}
        self.closed_positions: list[PaperOrder] = []

    async def create_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> PaperOrder:
        order = PaperOrder(
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
        )

        if order_type == OrderType.MARKET:
            await self._fill_market(order, price)
        else:
            order.status = OrderStatus.OPEN

        self.orders.append(order)
        return order

    async def _fill_market(self, order: PaperOrder, current_price: float) -> None:
        fill_price = current_price
        cost = order.quantity * fill_price
        fee = cost * self.fee_rate

        if cost + fee > self.balance and order.side == OrderSide.BUY:
            max_qty = (self.balance / (fill_price * (1 + self.fee_rate)))
            max_qty = float(Decimal(str(max_qty)).quantize(Decimal("0.00001"), rounding=ROUND_DOWN))
            if max_qty <= 0:
                order.status = OrderStatus.REJECTED
                logger.warning("paper_insufficient_balance", symbol=order.symbol)
                return
            order.quantity = max_qty
            cost = order.quantity * fill_price
            fee = cost * self.fee_rate

        order.average_fill_price = fill_price
        order.filled_quantity = order.quantity
        order.fee = fee
        order.filled_at = datetime.now(timezone.utc)
        order.status = OrderStatus.FILLED

        if order.side == OrderSide.BUY:
            self.balance -= (cost + fee)
            self.positions[order.symbol] = order
        else:
            self.balance += (cost - fee)
            if order.symbol in self.positions:
                entry = self.positions.pop(order.symbol)
                pnl = (fill_price - entry.average_fill_price) * order.quantity - entry.fee - fee
                order.average_fill_price = fill_price
                self.closed_positions.append(order)
                logger.info(
                    "paper_position_closed",
                    symbol=order.symbol,
                    pnl=round(pnl, 2),
                    balance=round(self.balance, 2),
                )

        logger.info(
            "paper_order_filled",
            symbol=order.symbol,
            side=order.side.value,
            qty=order.quantity,
            price=fill_price,
            balance=round(self.balance, 2),
        )

    async def update_price(self, symbol: str, price: float) -> Optional[str]:
        pos = self.positions.get(symbol)
        if not pos:
            return None

        if pos.stop_loss and price <= pos.stop_loss:
            logger.info("paper_stop_loss_triggered", symbol=symbol, price=price)
            await self._fill_market(
                PaperOrder(
                    symbol=symbol,
                    side=OrderSide.SELL,
                    order_type=OrderType.MARKET,
                    quantity=pos.quantity,
                    price=price,
                ),
                price,
            )
            return symbol
        elif pos.take_profit and price >= pos.take_profit:
            logger.info("paper_take_profit_triggered", symbol=symbol, price=price)
            await self._fill_market(
                PaperOrder(
                    symbol=symbol,
                    side=OrderSide.SELL,
                    order_type=OrderType.MARKET,
                    quantity=pos.quantity,
                    price=price,
                ),
                price,
            )
            return symbol
        return None

    def get_unrealized_pnl(self, symbol: str, current_price: float) -> float:
        pos = self.positions.get(symbol)
        if not pos:
            return 0.0
        return (current_price - pos.average_fill_price) * pos.quantity

    def get_total_equity(self, market_prices: dict[str, float] | None = None) -> float:
        if not market_prices:
            return self.balance
        total = self.balance
        for symbol, pos in self.positions.items():
            price = market_prices.get(symbol)
            if price:
                total += pos.quantity * price
        return total
