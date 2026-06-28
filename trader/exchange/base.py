from abc import ABC, abstractmethod
from typing import Optional
from shared.models import OrderSide, OrderType
from shared.rate_limiter import RateLimiter


class BaseExchangeClient(ABC):
    rate_limiter: RateLimiter

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
    async def set_leverage(self, symbol: str, leverage: int, market: str = "swap") -> None:
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
