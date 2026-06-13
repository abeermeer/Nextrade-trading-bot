from datetime import timedelta
from typing import Optional
import pandas as pd
import yfinance as yf
from pycoingecko import CoinGeckoAPI
from tenacity import retry, stop_after_attempt, wait_exponential
from shared.logger import get_logger
from shared.rate_limiter import RateLimiter

logger = get_logger(__name__)

TIMEFRAME_MAP = {
    "15m": {"interval": "15m", "period": "7d"},  # 7d of 15m = ~672 candles
    "1h": {"interval": "60m", "period": "30d"},
    "4h": {"interval": "90m", "period": "60d"},
}

YFINANCE_SUFFIX = "-USD"
YFINANCE_PREFIX = ""
CG_VS_CURRENCY = "usd"


class DataFetcher:
    def __init__(self, rate_limiter: Optional[RateLimiter] = None):
        self._cg: Optional[CoinGeckoAPI] = None
        self.rate_limiter = rate_limiter or RateLimiter(max_per_second=10)

    @property
    def cg(self) -> CoinGeckoAPI:
        if self._cg is None:
            self._cg = CoinGeckoAPI()
        return self._cg

    def _to_yfinance_symbol(self, symbol: str) -> str:
        base = symbol.split("/")[0].upper()
        return f"{YFINANCE_PREFIX}{base}{YFINANCE_SUFFIX}"

    def _to_coingecko_id(self, symbol: str) -> str:
        mapping = {
            "BTC": "bitcoin",
            "ETH": "ethereum",
            "SOL": "solana",
            "BNB": "binancecoin",
            "XRP": "ripple",
            "ADA": "cardano",
            "DOGE": "dogecoin",
            "DOT": "polkadot",
            "AVAX": "avalanche-2",
            "MATIC": "matic-network",
            "LINK": "chainlink",
            "UNI": "uniswap",
            "ATOM": "cosmos",
        }
        base = symbol.split("/")[0].upper()
        return mapping.get(base, base.lower())

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def fetch_ohlcv_yfinance(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        tf = TIMEFRAME_MAP.get(timeframe)
        if not tf:
            raise ValueError(f"Unsupported timeframe: {timeframe}")

        yf_symbol = self._to_yfinance_symbol(symbol)
        logger.info("fetching_yfinance", symbol=yf_symbol, timeframe=timeframe)

        try:
            ticker = yf.Ticker(yf_symbol)
            df = ticker.history(period=tf["period"], interval=tf["interval"])
            if df.empty:
                logger.warning("yfinance_empty", symbol=yf_symbol)
                return None

            df = df.rename(columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            })
            df.index.name = "timestamp"
            return df[["open", "high", "low", "close", "volume"]]
        except Exception as e:
            logger.error("yfinance_error", symbol=yf_symbol, error=str(e))
            return None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def fetch_ohlcv_coingecko(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        days_map = {"15m": 7, "1h": 30, "4h": 60}
        days = days_map.get(timeframe, 7)

        coin_id = self._to_coingecko_id(symbol)
        logger.info("fetching_coingecko", coin_id=coin_id, timeframe=timeframe)

        try:
            raw = self.cg.get_coin_market_chart_by_id(
                id=coin_id,
                vs_currency=CG_VS_CURRENCY,
                days=days,
            )
            prices = raw.get("prices", [])
            volumes = raw.get("total_volumes", [])

            if not prices:
                return None

            df = pd.DataFrame(prices, columns=["timestamp", "close"])
            df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
            df.set_index("timestamp", inplace=True)

            vol_df = pd.DataFrame(volumes, columns=["timestamp", "volume"])
            vol_df["timestamp"] = pd.to_datetime(vol_df["timestamp"], unit="ms")
            vol_df.set_index("timestamp", inplace=True)

            df["volume"] = vol_df["volume"]
            df["open"] = df["close"]
            df["high"] = df["close"]
            df["low"] = df["close"]

            if timeframe == "15m":
                df = df.resample("15min").last().ffill()
            elif timeframe == "1h":
                df = df.resample("1h").last().ffill()
            elif timeframe == "4h":
                df = df.resample("4h").last().ffill()

            return df[["open", "high", "low", "close", "volume"]]
        except Exception as e:
            logger.error("coingecko_error", coin_id=coin_id, error=str(e))
            return None

    async def fetch_ohlcv(self, symbol: str, timeframe: str) -> Optional[pd.DataFrame]:
        await self.rate_limiter.acquire()

        df = await self.fetch_ohlcv_yfinance(symbol, timeframe)
        if df is not None and not df.empty:
            return df

        logger.warning("yfinance_fallback_to_coingecko", symbol=symbol)
        await self.rate_limiter.acquire()
        return await self.fetch_ohlcv_coingecko(symbol, timeframe)
