import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class MFIStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        length = self.params.get("length", 14)
        oversold = self.params.get("oversold", 20)
        overbought = self.params.get("overbought", 80)

        if "volume" not in df.columns or df["volume"].sum() == 0:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        if len(df) < length + 5:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        mfi = ta.mfi(df["high"], df["low"], df["close"], df["volume"], length=length)
        if mfi is None or len(mfi) < 1:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        current_mfi = mfi.iloc[-1]

        action = SignalAction.HOLD
        confidence = 0.0

        if pd.notna(current_mfi):
            prev_mfi = mfi.iloc[-2] if len(mfi) > 1 else current_mfi

            if current_mfi <= oversold and current_mfi > prev_mfi:
                action = SignalAction.BUY
                confidence = min(1.0, (oversold - current_mfi) / oversold * 0.8 + 0.3)
            elif current_mfi >= overbought and current_mfi < prev_mfi:
                action = SignalAction.SELL
                confidence = min(1.0, (current_mfi - overbought) / (100 - overbought) * 0.8 + 0.3)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={"mfi": float(current_mfi) if pd.notna(current_mfi) else 0},
        )
