import asyncio
from typing import Optional
import pandas as pd
import ccxt
from shared.logger import get_logger

logger = get_logger(__name__)

TIMEFRAME_LIMITS = {"15m": 1000, "1h": 1000, "4h": 1000}
MAX_RETRIES = 3


class DataFetcher:
    def __init__(self, exchange_id: str = "mexc"):
        self._exchange = getattr(ccxt, exchange_id)({"enableRateLimit": True})
        self._exchange_id = exchange_id

    @property
    def exchange(self):
        return self._exchange

    async def _fetch(self, symbol: str, timeframe: str, since_ms: Optional[int] = None, limit: int = 500) -> Optional[list]:
        loop = asyncio.get_running_loop()
        for attempt in range(MAX_RETRIES):
            try:
                kwargs = {"symbol": symbol, "timeframe": timeframe, "limit": limit}
                if since_ms is not None:
                    kwargs["since"] = since_ms
                result = await loop.run_in_executor(
                    None, lambda: self._exchange.fetch_ohlcv(**kwargs)
                )
                if result:
                    return result
            except Exception as e:
                logger.warning("ccxt_retry", symbol=symbol, timeframe=timeframe, attempt=attempt + 1, error=str(e))
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
        logger.error("ccxt_fetch_failed", symbol=symbol, timeframe=timeframe)
        return None

    async def fetch_ohlcv(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        limit = TIMEFRAME_LIMITS.get(timeframe, 500)
        ohlcv = await self._fetch(symbol, timeframe, limit=limit)
        if not ohlcv:
            return None
        df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df.set_index("timestamp", inplace=True)
        return df

    async def fetch_ohlcv_since(self, symbol: str, timeframe: str, since_ms: int, limit: int = 1000) -> Optional[pd.DataFrame]:
        all_candles = []
        current_since = since_ms
        while True:
            ohlcv = await self._fetch(symbol, timeframe, since_ms=current_since, limit=limit)
            if not ohlcv:
                break
            all_candles.extend(ohlcv)
            if len(ohlcv) < limit:
                break
            current_since = ohlcv[-1][0] + 1
        if not all_candles:
            return None
        df = pd.DataFrame(all_candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        df.set_index("timestamp", inplace=True)
        df = df[~df.index.duplicated(keep="last")]
        return df
