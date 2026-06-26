import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class StochRSIStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        length = self.params.get("length", 14)
        rsi_length = self.params.get("rsi_length", 14)
        k = self.params.get("k", 3)
        d = self.params.get("d", 3)
        oversold = self.params.get("oversold", 0.2)
        overbought = self.params.get("overbought", 0.8)

        if len(df) < length + 10:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        stoch = ta.stochrsi(df["close"], length=length, rsi_length=rsi_length, k=k, d=d)
        if stoch is None or len(stoch) < 1:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        stochk = stoch.iloc[-1, 0]
        stochd = stoch.iloc[-1, 1]

        action = SignalAction.HOLD
        confidence = 0.0

        if pd.notna(stochk) and pd.notna(stochd):
            prev_k = stoch.iloc[-2, 0] if len(stoch) > 1 else stochk

            if stochk <= oversold and stochk > prev_k:
                action = SignalAction.BUY
                confidence = min(1.0, (oversold - stochk) / oversold * 0.9 + 0.3)
            elif stochk >= overbought and stochk < prev_k:
                action = SignalAction.SELL
                confidence = min(1.0, (stochk - overbought) / (1 - overbought) * 0.9 + 0.3)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "stoch_k": float(stochk) if pd.notna(stochk) else 0,
                "stoch_d": float(stochd) if pd.notna(stochd) else 0,
            },
        )
