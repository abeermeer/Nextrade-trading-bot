import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class PSARStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        af = self.params.get("af", 0.02)
        max_af = self.params.get("max_af", 0.2)

        if len(df) < 10:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        psar = ta.psar(df["high"], df["low"], df["close"], af=af, max_af=max_af)
        if psar is None or len(psar) < 1:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        psar_col = [c for c in psar.columns if "psar" in c.lower() or "sar" in c.lower()]
        if not psar_col:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        psar_col = psar_col[0]
        current_psar = psar[psar_col].iloc[-1]
        prev_psar = psar[psar_col].iloc[-2] if len(psar) > 1 else current_psar
        current_close = df["close"].iloc[-1]
        prev_close = df["close"].iloc[-2]

        action = SignalAction.HOLD
        confidence = 0.0

        if pd.notna(current_psar):
            above_psar = current_close > current_psar

            if above_psar:
                action = SignalAction.BUY
                confidence = min(1.0, (current_close - current_psar) / current_psar * 20)
            else:
                action = SignalAction.SELL
                confidence = min(1.0, (current_psar - current_close) / current_close * 20)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "psar": float(current_psar) if pd.notna(current_psar) else 0,
                "above_psar": bool(current_close > current_psar) if pd.notna(current_psar) else False,
            },
        )
