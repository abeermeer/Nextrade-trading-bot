import asyncio
from typing import Callable, Optional
import ccxt.pro as ccxtpro
from shared.logger import get_logger

logger = get_logger(__name__)


class RealtimeDataManager:
    def __init__(self, api_key: str = "", api_secret: str = ""):
        self._exchange: Optional[ccxtpro.Exchange] = None
        self._api_key = api_key
        self._api_secret = api_secret
        self._running = False
        self._tickers: dict[str, float] = {}
        self._candles: dict[str, dict[str, list]] = {}
        self._price_callbacks: list[Callable] = []
        self._candle_callbacks: list[Callable] = []

    async def _get_exchange(self) -> ccxtpro.Exchange:
        if self._exchange is None:
            self._exchange = ccxtpro.mexc({
                "apiKey": self._api_key,
                "secret": self._api_secret,
            })
            await self._exchange.load_markets()
        return self._exchange

    async def start(self, symbols: list[str], timeframes: list[str] | None = None) -> None:
        self._running = True
        tfs = timeframes or ["15m"]

        # Only subscribe to symbols the exchange actually lists — delisted/unknown ones
        # (e.g. MATIC after the POL rename) otherwise raise "does not have market symbol"
        # on every 5s retry and flood the logs / load Redis.
        ex = await self._get_exchange()
        valid = [s for s in symbols if s in ex.markets]
        skipped = [s for s in symbols if s not in ex.markets]
        if skipped:
            logger.warning("realtime_skipped_unknown_symbols", count=len(skipped), symbols=skipped[:10])

        tasks = [asyncio.create_task(self._ticker_loop(s)) for s in valid]
        for tf in tfs:
            tasks.append(asyncio.create_task(self._ohlcv_loop(valid, tf)))

        logger.info("realtime_started", symbols=len(valid), timeframes=tfs)
        await asyncio.gather(*tasks)

    async def _ticker_loop(self, symbol: str) -> None:
        ex = await self._get_exchange()
        while self._running:
            try:
                ticker = await ex.watch_ticker(symbol)
                price = ticker.get("last") or ticker.get("close")
                if price:
                    self._tickers[symbol] = float(price)
                    for cb in self._price_callbacks:
                        await cb(symbol, float(price))
            except Exception as e:
                if self._running:
                    if "does not have market" in str(e) or "not supported" in str(e).lower():
                        logger.warning("ticker_ws_unsupported_stop", symbol=symbol)
                        return  # stop this symbol's loop — retrying can never succeed
                    logger.warning("ticker_ws_error", symbol=symbol, error=str(e))
                    await asyncio.sleep(5)

    async def _ohlcv_loop(self, symbols: list[str], timeframe: str) -> None:
        async def _watch_one(symbol: str) -> None:
            ex = await self._get_exchange()
            while self._running:
                try:
                    ohlcv = await ex.watch_ohlcv(symbol, timeframe)
                    if symbol not in self._candles:
                        self._candles[symbol] = {}
                    self._candles[symbol][timeframe] = ohlcv[-200:]
                    for cb in self._candle_callbacks:
                        await cb(symbol, timeframe, ohlcv[-1])
                except Exception as e:
                    if self._running:
                        if "does not have market" in str(e) or "not supported" in str(e).lower():
                            logger.warning("ohlcv_ws_unsupported_stop", symbol=symbol, timeframe=timeframe)
                            return  # stop this symbol's loop
                        logger.warning("ohlcv_ws_error", symbol=symbol, timeframe=timeframe, error=str(e))
                        await asyncio.sleep(5)

        await asyncio.gather(*(_watch_one(s) for s in symbols))

    def get_price(self, symbol: str) -> Optional[float]:
        return self._tickers.get(symbol)

    def get_candles(self, symbol: str, timeframe: str) -> list:
        return self._candles.get(symbol, {}).get(timeframe, [])

    def get_all_prices(self) -> dict[str, float]:
        return dict(self._tickers)

    def on_price(self, cb: Callable) -> None:
        self._price_callbacks.append(cb)

    def on_candle(self, cb: Callable) -> None:
        self._candle_callbacks.append(cb)

    async def stop(self) -> None:
        self._running = False
        if self._exchange:
            await self._exchange.close()
        logger.info("realtime_stopped")
