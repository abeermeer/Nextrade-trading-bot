import pytest
import pandas as pd
import numpy as np
from datetime import datetime

from shared.models import StrategyResult, SignalAction
from analyst.strategy_runner import StrategyRunner
from analyst.signal_aggregator import SignalAggregator
from analyst.indicator_calculator import IndicatorCalculator


@pytest.fixture
def sample_df() -> pd.DataFrame:
    np.random.seed(42)
    dates = pd.date_range("2026-01-01", periods=200, freq="h")
    close = np.random.randn(200).cumsum() + 100
    df = pd.DataFrame(
        {
            "open": close + np.random.randn(200) * 0.1,
            "high": close + np.abs(np.random.randn(200)) * 0.5,
            "low": close - np.abs(np.random.randn(200)) * 0.5,
            "close": close,
            "volume": np.random.rand(200) * 1000 + 500,
        },
        index=dates,
    )
    df.index.name = "timestamp"
    return df


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
            "confidence_threshold": 0.6,
            "min_signals_required": 2,
            "strict_overrides": ["daily_drawdown_exceeded", "circuit_breaker_active"],
        },
    }


class TestIndicatorCalculator:
    def test_calculate_all_adds_indicators(self, sample_df):
        config = {"indicator_periods": {}}
        calc = IndicatorCalculator(config)
        result = calc.calculate_all(sample_df)

        expected_cols = [
            "rsi", "macd", "macd_signal", "macd_histogram",
            "ema_short", "ema_long",
            "bb_upper", "bb_mid", "bb_lower", "bb_bandwidth", "bb_percent",
            "volume_ma",
        ]
        for col in expected_cols:
            assert col in result.columns, f"Missing column: {col}"

    def test_empty_df_returns_empty(self):
        config = {"indicator_periods": {}}
        calc = IndicatorCalculator(config)
        empty = pd.DataFrame()
        result = calc.calculate_all(empty)
        assert result.empty


class TestStrategyRunner:
    def test_run_all_returns_results(self, sample_df, strategies_config):
        runner = StrategyRunner(strategies_config)
        results = runner.run_all(sample_df)

        assert len(results) > 0
        assert all(isinstance(r, StrategyResult) for r in results)

    def test_disabled_strategy_skipped(self, sample_df, strategies_config):
        config = {
            "strategies": {
                "rsi": {
                    "enabled": False,
                    "weight": 0.5,
                    "params": {"period": 14},
                },
            },
        }
        runner = StrategyRunner(config)
        results = runner.run_all(sample_df)
        assert len(results) == 0


class TestSignalAggregator:
    def test_weighted_mode(self):
        config = {
            "signal_resolution": {
                "mode": "weighted",
                "confidence_threshold": 0.5,
                "min_signals_required": 1,
                "strict_overrides": [],
            },
        }
        agg = SignalAggregator(config)
        results = [
            StrategyResult(strategy_name="rsi", action=SignalAction.BUY, confidence=0.8),
            StrategyResult(strategy_name="macd", action=SignalAction.BUY, confidence=0.7),
        ]
        signal = agg.aggregate("BTC/USDT", 50000.0, results)
        assert signal.action == SignalAction.BUY
        assert signal.symbol == "BTC/USDT"
        assert signal.price == 50000.0

    def test_strict_mode_override(self):
        config = {
            "signal_resolution": {
                "mode": "strict",
                "confidence_threshold": 0.5,
                "min_signals_required": 1,
                "strict_overrides": [],
            },
        }
        agg = SignalAggregator(config)
        results = [
            StrategyResult(strategy_name="rsi", action=SignalAction.SELL, confidence=0.8),
            StrategyResult(strategy_name="macd", action=SignalAction.BUY, confidence=0.9),
        ]
        signal = agg.aggregate("ETH/USDT", 3000.0, results)
        assert signal.action == SignalAction.SELL

    def test_majority_mode(self):
        config = {
            "signal_resolution": {
                "mode": "majority",
                "confidence_threshold": 0.5,
                "min_signals_required": 1,
                "strict_overrides": [],
            },
        }
        agg = SignalAggregator(config)
        results = [
            StrategyResult(strategy_name="s1", action=SignalAction.BUY, confidence=0.8),
            StrategyResult(strategy_name="s2", action=SignalAction.BUY, confidence=0.7),
            StrategyResult(strategy_name="s2", action=SignalAction.SELL, confidence=0.8),
        ]
        signal = agg.aggregate("SOL/USDT", 100.0, results)
        assert signal.action == SignalAction.BUY

    def test_hold_when_below_min_signals(self):
        config = {
            "signal_resolution": {
                "mode": "weighted",
                "confidence_threshold": 0.5,
                "min_signals_required": 3,
                "strict_overrides": [],
            },
        }
        agg = SignalAggregator(config)
        results = [
            StrategyResult(strategy_name="rsi", action=SignalAction.BUY, confidence=0.8),
        ]
        signal = agg.aggregate("BTC/USDT", 50000.0, results)
        assert signal.action == SignalAction.HOLD

    def test_hold_when_neutral_weighted(self):
        config = {
            "signal_resolution": {
                "mode": "weighted",
                "confidence_threshold": 0.5,
                "min_signals_required": 1,
                "strict_overrides": [],
            },
        }
        agg = SignalAggregator(config)
        results = [
            StrategyResult(strategy_name="s1", action=SignalAction.HOLD, confidence=1.0),
        ]
        signal = agg.aggregate("BTC/USDT", 50000.0, results)
        assert signal.action == SignalAction.HOLD
