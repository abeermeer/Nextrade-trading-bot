import asyncio
from typing import Optional
import pandas as pd
import ccxt
from shared.logger import get_logger

logger = get_logger(__name__)

TIMEFRAME_LIMITS = {"15m": 1000, "1h": 1000, "4h": 1000}


class DataFetcher:
    def __init__(self, exchange_id: str = "mexc"):
        self._exchange = None
        self._exchange_id = exchange_id

    @property
    def exchange(self):
        if self._exchange is None:
            self._exchange = getattr(ccxt, self._exchange_id)({"enableRateLimit": True})
        return self._exchange

    async def fetch_ohlcv(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        limit = TIMEFRAME_LIMITS.get(timeframe, 500)
        loop = asyncio.get_running_loop()
        try:
            ohlcv = await loop.run_in_executor(
                None, lambda: self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            )
            if not ohlcv:
                return None
            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)
            return df
        except Exception as e:
            logger.error("ccxt_fetch_error", symbol=symbol, timeframe=timeframe, error=str(e))
            return None

    async def fetch_ohlcv_since(self, symbol: str, timeframe: str, since_ms: int, limit: int = 1000) -> Optional[pd.DataFrame]:
        loop = asyncio.get_running_loop()
        try:
            ohlcv = await loop.run_in_executor(
                None, lambda: self.exchange.fetch_ohlcv(symbol, timeframe, since=since_ms, limit=limit)
            )
            if not ohlcv:
                return None
            df = pd.DataFrame(ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)
            return df
        except Exception as e:
            logger.error("ccxt_fetch_since_error", symbol=symbol, timeframe=timeframe, error=str(e))
            return None
