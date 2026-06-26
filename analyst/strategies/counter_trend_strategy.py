import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class CounterTrendStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        rsi_period = self.params.get("rsi_period", 7)
        ema_period = self.params.get("ema_period", 20)
        oversold = self.params.get("oversold", 30)
        overbought = self.params.get("overbought", 70)
        min_drop = self.params.get("min_drop_pct", 3)

        if len(df) < ema_period:
            return StrategyResult(strategy_name=self.name, action=SignalAction.HOLD, confidence=0.0)

        rsi = ta.rsi(df["close"], length=rsi_period)
        ema = ta.ema(df["close"], length=ema_period)

        current_rsi = rsi.iloc[-1]
        current_close = df["close"].iloc[-1]
        current_ema = ema.iloc[-1]
        recent_high = df["close"].rolling(10).max().iloc[-1]
        drop_pct = (recent_high - current_close) / recent_high * 100

        action = SignalAction.HOLD
        confidence = 0.0

        if pd.notna(current_rsi) and pd.notna(current_ema):
            if current_rsi <= oversold and current_close < current_ema and drop_pct >= min_drop:
                action = SignalAction.BUY
                confidence = min(1.0, (oversold - current_rsi) / oversold + drop_pct / 20)
            elif current_rsi >= overbought and current_close > current_ema:
                action = SignalAction.SELL
                confidence = min(1.0, (current_rsi - overbought) / (100 - overbought))

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=round(confidence, 4),
            metadata={
                "rsi": float(current_rsi) if pd.notna(current_rsi) else 0,
                "drop_pct": round(drop_pct, 2),
                "below_ema": bool(current_close < current_ema) if pd.notna(current_ema) else False,
            },
        )
