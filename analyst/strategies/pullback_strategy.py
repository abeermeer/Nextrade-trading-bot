import pandas as pd
import numpy as np
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class PullbackStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        lookback = self.params.get("lookback", 20)
        sideways_entry = self.params.get("sideways_entry_pct", 20)
        bear_entry = self.params.get("bear_entry_pct", 30)
        reentry = self.params.get("reentry_pct", 10)

        if len(df) < lookback:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        recent_high = df["close"].rolling(lookback).max().iloc[-1]
        current_close = df["close"].iloc[-1]
        drop_pct = (recent_high - current_close) / recent_high * 100

        action = SignalAction.HOLD
        confidence = 0.0

        if drop_pct >= bear_entry:
            action = SignalAction.BUY
            confidence = min(1.0, drop_pct / bear_entry * 0.9)
        elif drop_pct >= sideways_entry:
            action = SignalAction.BUY
            confidence = min(1.0, drop_pct / sideways_entry * 0.7)
        elif drop_pct >= reentry:
            prev_action = self.params.get("_last_action", "hold")
            if prev_action in ("buy",):
                action = SignalAction.BUY
                confidence = 0.5

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "drop_pct": round(drop_pct, 2),
                "recent_high": round(recent_high, 8),
            },
        )
