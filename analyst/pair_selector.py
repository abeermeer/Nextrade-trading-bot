from typing import Optional
import ccxt.async_support as ccxt
from shared.logger import get_logger

logger = get_logger(__name__)

DEFAULT_PAIRS = [
    "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
    "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT",
    "MATIC/USDT", "UNI/USDT", "SHIB/USDT", "LTC/USDT", "ATOM/USDT",
    "ETC/USDT", "XLM/USDT", "FIL/USDT", "TRX/USDT", "NEAR/USDT",
    "APT/USDT", "ARB/USDT", "OP/USDT", "SUI/USDT", "PEPE/USDT",
    "INJ/USDT", "TIA/USDT", "SEI/USDT", "RUNE/USDT", "AAVE/USDT",
    "ALGO/USDT", "FTM/USDT", "SAND/USDT", "MANA/USDT", "AXS/USDT",
    "CRV/USDT", "APE/USDT", "FLOW/USDT", "ICP/USDT", "EGLD/USDT",
]


class PairSelector:
    def __init__(self, max_pairs: int = 10, exchange: Optional[ccxt.Exchange] = None, min_volume_usdt: float = 0.0):
        self.max_pairs = max_pairs
        self._exchange = exchange
        self.min_volume_usdt = min_volume_usdt

    async def _get_exchange(self) -> ccxt.Exchange:
        if self._exchange is None:
            self._exchange = ccxt.mexc()
        return self._exchange

    async def select_pairs(self) -> list[str]:
        try:
            exchange = await self._get_exchange()
            tickers = await exchange.fetch_tickers()
            usdt_pairs = [
                {"symbol": s, "volume": t.get("quoteVolume", 0) or 0}
                for s, t in tickers.items()
                if s.endswith("/USDT") and (t.get("quoteVolume", 0) or 0) > self.min_volume_usdt
            ]
            usdt_pairs.sort(key=lambda x: x["volume"], reverse=True)
            selected = [p["symbol"] for p in usdt_pairs[: self.max_pairs]]
            logger.info(
                "pairs_selected_dynamic",
                count=len(selected),
                top=selected[:3],
            )
            return selected
        except Exception as e:
            logger.warning("pairs_fallback_to_defaults", error=str(e))
            return DEFAULT_PAIRS[: self.max_pairs]

    async def close(self) -> None:
        if self._exchange:
            await self._exchange.close()
