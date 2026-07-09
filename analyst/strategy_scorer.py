import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

import pandas as pd

from shared.logger import get_logger
from shared.models import SignalAction

logger = get_logger(__name__)

PERIOD_DAYS = {"5d": 5, "14d": 14, "1mo": 30, "2mo": 60, "3mo": 90}


class StrategyScorer:
    def __init__(self, settings: dict, strategies_config: dict, redis, data_fetcher, indicator_calculator):
        self.settings = settings
        self.strategies_config = strategies_config
        self.redis = redis
        self.data_fetcher = data_fetcher
        self.indicator_calculator = indicator_calculator

        scorer_cfg = settings.get("analyst", {}).get("scorer", {})
        self.enabled = scorer_cfg.get("enabled", True)
        self.backtest_interval_hours = scorer_cfg.get("backtest_interval_hours", 6)
        self.backtest_pairs = scorer_cfg.get("backtest_pairs", ["BTC/USDT", "ETH/USDT", "SOL/USDT"])
        self.backtest_period = scorer_cfg.get("backtest_period", "1mo")
        self.backtest_timeframes = scorer_cfg.get("backtest_timeframes", ["1h"])
        self.accuracy_weight = scorer_cfg.get("accuracy_weight", 0.3)
        self.backtest_weight = scorer_cfg.get("backtest_weight", 0.7)
        wf = scorer_cfg.get("walk_forward", {})
        self.wf_enabled = wf.get("enabled", False)
        self.wf_train_frac = wf.get("train_frac", 0.5)  # first fraction = in-sample warmup (not scored)

        self._running = False

    async def record_strategy_votes(self, symbol: str, timeframe: str, strategy_results: list, current_price: float) -> None:
        if not self.enabled:
            return
        votes = {}
        for r in strategy_results:
            if r.action != SignalAction.HOLD:
                votes[r.strategy_name] = r.action.value
        if not votes:
            return
        key = f"signal:prev_votes:{symbol}:{timeframe}"
        data = {"price": current_price, "timestamp": datetime.now(timezone.utc).isoformat(), "votes": votes}
        await self.redis.set(key, json.dumps(data), ttl=3600)

    async def check_accuracy(self, symbol: str, timeframe: str, current_price: float) -> None:
        if not self.enabled:
            return
        key = f"signal:prev_votes:{symbol}:{timeframe}"
        raw = await self.redis.get(key)
        if not raw:
            return
        try:
            prev = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return

        prev_price = prev.get("price")
        votes = prev.get("votes", {})
        if not prev_price or not votes:
            return

        change_pct = (current_price - prev_price) / prev_price if prev_price else 0
        if change_pct > 0.001:
            correct_action = "buy"
        elif change_pct < -0.001:
            correct_action = "sell"
        else:
            return

        for strategy_name, voted_action in votes.items():
            is_correct = 1 if voted_action == correct_action else 0
            acc_key = f"strategy:accuracy:{strategy_name}:{symbol}:{timeframe}"
            raw_acc = await self.redis.get(acc_key)
            acc = {"correct": 0, "total": 0}
            if raw_acc:
                try:
                    acc = json.loads(raw_acc)
                except (json.JSONDecodeError, TypeError):
                    pass
            acc["correct"] += is_correct
            acc["total"] += 1
            await self.redis.set(acc_key, json.dumps(acc), ttl=86400)

            global_key = f"strategy:accuracy:{strategy_name}"
            raw_global = await self.redis.get(global_key)
            gacc = {"correct": 0, "total": 0}
            if raw_global:
                try:
                    gacc = json.loads(raw_global)
                except (json.JSONDecodeError, TypeError):
                    pass
            gacc["correct"] += is_correct
            gacc["total"] += 1
            await self.redis.set(global_key, json.dumps(gacc), ttl=86400)

        await self.redis.set(key, json.dumps({}), ttl=60)

    async def run_backtest_scores(self) -> None:
        if not self.enabled:
            return

        last_run_raw = await self.redis.get("strategy:backtest:last_run")
        if last_run_raw:
            try:
                last_run = datetime.fromisoformat(last_run_raw)
                elapsed = datetime.now(timezone.utc) - last_run
                if elapsed < timedelta(hours=self.backtest_interval_hours):
                    return
            except (ValueError, TypeError):
                pass

        logger.info("scorer_backtest_started")
        strategies = self.strategies_config.get("strategies", {})
        strategies_to_test = {k: v for k, v in strategies.items() if v.get("enabled", True)}

        all_scores: dict[str, list[dict]] = {name: [] for name in strategies_to_test}

        for pair in self.backtest_pairs:
            for tf in self.backtest_timeframes:
                for name in strategies_to_test:
                    try:
                        score = await self._backtest_single_strategy(pair, tf, name)
                        if score:
                            all_scores[name].append(score)
                            logger.info("scorer_backtest_result", strategy=name, symbol=pair, timeframe=tf, **score)
                    except Exception as e:
                        logger.error("scorer_backtest_error", strategy=name, symbol=pair, timeframe=tf, error=str(e))

        for name, scores in all_scores.items():
            if not scores:
                continue
            avg_score = {
                k: sum(s.get(k, 0) for s in scores) / len(scores)
                for k in ["sharpe", "win_rate", "pnl_pct", "composite"]
            }
            avg_score["total_trades"] = sum(s.get("total_trades", 0) for s in scores)
            avg_score["last_run"] = datetime.now(timezone.utc).isoformat()
            await self.redis.set(f"strategy:backtest:{name}", json.dumps(avg_score), ttl=86400)

        await self.redis.set("strategy:backtest:last_run", datetime.now(timezone.utc).isoformat())
        logger.info("scorer_backtest_completed")
        await self._blend_and_publish_weights()

    async def _backtest_single_strategy(self, symbol: str, timeframe: str, strategy_name: str) -> Optional[dict]:
        from analyst.strategy_runner import STRATEGY_MAP

        strategy_cfg = self.strategies_config.get("strategies", {}).get(strategy_name)
        if not strategy_cfg:
            return None

        strategy_class = STRATEGY_MAP.get(strategy_name)
        if not strategy_class:
            return None

        days = PERIOD_DAYS.get(self.backtest_period, 30)
        since_ms = int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp() * 1000)
        df = await self.data_fetcher.fetch_ohlcv_since(symbol, timeframe, since_ms, limit=1000)
        if df is None or df.empty:
            return None

        df = self.indicator_calculator.calculate_all(df)
        if df.empty:
            return None

        balance = 10000.0
        peak_balance = balance
        min_balance = balance
        trades = 0
        wins = 0
        losses = 0
        in_position = False
        entry_price = 0.0
        entry_qty = 0.0

        # Walk-forward: use the first train_frac of bars only to warm up indicators/state,
        # and score trades on the held-out out-of-sample tail — reduces overfitting.
        warmup = int(len(df) * self.wf_train_frac) if self.wf_enabled else 0
        for i in range(len(df)):
            if i < warmup:
                continue
            row = df.iloc[: i + 1].copy()
            price = float(row["close"].iloc[-1])

            strategy = strategy_class(name=strategy_name, weight=1.0, params=strategy_cfg.get("params", {}))
            result = strategy.calculate(row)
            if result.action == SignalAction.HOLD:
                continue

            if not in_position and result.action == SignalAction.BUY:
                size = min(balance * 0.1, 1000.0)
                qty = size / price if price > 0 else 0
                if qty <= 0:
                    continue
                entry_price = price
                entry_qty = qty
                balance -= size
                in_position = True

            elif in_position and result.action == SignalAction.SELL:
                proceeds = entry_qty * price
                balance += proceeds
                pnl = proceeds - (entry_qty * entry_price)
                trades += 1
                if pnl > 0:
                    wins += 1
                else:
                    losses += 1
                in_position = False

            if balance > peak_balance:
                peak_balance = balance
            if balance < min_balance:
                min_balance = balance

        if in_position:
            final_price = float(df["close"].iloc[-1])
            proceeds = entry_qty * final_price
            balance += proceeds
            pnl = proceeds - (entry_qty * entry_price)
            trades += 1
            if pnl > 0:
                wins += 1
            else:
                losses += 1

        total_pnl = balance - 10000.0
        total_pnl_pct = (total_pnl / 10000.0) * 100
        max_drawdown = max(0, (peak_balance - min_balance) / peak_balance * 100) if peak_balance > 0 else 0
        win_rate = (wins / trades * 100) if trades > 0 else 0

        returns = df["close"].pct_change().dropna()
        sharpe = 0
        if len(returns) > 0 and returns.std() > 0:
            sharpe = (total_pnl_pct / 100.0) / (returns.std() * (252 ** 0.5)) * 252 if total_pnl_pct != 0 else 0

        norm_sharpe = max(0, min(1, (sharpe + 2) / 4))
        norm_win_rate = win_rate / 100.0
        norm_pnl = max(0, min(1, (total_pnl_pct + 20) / 40))
        composite = 0.5 * norm_sharpe + 0.3 * norm_win_rate + 0.2 * norm_pnl

        return {
            "sharpe": round(sharpe, 2),
            "win_rate": round(win_rate, 1),
            "pnl_pct": round(total_pnl_pct, 2),
            "max_drawdown_pct": round(max_drawdown, 2),
            "total_trades": trades,
            "composite": round(composite, 4),
        }

    async def _blend_and_publish_weights(self) -> None:
        strategies = self.strategies_config.get("strategies", {})
        base_weights: dict[str, float] = {}
        for name, cfg in strategies.items():
            if cfg.get("enabled", True):
                base_weights[name] = cfg.get("weight", 0.15)

        if not base_weights:
            return

        backtest_scores: dict[str, float] = {}
        for name in base_weights:
            raw = await self.redis.get(f"strategy:backtest:{name}")
            if raw:
                try:
                    data = json.loads(raw)
                    backtest_scores[name] = data.get("composite", 0.5)
                except (json.JSONDecodeError, TypeError):
                    pass

        accuracy_scores: dict[str, float] = {}
        for name in base_weights:
            raw = await self.redis.get(f"strategy:accuracy:{name}")
            if raw:
                try:
                    data = json.loads(raw)
                    total = data.get("total", 0)
                    if total > 0:
                        accuracy_scores[name] = data.get("correct", 0) / total
                except (json.JSONDecodeError, TypeError):
                    pass

        max_backtest = max(backtest_scores.values()) if backtest_scores else 1.0
        max_accuracy = max(accuracy_scores.values()) if accuracy_scores else 1.0

        dynamic_weights: dict[str, float] = {}
        for name, base_w in base_weights.items():
            bt_score = backtest_scores.get(name, 0.5) / max_backtest if max_backtest > 0 else 0.5
            acc_score = accuracy_scores.get(name, 0.5) / max_accuracy if max_accuracy > 0 else 0.5

            has_bt = name in backtest_scores
            has_acc = name in accuracy_scores

            if has_bt and has_acc:
                blended = self.backtest_weight * bt_score + self.accuracy_weight * acc_score
            elif has_bt:
                blended = bt_score
            elif has_acc:
                blended = acc_score
            else:
                blended = 1.0

            dynamic_weights[name] = base_w * blended

        total_dyn = sum(dynamic_weights.values())
        if total_dyn > 0:
            for name in dynamic_weights:
                dynamic_weights[name] = round(dynamic_weights[name] / total_dyn, 4)

        await self.redis.set("strategy:weights:dynamic", json.dumps(dynamic_weights), ttl=86400)
        logger.info("scorer_weights_published", count=len(dynamic_weights))

    async def get_dynamic_weights(self) -> dict[str, float]:
        raw = await self.redis.get("strategy:weights:dynamic")
        if raw:
            try:
                return json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                pass
        return {}

    async def score_loop(self) -> None:
        if not self.enabled:
            logger.info("scorer_disabled")
            return
        self._running = True
        logger.info("scorer_loop_started")
        while self._running:
            try:
                await self.run_backtest_scores()
            except Exception as e:
                logger.error("scorer_cycle_error", error=str(e))
            await asyncio.sleep(self.backtest_interval_hours * 3600)

    def stop(self) -> None:
        self._running = False
