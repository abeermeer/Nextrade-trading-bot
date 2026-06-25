import pandas as pd
import numpy as np
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class RangeStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        lookback = self.params.get("lookback", 30)
        range_threshold = self.params.get("range_threshold", 0.10)
        oversold_pct = self.params.get("oversold_pct", 20)
        overbought_pct = self.params.get("overbought_pct", 80)

        if len(df) < lookback:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        recent = df["close"].tail(lookback)
        high = recent.max()
        low = recent.min()
        current = recent.iloc[-1]

        range_width = (high - low) / low

        if range_width > range_threshold * 2:
            return StrategyResult(
                strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0,
                metadata={"range_width_pct": round(range_width * 100, 2), "in_range": False},
            )

        position = (current - low) / (high - low) * 100 if high != low else 50

        action = SignalAction.HOLD
        confidence = 0.0

        if position <= oversold_pct:
            action = SignalAction.BUY
            confidence = min(1.0, (oversold_pct - position) / oversold_pct * 0.8 + 0.2)
        elif position >= overbought_pct:
            action = SignalAction.SELL
            confidence = min(1.0, (position - overbought_pct) / (100 - overbought_pct) * 0.8 + 0.2)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "range_width_pct": round(range_width * 100, 2),
                "position_in_range_pct": round(position, 1),
                "in_range": True,
            },
        )
