from typing import Optional
from shared.rate_limiter import RateLimiter
from trader.exchange.base import BaseExchangeClient
from trader.exchange.mexc_client import MEXCClient
from trader.exchange.binance_client import BinanceClient
from trader.exchange.bybit_client import BybitClient


EXCHANGE_MAP = {
    "mexc": MEXCClient,
    "binance": BinanceClient,
    "bybit": BybitClient,
}


def create_exchange(
    exchange_name: str,
    api_key: str,
    api_secret: str,
    use_sandbox: bool = False,
    rate_limiter: Optional[RateLimiter] = None,
) -> BaseExchangeClient:
    cls = EXCHANGE_MAP.get(exchange_name.lower())
    if not cls:
        raise ValueError(f"Unsupported exchange: {exchange_name}. Supported: {', '.join(EXCHANGE_MAP.keys())}")
    return cls(
        api_key=api_key,
        api_secret=api_secret,
        use_sandbox=use_sandbox,
        rate_limiter=rate_limiter,
    )
