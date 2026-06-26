import pandas as pd
from analyst.strategies import (
    RSIStrategy,
    MACDStrategy,
    EMATrendStrategy,
    VolumeBreakoutStrategy,
    BollingerSqueezeStrategy,
    SupertrendStrategy,
    ADXStrategy,
    IchimokuStrategy,
    PullbackStrategy,
    RangeStrategy,
    CounterTrendStrategy,
)
from shared.models import StrategyResult
from shared.logger import get_logger

logger = get_logger(__name__)

STRATEGY_MAP = {
    "rsi": RSIStrategy,
    "macd_cross": MACDStrategy,
    "ema_trend": EMATrendStrategy,
    "volume_breakout": VolumeBreakoutStrategy,
    "bollinger_squeeze": BollingerSqueezeStrategy,
    "supertrend": SupertrendStrategy,
    "adx": ADXStrategy,
    "ichimoku": IchimokuStrategy,
    "pullback": PullbackStrategy,
    "range": RangeStrategy,
    "counter_trend": CounterTrendStrategy,
}


class StrategyRunner:
    def __init__(self, strategies_config: dict):
        self.strategies_config = strategies_config.get("strategies", {})

    def run_all(self, df: pd.DataFrame) -> list[StrategyResult]:
        results: list[StrategyResult] = []

        for name, cfg in self.strategies_config.items():
            if not cfg.get("enabled", True):
                continue

            strategy_class = STRATEGY_MAP.get(name)
            if strategy_class is None:
                logger.warning("unknown_strategy", name=name)
                continue

            try:
                strategy = strategy_class(
                    name=name,
                    weight=cfg.get("weight", 0.2),
                    params=cfg.get("params", {}),
                )
                result = strategy.calculate(df)
                results.append(result)
                logger.debug(
                    "strategy_result",
                    strategy=name,
                    action=result.action.value,
                    confidence=round(result.confidence, 3),
                )
            except Exception as e:
                logger.error("strategy_error", name=name, error=str(e))

        logger.info(
            "strategy_run_complete",
            total=len(results),
            buys=sum(1 for r in results if r.action.value == "buy"),
            sells=sum(1 for r in results if r.action.value == "sell"),
            holds=sum(1 for r in results if r.action.value == "hold"),
        )

        return results
