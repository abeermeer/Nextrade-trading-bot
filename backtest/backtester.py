from datetime import datetime, timezone
from typing import Optional
import asyncio

import pandas as pd
import yfinance as yf

from analyst.indicator_calculator import IndicatorCalculator
from analyst.strategy_runner import StrategyRunner
from analyst.signal_aggregator import SignalAggregator
from shared.models import SignalAction, BotMode, OrderSide, OrderType, Position
from trader.paper_engine import PaperEngine
from trader.position_tracker import PositionTracker
from shared.logger import get_logger

logger = get_logger(__name__)



class Backtester:
    def __init__(self, settings: dict, strategies_config: dict):
        self.settings = settings
        self.strategies_config = strategies_config
        analyst_cfg = settings.get("analyst", {})
        self.indicator_calculator = IndicatorCalculator(analyst_cfg)
        self.strategy_runner = StrategyRunner(strategies_config)
        self.signal_aggregator = SignalAggregator(strategies_config)

    async def fetch_data(self, symbol: str, timeframe: str = "1h", period: str = "3mo") -> pd.DataFrame:
        yf_symbol = symbol.replace("/", "-").replace("USDT", "-USD")
        logger.info("backtest_fetching", symbol=yf_symbol, timeframe=timeframe, period=period)
        loop = asyncio.get_running_loop()
        ticker = yf.Ticker(yf_symbol)
        df = await loop.run_in_executor(None, lambda: ticker.history(period=period, interval=timeframe))
        if df.empty:
            yf_symbol_alt = symbol.replace("/", "") + "-USD"
            ticker = yf.Ticker(yf_symbol_alt)
            df = await loop.run_in_executor(None, lambda: ticker.history(period=period, interval=timeframe))
        if df.empty:
            raise ValueError(f"No data for {symbol} via yfinance")
        df.rename(
            columns={
                "Open": "open", "High": "high", "Low": "low",
                "Close": "close", "Volume": "volume",
            },
            inplace=True,
        )
        df = self.indicator_calculator.calculate_all(df)
        return df

    async def run(
        self,
        symbol: str,
        timeframe: str = "1h",
        period: str = "3mo",
        initial_balance: float = 10000.0,
    ) -> dict:
        df = await self.fetch_data(symbol, timeframe, period)
        engine = PaperEngine(initial_balance_usdt=initial_balance)
        tracker = PositionTracker()

        trades: list[dict] = []
        total_trades = 0
        wins = 0
        losses = 0
        peak_balance = initial_balance
        min_balance = initial_balance
        equity_curve: list[dict] = []

        for i in range(len(df)):
            row = df.iloc[: i + 1].copy()
            price = float(row["close"].iloc[-1])

            strategy_results = self.strategy_runner.run_all(row)
            signal = self.signal_aggregator.aggregate(symbol, price, strategy_results)

            if signal.action == SignalAction.HOLD:
                equity_curve.append({"date": str(row.index[-1]), "equity": round(engine.get_total_equity({symbol: price}), 2)})
                continue

            has_pos = tracker.has_position(symbol)

            if has_pos and signal.action == SignalAction.SELL:
                pos = tracker.get_open_position(symbol)
                if pos:
                    await engine.create_order(
                        symbol=symbol, side=OrderSide.SELL, order_type=OrderType.MARKET,
                        quantity=pos.quantity, price=price,
                    )
                    closed = tracker.close_position(symbol, price, "backtest_signal")
                    if closed:
                        total_trades += 1
                        if closed.realized_pnl > 0:
                            wins += 1
                        else:
                            losses += 1
                        pnl_pct = (engine.balance - initial_balance) / initial_balance * 100
                        trades.append({
                            "date": str(row.index[-1]), "action": "sell", "price": round(price, 4),
                            "pnl": round(closed.realized_pnl, 2), "balance": round(engine.balance, 2),
                            "pnl_pct": round(pnl_pct, 2),
                        })

            elif not has_pos and signal.action == SignalAction.BUY:
                size = min(engine.balance * 0.1, 1000.0)
                qty = size / price if price > 0 else 0
                if qty <= 0:
                    continue
                await engine.create_order(
                    symbol=symbol, side=OrderSide.BUY, order_type=OrderType.MARKET,
                    quantity=qty, price=price,
                )
                tracker.open_position(
                    symbol=symbol, side=OrderSide.BUY, entry_price=price, quantity=qty,
                )
                trades.append({
                    "date": str(row.index[-1]), "action": "buy", "price": round(price, 4),
                    "qty": round(qty, 6), "balance": round(engine.balance, 2),
                })

            if engine.balance > peak_balance:
                peak_balance = engine.balance
            if engine.balance < min_balance:
                min_balance = engine.balance

            equity = engine.get_total_equity({symbol: price})
            equity_curve.append({"date": str(row.index[-1]), "equity": round(equity, 2)})

        final_balance = engine.get_total_equity({symbol: float(df["close"].iloc[-1])})
        total_pnl = final_balance - initial_balance
        total_pnl_pct = (total_pnl / initial_balance) * 100
        max_drawdown = max(0, (peak_balance - min_balance) / peak_balance * 100) if peak_balance > 0 else 0
        win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
        sharpe = (total_pnl_pct / (df["close"].pct_change().std() * (252 ** 0.5))) if not df["close"].pct_change().std() == 0 else 0

        summary = {
            "symbol": symbol,
            "timeframe": timeframe,
            "period": period,
            "initial_balance": initial_balance,
            "final_balance": round(final_balance, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 2),
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 1),
            "max_drawdown_pct": round(max_drawdown, 2),
            "sharpe_ratio": round(sharpe, 2),
            "trades": trades[-50:],
            "equity_curve": equity_curve[::max(1, len(equity_curve) // 100)],
        }

        logger.info("backtest_complete", symbol=symbol, trades=total_trades, pnl=summary["total_pnl"], win_rate=summary["win_rate"])
        return summary
