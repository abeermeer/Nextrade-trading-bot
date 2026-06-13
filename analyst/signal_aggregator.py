from datetime import datetime, timezone
from shared.models import Signal, SignalAction, StrategyResult
from shared.logger import get_logger

logger = get_logger(__name__)

ACTION_SCORE = {
    SignalAction.BUY: 1.0,
    SignalAction.SELL: -1.0,
    SignalAction.HOLD: 0.0,
}


class SignalAggregator:
    def __init__(self, config: dict):
        self.config = config
        resolution = config.get("signal_resolution", {})
        self.mode = resolution.get("mode", "weighted")
        self.confidence_threshold = resolution.get("confidence_threshold", 0.6)
        self.min_signals_required = resolution.get("min_signals_required", 2)
        self.strict_overrides: list[str] = resolution.get("strict_overrides", [])

    def aggregate(
        self,
        symbol: str,
        price: float,
        strategy_results: list[StrategyResult],
    ) -> Signal:
        if len(strategy_results) < self.min_signals_required:
            return Signal(
                symbol=symbol,
                action=SignalAction.HOLD,
                confidence=0.0,
                price=price,
                timestamp=datetime.now(timezone.utc),
                strategy_results=strategy_results,
                metadata={"reason": f"only {len(strategy_results)} strategies ran"},
            )

        if self.mode == "strict":
            return self._strict_aggregate(symbol, price, strategy_results)
        elif self.mode == "majority":
            return self._majority_aggregate(symbol, price, strategy_results)
        else:
            return self._weighted_aggregate(symbol, price, strategy_results)

    def _strict_aggregate(
        self, symbol: str, price: float, results: list[StrategyResult]
    ) -> Signal:
        for r in results:
            if r.action == SignalAction.SELL and r.confidence >= self.confidence_threshold:
                logger.info(
                    "strict_override_sell",
                    symbol=symbol,
                    strategy=r.strategy_name,
                )
                return Signal(
                    symbol=symbol,
                    action=SignalAction.SELL,
                    confidence=r.confidence,
                    price=price,
                    timestamp=datetime.now(timezone.utc),
                    strategy_results=results,
                )

        return self._weighted_aggregate(symbol, price, results)

    def _majority_aggregate(
        self, symbol: str, price: float, results: list[StrategyResult]
    ) -> Signal:
        buys = sum(1 for r in results if r.action == SignalAction.BUY and r.confidence >= self.confidence_threshold)
        sells = sum(1 for r in results if r.action == SignalAction.SELL and r.confidence >= self.confidence_threshold)

        if buys > sells:
            action = SignalAction.BUY
        elif sells > buys:
            action = SignalAction.SELL
        else:
            action = SignalAction.HOLD

        avg_confidence = sum(r.confidence for r in results) / len(results) if results else 0.0

        logger.info(
            "majority_result",
            symbol=symbol,
            buys=buys,
            sells=sells,
            action=action.value,
        )

        return Signal(
            symbol=symbol,
            action=action,
            confidence=avg_confidence,
            price=price,
            timestamp=datetime.now(timezone.utc),
            strategy_results=results,
        )

    def _weighted_aggregate(
        self, symbol: str, price: float, results: list[StrategyResult]
    ) -> Signal:
        total_score = 0.0
        total_weight = 0.0

        for r in results:
            weight = r.confidence
            total_score += ACTION_SCORE[r.action] * weight
            total_weight += weight

        if total_weight == 0:
            return Signal(
                symbol=symbol,
                action=SignalAction.HOLD,
                confidence=0.0,
                price=price,
                timestamp=datetime.now(timezone.utc),
                strategy_results=results,
            )

        normalized = total_score / total_weight

        if normalized > 0.2:
            action = SignalAction.BUY
        elif normalized < -0.2:
            action = SignalAction.SELL
        else:
            action = SignalAction.HOLD

        confidence = min(abs(normalized), 1.0)

        logger.info(
            "weighted_result",
            symbol=symbol,
            score=round(normalized, 3),
            action=action.value,
            confidence=round(confidence, 3),
        )

        return Signal(
            symbol=symbol,
            action=action,
            confidence=confidence,
            price=price,
            timestamp=datetime.now(timezone.utc),
            strategy_results=results,
        )
