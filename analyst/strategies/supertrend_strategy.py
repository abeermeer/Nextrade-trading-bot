import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class SupertrendStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        period = self.params.get("period", 10)
        multiplier = self.params.get("multiplier", 3.0)

        supertrend = ta.supertrend(
            df["high"], df["low"], df["close"], length=period, multiplier=multiplier
        )
        trend_col = f"SUPERTd_{period}_{multiplier}.0"
        if trend_col not in supertrend.columns:
            return StrategyResult(
                strategy_name=self.name,
                action=SignalAction.HOLD,
                confidence=0.0,
                metadata={"error": "supertrend_not_calculated"},
            )

        prev_trend = supertrend[trend_col].iloc[-2]
        curr_trend = supertrend[trend_col].iloc[-1]

        if prev_trend == -1 and curr_trend == 1:
            action = SignalAction.BUY
            confidence = 0.7
        elif prev_trend == 1 and curr_trend == -1:
            action = SignalAction.SELL
            confidence = 0.7
        else:
            action = SignalAction.HOLD
            confidence = 0.0

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=confidence,
            metadata={"trend": int(curr_trend)},
        )
