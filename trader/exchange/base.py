from abc import ABC, abstractmethod
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Optional
from shared.models import OrderSide, OrderType
from shared.rate_limiter import RateLimiter


class BaseExchangeClient(ABC):
    rate_limiter: RateLimiter
    _markets_loaded: bool = False

    @abstractmethod
    async def load_markets(self) -> None:
        ...

    @abstractmethod
    async def _get_market(self, symbol: str, market_type: str) -> Optional[dict]:
        ...

    async def _ensure_markets_loaded(self) -> None:
        if not self._markets_loaded:
            await self.load_markets()
            self._markets_loaded = True

    def round_amount(self, symbol: str, amount: float) -> float:
        market = self._get_market(symbol, "spot") or self._get_market(symbol, "swap")
        if not market:
            return amount
        precision = market.get("precision", {})
        amount_precision = precision.get("amount", 8)
        if isinstance(amount_precision, int):
            return float(Decimal(str(amount)).quantize(Decimal(10) ** -amount_precision, rounding=ROUND_DOWN))
        return amount

    def round_price(self, symbol: str, price: Optional[float]) -> Optional[float]:
        if price is None:
            return None
        market = self._get_market(symbol, "spot") or self._get_market(symbol, "swap")
        if not market:
            return price
        precision = market.get("precision", {})
        price_precision = precision.get("price", 8)
        if isinstance(price_precision, int):
            return float(Decimal(str(price)).quantize(Decimal(10) ** -price_precision, rounding=ROUND_HALF_UP))
        return price

    @abstractmethod
    async def validate_credentials(self) -> dict:
        ...

    @abstractmethod
    async def fetch_balance(self, market: str = "spot") -> dict:
        ...

    @abstractmethod
    async def create_order(
        self,
        symbol: str,
        side: OrderSide,
        order_type: OrderType,
        quantity: float,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        market: str = "spot",
        client_order_id: Optional[str] = None,
    ) -> dict:
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str, market: str = "spot") -> dict:
        ...

    @abstractmethod
    async def cancel_all_orders(self, symbol: Optional[str] = None) -> None:
        ...

    @abstractmethod
    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ...

    @abstractmethod
    async def set_leverage(self, symbol: str, leverage: int, market: str = "swap") -> bool:
        """Set leverage. Returns True on success, False on failure. Callers MUST
        abort the trade when this returns False — never trade at unknown leverage."""
        ...

    @abstractmethod
    async def set_position_mode(self, hedged: bool = False) -> None:
        ...

    @abstractmethod
    async def close(self) -> None:
        ...

    @abstractmethod
    async def fetch_ticker(self, symbol: str) -> dict:
        ...

    @abstractmethod
    async def fetch_ohlcv(self, symbol: str, timeframe: str = "15m", limit: int = 100) -> list:
        ...

    @abstractmethod
    async def fetch_positions(self, market: str = "swap") -> list[dict]:
        ...

    @abstractmethod
    async def fetch_funding_rate(self, symbol: str) -> Optional[float]:
        """Current funding rate for a perpetual symbol (e.g. 0.0001 = 0.01%). None if unavailable."""
        ...

    @abstractmethod
    async def fetch_my_trades(
        self, symbol: Optional[str] = None, since: Optional[int] = None, market: str = "spot"
    ) -> list[dict]:
        """Executed trades from the exchange ledger, for audit reconciliation."""
        ...
