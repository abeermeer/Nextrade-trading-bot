import asyncio
import json
import signal
from datetime import datetime, timezone

from analyst.data_fetcher import DataFetcher
from analyst.indicator_calculator import IndicatorCalculator
from analyst.pair_selector import PairSelector
from analyst.signal_aggregator import SignalAggregator
from analyst.strategy_runner import StrategyRunner
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
        )
        self.indicator_calculator = IndicatorCalculator(analyst_cfg)
        self.strategy_runner = StrategyRunner(self.strategies_config)
        self.signal_aggregator = SignalAggregator(self.strategies_config)

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

        await asyncio.gather(heartbeat_task, signal_task)

    async def stop(self) -> None:
        self._running = False
        await self.redis.disconnect()
        await self.pair_selector.close()
        logger.info("analyst_bot_stopped")

    async def _heartbeat_loop(self) -> None:
        while self._running:
            try:
                await self.redis.publish_heartbeat(
                    self.heartbeat_channel,
                    {
                        "bot": self.bot_name,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "status": "alive",
                    },
                )
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

            df = self.indicator_calculator.calculate_all(df)
            if df.empty:
                return

            strategy_results = self.strategy_runner.run_all(df)
            if not strategy_results:
                return

            current_price = float(df["close"].iloc[-1])
            signal = self.signal_aggregator.aggregate(
                symbol=symbol,
                price=current_price,
                strategy_results=strategy_results,
            )

            signal_data = signal.model_dump(mode="json")
            signal_data["timeframe"] = timeframe

            await self.redis.publish(self.signal_channel, signal_data)
            try:
                await self.redis.set(f"signal:latest:{symbol}:{timeframe}", json.dumps(signal_data), ttl=3600)
                await self.redis.rpush("signals:recent", json.dumps({**signal_data, "timeframe": timeframe}))
                await self.redis.ltrim("signals:recent", 0, 199)
            except Exception as e:
                logger.error("redis_cache_signal_error", error=str(e))
            try:
                await save_signal(signal, timeframe)
            except Exception as e:
                logger.error("db_save_signal_error", error=str(e))

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
