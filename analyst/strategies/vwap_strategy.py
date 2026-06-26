import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class VWAPStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        deviation = self.params.get("deviation", 1.0)
        lookback = self.params.get("lookback", 50)

        if "volume" not in df.columns or df["volume"].sum() == 0:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        if len(df) < 30:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        vwap = ta.vwap(df["high"], df["low"], df["close"], df["volume"])
        if vwap is None or len(vwap) < 1:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        current_vwap = vwap.iloc[-1]
        current_close = df["close"].iloc[-1]
        prev_vwap = vwap.iloc[-2] if len(vwap) > 1 else current_vwap

        action = SignalAction.HOLD
        confidence = 0.0

        if pd.notna(current_vwap):
            pct_from_vwap = (current_close - current_vwap) / current_vwap * 100
            ema = ta.ema(df["close"], length=20)
            current_ema = ema.iloc[-1] if ema is not None else None

            below_vwap = current_close < current_vwap
            above_vwap = current_close > current_vwap
            vwap_rising = current_vwap > prev_vwap
            below_ema = current_ema is not None and current_close < current_ema if pd.notna(current_ema) else False

            if below_vwap and below_ema:
                action = SignalAction.BUY
                confidence = min(1.0, abs(pct_from_vwap) / deviation * 0.8)
            elif above_vwap and not vwap_rising:
                action = SignalAction.SELL
                confidence = min(1.0, abs(pct_from_vwap) / deviation * 0.8)

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "vwap": float(current_vwap) if pd.notna(current_vwap) else 0,
                "pct_from_vwap": round(pct_from_vwap, 2),
            },
        )
