import pandas as pd
import pandas_ta as ta
from analyst.strategies.base import BaseStrategy
from shared.models import StrategyResult, SignalAction


class IchimokuStrategy(BaseStrategy):
    def calculate(self, df: pd.DataFrame) -> StrategyResult:
        tenkan_period = self.params.get("tenkan_period", 9)
        kijun_period = self.params.get("kijun_period", 26)
        senkou_span_b_period = self.params.get("senkou_span_b_period", 52)
        displacement = self.params.get("displacement", 26)

        ichimoku = ta.ichimoku(
            df["high"],
            df["low"],
            df["close"],
            tenkan=tenkan_period,
            kijun=kijun_period,
            senkou=senkou_span_b_period,
            offset=displacement,
        )

        if isinstance(ichimoku, tuple):
            ichimoku = ichimoku[0]

        tenkan_col = f"ITS_{tenkan_period}"
        kijun_col = f"IKS_{kijun_period}"

        if tenkan_col not in ichimoku.columns:
            return StrategyResult(
                strategy_name=self.name,
                action=SignalAction.HOLD,
                confidence=0.0,
                metadata={"error": "ichimoku_not_calculated"},
            )

        tenkan = ichimoku[tenkan_col].iloc[-1]
        kijun = ichimoku[kijun_col].iloc[-1]
        current_price = df["close"].iloc[-1]

        buy_signals = 0
        sell_signals = 0

        if tenkan > kijun:
            buy_signals += 1
        elif tenkan < kijun:
            sell_signals += 1

        if current_price > tenkan and current_price > kijun:
            buy_signals += 1
        elif current_price < tenkan and current_price < kijun:
            sell_signals += 1

        senkou_span_a_col = f"ISA_{displacement}"
        senkou_span_b_col = f"ISB_{displacement}"

        if senkou_span_a_col in ichimoku.columns and senkou_span_b_col in ichimoku.columns:
            span_a = ichimoku[senkou_span_a_col].iloc[-1]
            span_b = ichimoku[senkou_span_b_col].iloc[-1]
            cloud_top = max(span_a, span_b) if not pd.isna(span_a) and not pd.isna(span_b) else None
            cloud_bottom = min(span_a, span_b) if not pd.isna(span_a) and not pd.isna(span_b) else None

            if cloud_top is not None and current_price > cloud_top:
                buy_signals += 1
            elif cloud_bottom is not None and current_price < cloud_bottom:
                sell_signals += 1

        total = buy_signals + sell_signals
        if total == 0:
            action = SignalAction.HOLD
            confidence = 0.0
        elif buy_signals > sell_signals:
            action = SignalAction.BUY
            confidence = 0.5 + (buy_signals / max(total, 1)) * 0.3
        else:
            action = SignalAction.SELL
            confidence = 0.5 + (sell_signals / max(total, 1)) * 0.3

        return StrategyResult(
            strategy_name=self.name,
            action=action,
            confidence=min(confidence, 0.9),
            metadata={
                "tenkan": float(tenkan) if not pd.isna(tenkan) else None,
                "kijun": float(kijun) if not pd.isna(kijun) else None,
                "buy_signals": buy_signals,
                "sell_signals": sell_signals,
            },
        )
