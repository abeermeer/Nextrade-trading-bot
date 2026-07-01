from typing import Optional
import ccxt.async_support as ccxt
from ccxt import AuthenticationError, NetworkError, ExchangeError
from shared.models import OrderSide, OrderType
from shared.rate_limiter import RateLimiter
from shared.logger import get_logger
from trader.exchange.base import BaseExchangeClient

logger = get_logger(__name__)


class MEXCClient(BaseExchangeClient):
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
        self._markets: dict[str, dict] = {}

    async def load_markets(self) -> None:
        spot = await self._get_spot()
        await spot.load_markets()
        for symbol, market in spot.markets.items():
            self._markets[symbol] = market
        try:
            fut = await self._get_futures()
            await fut.load_markets()
            for symbol, market in fut.markets.items():
                self._markets[symbol] = market
        except Exception:
            pass

    def _get_market(self, symbol: str, market_type: str = "spot") -> Optional[dict]:
        return self._markets.get(symbol)

    async def _get_spot(self) -> ccxt.Exchange:
        if self._spot is None:
            self._spot = ccxt.mexc({
                "apiKey": self._api_key,
                "secret": self._api_secret,
                "options": {"defaultType": "spot"},
                "sandbox": self._use_sandbox,
            })
        return self._spot

    async def _get_futures(self) -> ccxt.Exchange:
        if self._futures is None:
            self._futures = ccxt.mexc({
                "apiKey": self._api_key,
                "secret": self._api_secret,
                "options": {"defaultType": "swap"},
                "sandbox": self._use_sandbox,
            })
        return self._futures

    async def validate_credentials(self) -> dict:
        result = {"spot_ok": False, "futures_ok": False, "error": None}
        try:
            spot = await self._get_spot()
            await spot.fetch_balance()
            result["spot_ok"] = True
        except AuthenticationError as e:
            result["error"] = f"Spot auth failed: {e}"
            logger.warning("spot_auth_error", error=str(e))
        except (NetworkError, ExchangeError) as e:
            result["error"] = f"Spot connection failed: {e}"
            logger.warning("spot_connection_error", error=str(e))
        try:
            fut = await self._get_futures()
            await fut.fetch_balance()
            result["futures_ok"] = True
        except AuthenticationError as e:
            if not result.get("error"):
                result["error"] = f"Futures auth failed: {e}"
            logger.warning("futures_auth_error", error=str(e))
        except (NetworkError, ExchangeError) as e:
            if not result.get("error"):
                result["error"] = f"Futures connection failed: {e}"
            logger.warning("futures_connection_error", error=str(e))
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
        client_order_id: Optional[str] = None,
    ) -> dict:
        ex = await self._get_spot() if market == "spot" else await self._get_futures()
        await self.rate_limiter.acquire()
        await self._ensure_markets_loaded()

        ccxt_side = side.value
        ccxt_type = "market" if order_type == OrderType.MARKET else "limit"

        qty_rounded = self.round_amount(symbol, quantity)
        price_rounded = self.round_price(symbol, price)

        params: dict = {}

        if stop_loss:
            params["stopLossPrice"] = stop_loss
        if take_profit:
            params["takeProfitPrice"] = take_profit
        if client_order_id:
            params["clientOrderId"] = client_order_id

        logger.info(
            "order_created",
            symbol=symbol,
            side=side.value,
            type=ccxt_type,
            qty=qty_rounded,
            price=price_rounded,
            market=market,
        )

        order = await ex.create_order(
            symbol=symbol,
            type=ccxt_type,
            side=ccxt_side,
            amount=qty_rounded,
            price=price_rounded,
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

    async def set_leverage(self, symbol: str, leverage: int, market: str = "swap") -> bool:
        ex = await self._get_futures() if market == "swap" else await self._get_spot()
        await self.rate_limiter.acquire()
        try:
            await ex.set_leverage(leverage, symbol)
            logger.info("leverage_set", symbol=symbol, leverage=leverage)
            return True
        except Exception as e:
            logger.warning("leverage_set_failed", symbol=symbol, error=str(e))
            return False

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
        logger.info("mexc_client_closed")

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

    async def fetch_funding_rate(self, symbol: str) -> Optional[float]:
        ex = await self._get_futures()
        await self.rate_limiter.acquire()
        try:
            data = await ex.fetch_funding_rate(symbol)
            rate = data.get("fundingRate") if isinstance(data, dict) else None
            return float(rate) if rate is not None else None
        except Exception as e:
            logger.warning("funding_rate_fetch_failed", symbol=symbol, error=str(e))
            return None

    async def fetch_my_trades(
        self, symbol: Optional[str] = None, since: Optional[int] = None, market: str = "spot"
    ) -> list[dict]:
        ex = await self._get_spot() if market == "spot" else await self._get_futures()
        await self.rate_limiter.acquire()
        try:
            return await ex.fetch_my_trades(symbol, since)
        except Exception as e:
            logger.warning("fetch_my_trades_failed", symbol=symbol, error=str(e))
            return []
