import asyncio
import json
import signal
from datetime import datetime, timezone

from analyst.data_fetcher import DataFetcher
from analyst.indicator_calculator import IndicatorCalculator
from analyst.pair_selector import PairSelector
from analyst.signal_aggregator import SignalAggregator
from analyst.strategy_runner import StrategyRunner
from analyst.strategy_scorer import StrategyScorer
from db.repository import save_signal
from shared.config_loader import ConfigLoader
from shared.logger import get_logger
from shared.redis_client import RedisClient

logger = get_logger(__name__)


class AnalystBot:
    def __init__(
        self,
        config_loader: ConfigLoader,
        redis_client: RedisClient,
    ):
        self.config_loader = config_loader
        self.redis = redis_client
        self.settings = config_loader.load_settings()
        self.strategies_config = config_loader.load_strategies()
        self._running = False

        analyst_cfg = self.settings.get("analyst", {})
        redis_cfg = self.settings.get("redis", {})

        self.data_fetcher = DataFetcher()
        self.pair_selector = PairSelector(
            max_pairs=analyst_cfg.get("max_pairs_to_analyze", 10),
            min_volume_usdt=analyst_cfg.get("min_volume_usdt", 0),
        )
        self.indicator_calculator = IndicatorCalculator(analyst_cfg)
        self.strategy_runner = StrategyRunner(self.strategies_config)
        self.signal_aggregator = SignalAggregator(self.strategies_config)
        self.strategy_scorer = StrategyScorer(
            settings=self.settings,
            strategies_config=self.strategies_config,
            redis=self.redis,
            data_fetcher=self.data_fetcher,
            indicator_calculator=self.indicator_calculator,
        )

        self._tf_actions: dict[str, dict[str, str]] = {}  # {symbol: {tf: action}} for MTF confirmation
        self.timeframes: list[str] = analyst_cfg.get("timeframes", ["15m", "1h", "4h"])
        self.signal_interval = analyst_cfg.get("signal_interval_seconds", 300)
        self.heartbeat_interval = analyst_cfg.get("heartbeat_interval_seconds", 30)
        self.heartbeat_channel = redis_cfg.get("heartbeat_channel", "heartbeat:analyst")
        self.signal_channel = redis_cfg.get("signal_channel", "signals:market")
        self.bot_name = self.settings.get("bot", {}).get("name", "mexc-trading-bot")

    async def start(self) -> None:
        self._running = True
        loop = asyncio.get_running_loop()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))
            except NotImplementedError:
                pass

        print("DEBUG: Connecting to Redis...", flush=True)
        await self.redis.connect()
        print("DEBUG: Redis connected", flush=True)
        logger.info("analyst_bot_started")

        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        signal_task = asyncio.create_task(self._signal_loop())
        scorer_task = asyncio.create_task(self.strategy_scorer.score_loop())

        await asyncio.gather(heartbeat_task, signal_task, scorer_task)

    async def stop(self) -> None:
        self._running = False
        self.strategy_scorer.stop()
        await self.redis.disconnect()
        await self.pair_selector.close()
        logger.info("analyst_bot_stopped")

    async def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                heartbeat_data = {
                    "bot": self.bot_name,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "alive",
                }
                await self.redis.publish_heartbeat(
                    self.heartbeat_channel, heartbeat_data
                )
                try:
                    await self.redis.lpush("heartbeat:analyst", json.dumps(heartbeat_data))
                    await self.redis.ltrim("heartbeat:analyst", 0, 9)
                except Exception:
                    pass
            except Exception as e:
                logger.error("heartbeat_error", error=str(e))
            await asyncio.sleep(self.heartbeat_interval)

    async def _signal_loop(self) -> None:
        while self._running:
            try:
                await self._analyze_and_publish()
            except Exception as e:
                logger.error("signal_cycle_error", error=str(e))
            await asyncio.sleep(self.signal_interval)

    async def _analyze_and_publish(self) -> None:
        dynamic_weights = await self.strategy_scorer.get_dynamic_weights()
        self.signal_aggregator.set_dynamic_weights(dynamic_weights)

        pairs = await self.pair_selector.select_pairs()
        logger.info("analysis_started", pair_count=len(pairs), timeframes=self.timeframes)

        for symbol in pairs:
            for timeframe in self.timeframes:
                await self._process_pair_timeframe(symbol, timeframe)

        logger.info("analysis_completed", pair_count=len(pairs))

    async def _process_pair_timeframe(self, symbol: str, timeframe: str) -> None:
        try:
            df = await self.data_fetcher.fetch_ohlcv(symbol, timeframe)
            if df is None or df.empty:
                logger.warning("no_data", symbol=symbol, timeframe=timeframe)
                return

            current_price = float(df["close"].iloc[-1])
            await self.strategy_scorer.check_accuracy(symbol, timeframe, current_price)

            df = self.indicator_calculator.calculate_all(df)
            if df.empty:
                return

            strategy_results = self.strategy_runner.run_all(df)
            if not strategy_results:
                return

            is_paper = self.settings.get("bot", {}).get("mode", "live") == "paper"
            signal = self.signal_aggregator.aggregate(
                symbol=symbol,
                price=current_price,
                strategy_results=strategy_results,
                paper_mode=is_paper,
            )

            # #21 multi-timeframe confirmation — only emit an actionable signal if >= min_agree
            # timeframes currently vote the same direction for this symbol.
            from shared.models import SignalAction as _SA
            mtf = self.settings.get("analyst", {}).get("mtf_confirmation", {})
            if mtf.get("enabled", False):
                self._tf_actions.setdefault(symbol, {})[timeframe] = signal.action.value
                if signal.action != _SA.HOLD:
                    agree = sum(1 for a in self._tf_actions[symbol].values() if a == signal.action.value)
                    if agree < mtf.get("min_agree", 2):
                        signal.action = _SA.HOLD

            # #29 regime filter — only allow actionable signals in trending markets (ADX >= min).
            rf = self.settings.get("analyst", {}).get("regime_filter", {})
            if rf.get("enabled", False):
                adx_val = float(df["adx"].iloc[-1]) if "adx" in df.columns else 0.0
                if adx_val < rf.get("min_adx", 20):
                    from shared.models import SignalAction as _SA
                    if signal.action != _SA.HOLD:
                        signal.action = _SA.HOLD

            signal_data = signal.model_dump(mode="json")
            signal_data["timeframe"] = timeframe

            await self.redis.publish(self.signal_channel, signal_data)
            try:
                await self.redis.set(f"signal:latest:{symbol}:{timeframe}", json.dumps(signal_data), ttl=3600)
                await self.redis.lpush("signals:recent", json.dumps({**signal_data, "timeframe": timeframe}))
                await self.redis.ltrim("signals:recent", 0, 199)
            except Exception as e:
                logger.error("redis_cache_signal_error", error=str(e))
            try:
                await save_signal(signal, timeframe)
            except Exception as e:
                logger.error("db_save_signal_error", error=str(e))

            await self.strategy_scorer.record_strategy_votes(symbol, timeframe, strategy_results, current_price)

            logger.info(
                "signal_published",
                symbol=symbol,
                timeframe=timeframe,
                action=signal.action.value,
                confidence=round(signal.confidence, 3),
            )
        except Exception as e:
            logger.error(
                "pair_timeframe_error",
                symbol=symbol,
                timeframe=timeframe,
                error=str(e),
            )
