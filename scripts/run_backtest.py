import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config_loader import ConfigLoader
from shared.logger import setup_logging, get_logger
from backtest.backtester import Backtester


async def main():
    config_loader = ConfigLoader()
    settings = config_loader.load_settings()
    strategies_config = config_loader.load_strategies()

    logging_cfg = settings.get("logging", {})
    setup_logging(level=logging_cfg.get("level", "INFO"))

    logger = get_logger(__name__)

    symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
    timeframe = "1h"
    period = "1mo"

    for symbol in symbols:
        logger.info("backtest_starting", symbol=symbol, timeframe=timeframe, period=period)
        bt = Backtester(settings, strategies_config)
        result = bt.run(symbol, timeframe, period, initial_balance=10000.0)
        await result

        print(f"\n=== {symbol} ({timeframe}, {period}) ===")
        print(f"  Initial:  ${result['initial_balance']:,.2f}")
        print(f"  Final:    ${result['final_balance']:,.2f}")
        print(f"  P&L:      ${result['total_pnl']:+,.2f} ({result['total_pnl_pct']:+.2f}%)")
        print(f"  Trades:   {result['total_trades']} ({result['wins']}W / {result['losses']}L)")
        print(f"  Win Rate: {result['win_rate']}%")
        print(f"  Max DD:   {result['max_drawdown_pct']:.2f}%")
        print()


if __name__ == "__main__":
    asyncio.run(main())
