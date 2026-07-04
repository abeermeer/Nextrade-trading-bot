from datetime import datetime, date, timedelta, timezone
from typing import Optional
from shared.logger import get_logger

logger = get_logger(__name__)

CORRELATION_GROUPS: dict[str, set[str]] = {
    "btc_eth": {"BTC/USDT", "ETH/USDT", "BTCUSDT", "ETHUSDT"},
    "major_l1": {"SOL/USDT", "BNB/USDT", "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT",
                 "SOLUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "AVAXUSDT", "DOTUSDT"},
    "defi": {"UNI/USDT", "LINK/USDT", "AAVE/USDT", "CRV/USDT", "UNIUSDT", "LINKUSDT", "AAVEUSDT", "CRVUSDT"},
    "meme": {"DOGE/USDT", "SHIB/USDT", "PEPE/USDT", "DOGEUSDT", "SHIBUSDT", "PEPEUSDT"},
    "infra": {"LTC/USDT", "ATOM/USDT", "FIL/USDT", "NEAR/USDT", "TRX/USDT",
              "LTCUSDT", "ATOMUSDT", "FILUSDT", "NEARUSDT", "TRXUSDT"},
}


def _get_correlation_group(symbol: str) -> Optional[str]:
    for group_name, members in CORRELATION_GROUPS.items():
        if symbol in members:
            return group_name
    return None


class RiskManager:
    def __init__(
        self,
        max_position_size_usdt: float = 1000.0,
        max_daily_drawdown_pct: float = 5.0,
        circuit_breaker_drawdown_pct: float = 10.0,
        cooldown_seconds: int = 300,
        initial_balance: float = 10000.0,
        max_correlation_exposure: int = 2,
    ):
        self.max_position_size_usdt = max_position_size_usdt
        self.max_daily_drawdown_pct = max_daily_drawdown_pct
        self.circuit_breaker_drawdown_pct = circuit_breaker_drawdown_pct
        self.cooldown_seconds = cooldown_seconds
        self.initial_balance = initial_balance
        self.max_correlation_exposure = max_correlation_exposure
        self.peak_balance = initial_balance
        self._circuit_breaker_active = False
        self._cooldowns: dict[str, datetime] = {}
        self._daily_start_balance: Optional[float] = None
        self._daily_peak: Optional[float] = None
        self._current_date: Optional[date] = None
        self._last_balance: Optional[float] = None

    def _check_date_reset(self) -> None:
        today = datetime.now(timezone.utc).date()
        if self._current_date != today:
            self._current_date = today
            self._daily_start_balance = None
            self._daily_peak = None

    def update_balance(self, current_balance: float) -> None:
        self._check_date_reset()
        # First observed balance seeds the baseline (peak + initial) from the REAL
        # account balance. Otherwise a small live balance (e.g. $6) is measured
        # against the constructor default ($10k) and instantly trips the circuit
        # breaker as a fake ~99% drawdown, blocking every trade.
        if self._last_balance is None:
            self.initial_balance = current_balance
            self.peak_balance = current_balance
        self._last_balance = current_balance
        if self._daily_start_balance is None:
            self._daily_start_balance = current_balance
        if self._daily_peak is None or current_balance > self._daily_peak:
            self._daily_peak = current_balance
        if current_balance > self.peak_balance:
            self.peak_balance = current_balance
        if current_balance <= self.peak_balance * (1 - self.circuit_breaker_drawdown_pct / 100):
            self._circuit_breaker_active = True
            logger.warning(
                "circuit_breaker_activated",
                peak=self.peak_balance,
                current=current_balance,
                threshold=self.circuit_breaker_drawdown_pct,
            )
        else:
            self._circuit_breaker_active = False

    def can_trade(self, symbol: str, open_symbols: Optional[set[str]] = None) -> tuple[bool, str]:
        now = datetime.now(timezone.utc)

        if self._circuit_breaker_active:
            return False, "Circuit breaker active — drawdown limit exceeded"

        self._check_date_reset()
        if self._last_balance is not None and self._daily_start_balance is not None:
            daily_pnl_pct = (
                (self._last_balance - self._daily_start_balance)
                / self._daily_start_balance
                * 100
            )
            if daily_pnl_pct < -self.max_daily_drawdown_pct:
                return False, f"Daily drawdown limit reached: {daily_pnl_pct:.1f}%"

        last_trade = self._cooldowns.get(symbol)
        if last_trade and (now - last_trade).total_seconds() < self.cooldown_seconds:
            remaining = self.cooldown_seconds - (now - last_trade).total_seconds()
            return False, f"Cooldown active for {symbol}: {remaining:.0f}s remaining"

        if open_symbols and self.max_correlation_exposure > 0:
            symbol_group = _get_correlation_group(symbol)
            if symbol_group:
                group_count = sum(1 for s in open_symbols if _get_correlation_group(s) == symbol_group)
                if group_count >= self.max_correlation_exposure:
                    return False, f"Correlation cap reached for group '{symbol_group}': {group_count} positions (max {self.max_correlation_exposure})"

        return True, "ok"

    def calculate_position_size(self, balance: float, price: float) -> float:
        # 20% of balance per trade — 10% left tiny accounts (~$50) below the $5 min-notional
        # floor (and MEXC's own futures minimum), so no order ever cleared.
        size = min(self.max_position_size_usdt, balance * 0.2)
        quantity = size / price
        logger.debug(
            "position_size_calculated",
            balance=balance,
            price=price,
            size=size,
            qty=round(quantity, 6),
        )
        return quantity

    def record_trade(self, symbol: str) -> None:
        self._cooldowns[symbol] = datetime.now(timezone.utc)

    def reset_circuit_breaker(self) -> None:
        self._circuit_breaker_active = False
        logger.info("circuit_breaker_reset")
