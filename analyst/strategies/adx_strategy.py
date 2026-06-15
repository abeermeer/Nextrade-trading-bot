import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class ADXStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        period = self.params.get("period", 14)
        threshold = self.params.get("threshold", 25)

        adx_df = ta.adx(df["high"], df["low"], df["close"], length=period)
        adx_col = f"ADX_{period}"
        di_plus_col = f"DMP_{period}"
        di_minus_col = f"DMN_{period}"

        if adx_col not in adx_df.columns:
            return StrategyResult(
                strategy_name=self.name,
                action=SignalAction.HOLD,
                confidence=0.0,
                metadata={"error": "adx_not_calculated"},
            )

        adx_val = adx_df[adx_col].iloc[-1]
        di_plus = adx_df[di_plus_col].iloc[-1]
        di_minus = adx_df[di_minus_col].iloc[-1]

        if adx_val < threshold:
            return StrategyResult(
                strategy_name=self.name,
                action=SignalAction.HOLD,
                confidence=0.0,
                metadata={"adx": float(adx_val)},
            )

        if di_plus > di_minus:
            action = SignalAction.BUY
            confidence = min(0.5 + (adx_val - threshold) / 50, 0.85)
        else:
            action = SignalAction.SELL
            confidence = min(0.5 + (adx_val - threshold) / 50, 0.85)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=confidence,
            metadata={
                "adx": float(adx_val),
                "di_plus": float(di_plus),
                "di_minus": float(di_minus),
            },
        )
