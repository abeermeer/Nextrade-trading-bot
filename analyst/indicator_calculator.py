import pandas as pd
import pandas_ta as ta
from shared.logger import get_logger

logger = get_logger(__name__)


class IndicatorCalculator:
    def __init__(self, config: dict):
        self.config = config
        self.indicator_periods: dict = config.get("indicator_periods", {})

    def calculate_all(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df

        df = df.copy()

        self._add_rsi(df)
        self._add_macd(df)
        self._add_ema(df)
        self._add_bollinger(df)
        self._add_volume_ma(df)

        df.dropna(inplace=True)
        return df

    def _add_rsi(self, df: pd.DataFrame) -> None:
        period = self.indicator_periods.get("rsi", 14)
        df["rsi"] = ta.rsi(df["close"], length=period)

    def _add_macd(self, df: pd.DataFrame) -> None:
        fast = self.indicator_periods.get("macd_fast", 12)
        slow = self.indicator_periods.get("macd_slow", 26)
        signal = self.indicator_periods.get("macd_signal", 9)

        macd = ta.macd(df["close"], fast=fast, slow=slow, signal=signal)
        if macd is not None:
            df["macd"] = macd.iloc[:, 0]
            df["macd_signal"] = macd.iloc[:, 1]
            df["macd_histogram"] = macd.iloc[:, 2]

    def _add_ema(self, df: pd.DataFrame) -> None:
        short = self.indicator_periods.get("ema_short", 9)
        long = self.indicator_periods.get("ema_long", 21)
        df["ema_short"] = ta.ema(df["close"], length=short)
        df["ema_long"] = ta.ema(df["close"], length=long)

    def _add_bollinger(self, df: pd.DataFrame) -> None:
        period = self.indicator_periods.get("bollinger_period", 20)
        std = self.indicator_periods.get("bollinger_std", 2)

        bbands = ta.bbands(df["close"], length=period, std=std)
        if bbands is not None:
            df["bb_upper"] = bbands.iloc[:, 0]
            df["bb_mid"] = bbands.iloc[:, 1]
            df["bb_lower"] = bbands.iloc[:, 2]
            df["bb_bandwidth"] = bbands.iloc[:, 3]
            df["bb_percent"] = bbands.iloc[:, 4]

    def _add_volume_ma(self, df: pd.DataFrame) -> None:
        period = self.indicator_periods.get("volume_ma_period", 20)
        df["volume_ma"] = ta.sma(df["volume"], length=period)
