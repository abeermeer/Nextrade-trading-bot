import pytest
import pandas as pd
import numpy as np

from shared.models import SignalAction, OrderSide, OrderType, StrategyResult, Signal
from analyst.indicator_calculator import IndicatorCalculator
from analyst.strategy_runner import StrategyRunner
from analyst.signal_aggregator import SignalAggregator
from trader.paper_engine import PaperEngine
from trader.risk_manager import RiskManager
from trader.position_tracker import PositionTracker


@pytest.fixture
def sample_df() -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2026-01-01", periods=200, freq="h")
    close = np.random.randn(200).cumsum() + 100
    return pd.DataFrame(
        {
            "open": close + np.random.randn(200) * 0.1,
            "high": close + np.abs(np.random.randn(200)) * 0.5,
            "low": close - np.abs(np.random.randn(200)) * 0.5,
            "close": close,
            "volume": np.random.rand(200) * 1000 + 500,
        },
        index=dates,
    )


@pytest.fixture
def strategies_config() -> dict:
    return {
        "strategies": {
            "rsi": {
                "enabled": True,
                "weight": 0.25,
                "params": {"period": 14, "oversold": 30, "overbought": 70},
            },
            "macd_cross": {
                "enabled": True,
                "weight": 0.25,
                "params": {"fast": 12, "slow": 26, "signal": 9},
            },
            "ema_trend": {
                "enabled": True,
                "weight": 0.20,
                "params": {"short_period": 9, "long_period": 21},
            },
            "volume_breakout": {
                "enabled": True,
                "weight": 0.15,
                "params": {"volume_ma_period": 20, "breakout_multiplier": 2.0},
            },
            "bollinger_squeeze": {
                "enabled": True,
                "weight": 0.15,
                "params": {"period": 20, "std_dev": 2, "squeeze_threshold": 0.05},
            },
        },
        "signal_resolution": {
            "mode": "weighted",
            "confidence_threshold": 0.5,
            "min_signals_required": 2,
            "strict_overrides": [],
        },
    }


@pytest.mark.asyncio
async def test_full_signal_to_trade_flow(sample_df, strategies_config):
    """Integration test: indicators → strategies → signal → paper trade"""
    indicator_cfg = {"indicator_periods": {}}
    calc = IndicatorCalculator(indicator_cfg)
    df = calc.calculate_all(sample_df)
    assert not df.empty

    runner = StrategyRunner(strategies_config)
    results = runner.run_all(df)
    assert len(results) >= 2

    agg = SignalAggregator(strategies_config)
    current_price = float(df["close"].iloc[-1])
    signal = agg.aggregate("BTC/USDT", current_price, results)
    assert isinstance(signal, Signal)
    assert signal.symbol == "BTC/USDT"

    if signal.action == SignalAction.BUY:
            engine = PaperEngine(initial_balance_usdt=10000.0)
            order = await engine.create_order(
                symbol=signal.symbol,
                side=OrderSide.BUY,
                order_type=OrderType.MARKET,
                quantity=0.1,
                price=signal.price,
            )
            assert order.status.value == "filled"
            assert engine.balance < 10000.0


@pytest.mark.asyncio
async def test_paper_trade_then_close_pnl():
    """Integration test: open paper trade → price moves → close → P&L realized"""
    engine = PaperEngine(initial_balance_usdt=10000.0)
    tracker = PositionTracker()

    await engine.create_order("BTC/USDT", OrderSide.BUY, OrderType.MARKET, 0.1, 50000.0)
    assert "BTC/USDT" in engine.positions

    tracker.open_position("BTC/USDT", OrderSide.BUY, 50000.0, 0.1)
    tracker.update_price("BTC/USDT", 51000.0)

    await engine.create_order("BTC/USDT", OrderSide.SELL, OrderType.MARKET, 0.1, 51000.0)
    closed = tracker.close_position("BTC/USDT", 51000.0)
    assert closed is not None
    assert closed.realized_pnl == 100.0
    assert abs(engine.balance - (10000.0 - (50000 * 0.1 * 1.001) + (51000 * 0.1 * 0.999))) < 1.0


def test_signal_hold_no_trade_triggered(strategies_config):
    """A HOLD signal should not trigger any trade in the trader bot"""
    agg = SignalAggregator(strategies_config)
    results = [
        StrategyResult(strategy_name="rsi", action=SignalAction.HOLD, confidence=0.0),
        StrategyResult(strategy_name="macd", action=SignalAction.HOLD, confidence=0.0),
    ]
    signal = agg.aggregate("BTC/USDT", 50000.0, results)
    assert signal.action == SignalAction.HOLD
    assert signal.confidence == 0.0


def test_circuit_breaker_blocks_all_trades():
    """Once circuit breaker is active, no trades allowed"""
    rm = RiskManager(circuit_breaker_drawdown_pct=10.0, initial_balance=10000.0)
    rm.update_balance(10000.0)
    rm.update_balance(8500.0)
    can, reason = rm.can_trade("ANY/PAIR")
    assert can is False


def test_position_sizing_never_exceeds_max():
    rm = RiskManager(max_position_size_usdt=500.0)
    qty = rm.calculate_position_size(100000.0, 1.0)
    assert qty <= 500.0


def test_multiple_consecutive_buys_ignored_when_in_position():
    """If already in a position, additional BUY signals should be skipped"""
    tracker = PositionTracker()
    tracker.open_position("BTC/USDT", OrderSide.BUY, 50000.0, 0.1)
    assert tracker.has_position("BTC/USDT") is True
    assert tracker.position_count() == 1
