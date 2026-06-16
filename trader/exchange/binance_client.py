from typing import Optional
import ccxt.async_support as ccxt
from ccxt import AuthenticationError, NetworkError, ExchangeError
from shared.models import OrderSide, OrderType
from shared.rate_limiter import RateLimiter
from shared.logger import get_logger
from trader.exchange.base import BaseExchangeClient

logger = get_logger(__name__)


class BinanceClient(BaseExchangeClient):
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        use_sandbox: bool = False,
        rate_limiter: Optional[RateLimiter] = None,
    ):
        self.rate_limiter = rate_limiter or RateLimiter(max_per_second=20)
        self._spot: Optional[ccxt.Exchange] = None
        self._futures: Optional[ccxt.Exchange] = None
        self._api_key = api_key
        self._api_secret = api_secret
        self._use_sandbox = use_sandbox

    async def _get_spot(self) -> ccxt.Exchange:
        if self._spot is None:
            self._spot = ccxt.binance({
                "apiKey": self._api_key,
                "secret": self._api_secret,
                "options": {"defaultType": "spot"},
                "sandbox": self._use_sandbox,
            })
        return self._spot

    async def _get_futures(self) -> ccxt.Exchange:
        if self._futures is None:
            self._futures = ccxt.binance({
                "apiKey": self._api_key,
                "secret": self._api_secret,
                "options": {"defaultType": "future"},
                "sandbox": self._use_sandbox,
            })
        return self._futures

    async def validate_credentials(self) -> dict:
        result = {"spot_ok": False, "futures_ok": False}
        try:
            spot = await self._get_spot()
            await spot.fetch_balance()
            result["spot_ok"] = True
        except AuthenticationError:
            pass
        except (NetworkError, ExchangeError):
            pass
        try:
            fut = await self._get_futures()
            await fut.fetch_balance()
            result["futures_ok"] = True
        except AuthenticationError:
            pass
        except (NetworkError, ExchangeError):
            pass
        return result

    async def fetch_balance(self, market: str = "spot") -> dict:
        ex = await self._get_spot() if market == "spot" else await self._get_futures()
        await self.rate_limiter.acquire()
        balance = await ex.fetch_balance()
        return {
            "total_usdt": balance.get("USDT", {}).get("total", 0),
            "free_usdt": balance.get("USDT", {}).get("free", 0),
            "used_usdt": balance.get("USDT", {}).get("used", 0),
        }

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
    ) -> dict:
        ex = await self._get_spot() if market == "spot" else await self._get_futures()
        await self.rate_limiter.acquire()

        ccxt_side = side.value
        ccxt_type = "market" if order_type == OrderType.MARKET else "limit"

        params: dict = {}
        if stop_loss:
            params["stopLossPrice"] = stop_loss
        if take_profit:
            params["takeProfitPrice"] = take_profit

        logger.info(
            "order_created",
            symbol=symbol,
            side=side.value,
            type=ccxt_type,
            qty=quantity,
            price=price,
            market=market,
        )

        order = await ex.create_order(
            symbol=symbol,
            type=ccxt_type,
            side=ccxt_side,
            amount=quantity,
            price=price,
            params=params,
        )
        return order

    async def cancel_order(self, order_id: str, symbol: str, market: str = "spot") -> dict:
        ex = await self._get_spot() if market == "spot" else await self._get_futures()
        await self.rate_limiter.acquire()
        return await ex.cancel_order(order_id, symbol)

    async def cancel_all_orders(self, symbol: Optional[str] = None) -> None:
        ex = await self._get_spot()
        await self.rate_limiter.acquire()
        await ex.cancel_all_orders(symbol)

    async def fetch_open_orders(self, symbol: Optional[str] = None) -> list[dict]:
        ex = await self._get_spot()
        await self.rate_limiter.acquire()
        return await ex.fetch_open_orders(symbol)

    async def set_leverage(self, symbol: str, leverage: int, market: str = "swap") -> None:
        ex = await self._get_futures() if market == "swap" else await self._get_spot()
        await self.rate_limiter.acquire()
        try:
            await ex.set_leverage(leverage, symbol)
            logger.info("leverage_set", symbol=symbol, leverage=leverage)
        except Exception as e:
            logger.warning("leverage_set_failed", symbol=symbol, error=str(e))

    async def set_position_mode(self, hedged: bool = False) -> None:
        ex = await self._get_futures()
        await self.rate_limiter.acquire()
        try:
            await ex.set_position_mode(hedged)
            logger.info("position_mode_set", hedged=hedged)
        except Exception as e:
            logger.warning("position_mode_set_failed", error=str(e))

    async def close(self) -> None:
        if self._spot:
            await self._spot.close()
        if self._futures:
            await self._futures.close()
        logger.info("binance_client_closed")

    async def fetch_ticker(self, symbol: str) -> dict:
        ex = await self._get_spot()
        await self.rate_limiter.acquire()
        return await ex.fetch_ticker(symbol)

    async def fetch_ohlcv(self, symbol: str, timeframe: str = "15m", limit: int = 100) -> list:
        ex = await self._get_spot()
        await self.rate_limiter.acquire()
        return await ex.fetch_ohlcv(symbol, timeframe, limit=limit)

    async def fetch_positions(self, market: str = "swap") -> list[dict]:
        ex = await self._get_futures()
        await self.rate_limiter.acquire()
        return await ex.fetch_positions()
