import asyncio
import json
import signal
from datetime import datetime, timezone, timedelta
from typing import Optional

from db.repository import save_trade, save_position
from db.database import async_session_factory
from db.models import UserRecord, BotModeDB, TradeTypeDB
from shared.config_loader import ConfigLoader
from shared.logger import get_logger
from shared.models import (
    BotMode,
    Signal,
    SignalAction,
    OrderSide,
    OrderType,
)
from shared.realtime_data import RealtimeDataManager
from shared.redis_client import RedisClient
from trader.paper_engine import PaperEngine
from trader.exchange.base import BaseExchangeClient
from trader.exchange.factory import create_exchange
from trader.risk_manager import RiskManager
from trader.position_tracker import PositionTracker
from trader.notifier import Notifier
from shared.encryption import decrypt

logger = get_logger(__name__)


class UserSession:
    def __init__(self, user: UserRecord):
        self.user_id = user.id
        self.email = user.email
        self.mode = BotMode(user.mode.value)
        self.trade_type = user.trade_type.value
        self.max_position = user.max_position_usdt

        from shared.plan_limits import get_plan_limits
        self.plan = user.plan.value if hasattr(user.plan, 'value') else user.plan
        plan_limits = get_plan_limits(self.plan)

        self.position_tracker = PositionTracker()
        self.risk_manager = RiskManager(
            max_position_size_usdt=user.max_position_usdt,
            max_daily_drawdown_pct=5.0,
            circuit_breaker_drawdown_pct=10.0,
            cooldown_seconds=300,
        )
        self.paper_engine = PaperEngine()
        self.exchange: Optional["BaseExchangeClient"] = None
        self._exchange_created = False

        exchange_name = user.exchange.value if hasattr(user.exchange, 'value') else (user.exchange or "mexc")

        if user.mexc_api_key and user.mexc_api_secret and user.mode == BotModeDB.live:
            try:
                api_key = decrypt(user.mexc_api_key)
                api_secret = decrypt(user.mexc_api_secret)
                self.exchange = create_exchange(
                    exchange_name=exchange_name,
                    api_key=api_key,
                    api_secret=api_secret,
                    use_sandbox=False,
                )
            except Exception as e:
                logger.error("exchange_creation_failed", user=user.id, error=str(e))

    async def validate_exchange(self) -> bool:
        if not self.exchange:
            return False
        try:
            result = await self.exchange.validate_credentials()
            if result.get("spot_ok") or result.get("futures_ok"):
                self._exchange_created = True
                logger.info("exchange_validated", user=self.user_id, spot=result.get("spot_ok"), futures=result.get("futures_ok"))
                return True
            logger.warning("exchange_validation_failed", user=self.user_id, result=result)
            return False
        except Exception as e:
            logger.error("exchange_validation_error", user=self.user_id, error=str(e))
            return False


class TraderBot:
    def __init__(
        self,
        config_loader: ConfigLoader,
        redis_client: RedisClient,
    ):
        self.config_loader = config_loader
        self.redis = redis_client
        self.settings = config_loader.load_settings()
        self._running = False
        self._standby = True
        self._last_heartbeat: Optional[datetime] = None
        self._last_signal_time: Optional[datetime] = None

        trader_cfg = self.settings.get("trader", {})
        bot_cfg = self.settings.get("bot", {})
        redis_cfg = self.settings.get("redis", {})
        exchange_cfg = self.settings.get("exchange", {})

        self.mode = BotMode(bot_cfg.get("mode", "paper"))
        self.signal_channel = redis_cfg.get("signal_channel", "signals:market")
        self.heartbeat_channel = redis_cfg.get("heartbeat_channel", "heartbeat:analyst")
        self.control_channel = "bot:control"
        self.stale_signal_timeout = trader_cfg.get("stale_signal_timeout_seconds", 300)
        self.heartbeat_timeout = 60

        self.sessions: dict[int, UserSession] = {}
        self._realtime: Optional[RealtimeDataManager] = None

        default_key = self.config_loader.get_env("MEXC_API_KEY", "")
        default_secret = self.config_loader.get_env("MEXC_API_SECRET", "")
        if default_key and default_secret:
            self._realtime = RealtimeDataManager(api_key=default_key, api_secret=default_secret)

    def _get_notifier(self) -> Notifier:
        return Notifier(
            telegram_token=self.config_loader.get_env("TELEGRAM_BOT_TOKEN"),
            telegram_chat_id=self.config_loader.get_env("TELEGRAM_CHAT_ID"),
            smtp_host=self.config_loader.get_env("SMTP_HOST"),
            smtp_port=int(self.config_loader.get_env("SMTP_PORT", "587")),
            smtp_user=self.config_loader.get_env("SMTP_USER"),
            smtp_password=self.config_loader.get_env("SMTP_PASSWORD"),
            email_from=self.config_loader.get_env("EMAIL_FROM"),
            email_to=self.config_loader.get_env("EMAIL_TO"),
        )

    async def _refresh_users(self) -> None:
        try:
            async with async_session_factory() as session:
                from sqlalchemy import select
                result = await session.execute(
                    select(UserRecord).where(UserRecord.bot_active == True)
                )
                users = result.scalars().all()
        except Exception as e:
            logger.error("user_refresh_error", error=str(e))
            return

        current_ids = set(self.sessions.keys())
        active_ids = set()

        for u in users:
            active_ids.add(u.id)
            if u.id not in self.sessions:
                session_obj = UserSession(u)
                self.sessions[u.id] = session_obj
                logger.info("user_session_created", user=u.id, email=u.email, mode=u.mode.value)
                if u.mode == BotModeDB.live and u.mexc_keys_verified:
                    asyncio.create_task(session_obj.validate_exchange())

        stale = current_ids - active_ids
        for uid in stale:
            del self.sessions[uid]
            logger.info("user_session_removed", user=uid)

    def _get_session_for_user(self, user_id: int) -> Optional[UserSession]:
        return self.sessions.get(user_id)

    async def _handle_control(self, data: dict) -> None:
        user_id = data.get("user_id")
        action = data.get("action")
        if not user_id:
            return
        try:
            async with async_session_factory() as session:
                from sqlalchemy import select
                result = await session.execute(
                    select(UserRecord).where(UserRecord.id == user_id)
                )
                user = result.scalar_one_or_none()
            if action == "start" and user:
                if user_id not in self.sessions:
                    session_obj = UserSession(user)
                    self.sessions[user_id] = session_obj
                    logger.info("user_session_created_realtime", user=user_id)
                    if user.mode == BotModeDB.live and user.mexc_keys_verified:
                        asyncio.create_task(session_obj.validate_exchange())
            elif action == "stop":
                old = self.sessions.pop(user_id, None)
                if old:
                    if old.exchange and old._exchange_created:
                        await old.exchange.cancel_all_orders()
                        await old.exchange.close()
                    logger.info("user_session_removed_realtime", user=user_id)
                    await self._push_log("info", f"User session removed: {user_id}", user=user_id)
        except Exception as e:
            logger.error("control_handler_error", user=user_id, error=str(e))

    async def _push_log(self, level: str, message: str, **kwargs) -> None:
        try:
            entry = {"level": level, "message": message, "timestamp": datetime.now(timezone.utc).isoformat(), **kwargs}
            await self.redis.lpush("logs:bot", json.dumps(entry))
            await self.redis.ltrim("logs:bot", 0, 99)
        except Exception:
            pass

    async def _on_price_update(self, symbol: str, price: float) -> None:
        for session in self.sessions.values():
            session.position_tracker.update_price(symbol, price)
            await session.paper_engine.update_price(symbol, price)

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

        await self._refresh_users()

        if self._realtime:
            asyncio.create_task(self._realtime.start(
                symbols=["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"],
            ))

        logger.info("trader_bot_started", session_count=len(self.sessions))

        monitor_task = asyncio.create_task(self._monitor_loop())
        asyncio.create_task(self.redis.subscribe(self.control_channel, self._handle_control))
        await self.redis.subscribe(self.signal_channel, self._handle_signal)
        await monitor_task

    async def stop(self) -> None:
        self._running = False
        logger.info("trader_bot_shutting_down")

        for uid, session in self.sessions.items():
            if session.exchange and session._exchange_created:
                try:
                    await session.exchange.cancel_all_orders()
                except Exception as e:
                    logger.error("cancel_orders_error", user=uid, error=str(e))
                for pos in session.position_tracker.get_all_open_positions():
                    try:
                        await session.exchange.create_order(
                            symbol=pos.symbol,
                            side=OrderSide.SELL if pos.side == OrderSide.BUY else OrderSide.BUY,
                            order_type=OrderType.MARKET,
                            quantity=pos.quantity,
                        )
                    except Exception as e:
                        logger.error("close_position_error", user=uid, symbol=pos.symbol, error=str(e))
            elif session.position_tracker.position_count() > 0:
                logger.info("paper_positions_remaining", user=uid, count=session.position_tracker.position_count())

        await self.redis.disconnect()

        for session in self.sessions.values():
            if session.exchange:
                await session.exchange.close()

        if self._realtime:
            await self._realtime.stop()

        logger.info("trader_bot_stopped")

    async def _handle_signal(self, data: dict) -> None:
        try:
            signal = Signal(**data)
        except Exception as e:
            logger.error("invalid_signal", error=str(e), data=data)
            return

        self._last_signal_time = datetime.now(timezone.utc)

        if self._standby:
            self._standby = False
            logger.info("trader_now_active")

        symbol = signal.symbol
        logger.info("signal_received", symbol=symbol, action=signal.action.value, confidence=round(signal.confidence, 3))
        await self._push_log("info", f"Signal: {symbol} {signal.action.value} ({round(signal.confidence*100)}%)", symbol=symbol)

        if signal.action == SignalAction.HOLD:
            return

        for uid, session in list(self.sessions.items()):
            try:
                await self._execute_for_user(session, signal)
            except Exception as e:
                logger.error("user_execution_error", user=uid, error=str(e))

    async def _execute_for_user(self, session: UserSession, signal: Signal) -> None:
        from shared.plan_limits import get_plan_limits, enforce_plan_limit
        symbol = signal.symbol

        plan_limits = get_plan_limits(session.plan)
        if plan_limits.get("spot_only", False) and session.trade_type == "futures":
            logger.warning("plan_spot_only", user=session.user_id, plan=session.plan)
            return

        current_pairs = len(session.position_tracker.get_all_open_positions())
        max_pairs = plan_limits.get("max_pairs", 999)
        if current_pairs >= max_pairs:
            logger.warning("plan_max_pairs_reached", user=session.user_id, plan=session.plan, limit=max_pairs)
            return

        if session.mode == BotMode.PAPER:
            market_prices: dict[str, float] = {symbol: signal.price}
            for sym in session.paper_engine.positions:
                if sym not in market_prices:
                    pos = session.position_tracker.get_open_position(sym)
                    if pos:
                        market_prices[sym] = pos.entry_price
            total_equity = session.paper_engine.get_total_equity(market_prices)
            session.risk_manager.update_balance(total_equity)

        can_trade, reason = session.risk_manager.can_trade(symbol)
        if not can_trade:
            logger.warning("trade_blocked", user=session.user_id, symbol=symbol, reason=reason)
            return

        has_position = session.position_tracker.has_position(symbol)
        if has_position and signal.action == SignalAction.BUY:
            logger.info("already_in_position", user=session.user_id, symbol=symbol)
            return
        if has_position and signal.action == SignalAction.SELL:
            await self._close_position(session, symbol, signal.price, "signal")
            return
        if not has_position and signal.action == SignalAction.BUY:
            await self._open_position(session, symbol, signal.price)
            return

    async def _open_position(self, session: UserSession, symbol: str, price: float) -> None:
        if session.mode == BotMode.PAPER:
            market_prices: dict[str, float] = {symbol: price}
            for sym in session.paper_engine.positions:
                if sym not in market_prices:
                    pos = session.position_tracker.get_open_position(sym)
                    if pos:
                        market_prices[sym] = pos.entry_price
            available = session.paper_engine.get_total_equity(market_prices)
        else:
            available = 10000.0

        quantity = session.risk_manager.calculate_position_size(available, price)
        if quantity <= 0:
            logger.warning("invalid_quantity", user=session.user_id, symbol=symbol)
            return

        sl_pct = 1.5
        tp_pct = 5.0
        stop_loss = price * (1 - sl_pct / 100)
        take_profit = price * (1 + tp_pct / 100)

        if session.mode == BotMode.PAPER:
            order = await session.paper_engine.create_order(
                symbol=symbol, side=OrderSide.BUY, order_type=OrderType.MARKET,
                quantity=quantity, price=price, stop_loss=stop_loss, take_profit=take_profit,
            )
            fill_price = order.average_fill_price
        else:
            if not session.exchange or not session._exchange_created:
                logger.warning("no_exchange_for_user", user=session.user_id)
                return
            market_type = "swap" if session.trade_type == "futures" else "spot"
            if session.trade_type == "futures":
                try:
                    await session.exchange.set_leverage(symbol, 10)
                except Exception:
                    pass
            result = await session.exchange.create_order(
                symbol=symbol, side=OrderSide.BUY, order_type=OrderType.MARKET,
                quantity=quantity, price=price, stop_loss=stop_loss, take_profit=take_profit,
                market=market_type,
            )
            fill_price = float(result.get("price", price))

        pos = session.position_tracker.open_position(
            symbol=symbol, side=OrderSide.BUY, entry_price=fill_price,
            quantity=quantity, stop_loss=stop_loss, take_profit=take_profit,
        )
        session.risk_manager.record_trade(symbol)
        await self._push_log("info", f"BUY {symbol} @ {fill_price} qty={quantity:.4f}", user=session.user_id, symbol=symbol)

        try:
            await save_position(pos, session.mode.value, user_id=session.user_id)
            await save_trade(
                symbol=symbol, side="buy", price=fill_price, quantity=quantity,
                fee=0.001 * fill_price * quantity, mode=session.mode.value, user_id=session.user_id,
            )
        except Exception as e:
            logger.error("db_save_trade_error", error=str(e))

        notifier = self._get_notifier()
        await notifier.send_trade_notification(
            symbol=symbol, action="buy", price=fill_price, quantity=quantity,
        )

    async def _close_position(self, session: UserSession, symbol: str, price: float, reason: str) -> None:
        pos = session.position_tracker.get_open_position(symbol)
        if not pos:
            return

        if session.mode == BotMode.PAPER:
            await session.paper_engine.create_order(
                symbol=symbol, side=OrderSide.SELL, order_type=OrderType.MARKET,
                quantity=pos.quantity, price=price,
            )
            exit_price = price
        else:
            if not session.exchange or not session._exchange_created:
                logger.warning("no_exchange_for_user", user=session.user_id)
                return
            market_type = "swap" if session.trade_type == "futures" else "spot"
            result = await session.exchange.create_order(
                symbol=symbol, side=OrderSide.SELL, order_type=OrderType.MARKET,
                quantity=pos.quantity, market=market_type,
            )
            exit_price = float(result.get("price", price))

        closed = session.position_tracker.close_position(symbol, exit_price, reason)
        if closed:
            await self._push_log("info", f"SELL {symbol} @ {exit_price} pnl={closed.realized_pnl:.2f}", user=session.user_id, symbol=symbol)
            if session.mode == BotMode.PAPER:
                market_prices: dict[str, float] = {}
                for sym in session.paper_engine.positions:
                    p = session.position_tracker.get_open_position(sym)
                    if p:
                        market_prices[sym] = p.entry_price
                total_equity = session.paper_engine.get_total_equity(market_prices)
                session.risk_manager.update_balance(total_equity)
            else:
                session.risk_manager.update_balance(10000.0)

            try:
                await save_trade(
                    symbol=symbol, side="sell", price=exit_price, quantity=pos.quantity,
                    fee=0.001 * exit_price * pos.quantity, pnl=closed.realized_pnl,
                    mode=session.mode.value, user_id=session.user_id,
                )
            except Exception as e:
                logger.error("db_save_trade_error", error=str(e))

            notifier = self._get_notifier()
            await notifier.send_trade_notification(
                symbol=symbol, action="sell", price=exit_price, quantity=pos.quantity, pnl=closed.realized_pnl,
            )

    async def _monitor_loop(self) -> None:
        async def heartbeat_callback(data: dict) -> None:
            self._last_heartbeat = datetime.now(timezone.utc)
            if self._standby:
                logger.info("analyst_heartbeat_received_entering_active")
                self._standby = False

        asyncio.create_task(
            self.redis.subscribe(self.heartbeat_channel, heartbeat_callback)
        )

        refresh_counter = 0

        while self._running:
            now = datetime.now(timezone.utc)
            if self._last_heartbeat and (now - self._last_heartbeat).total_seconds() > self.heartbeat_timeout:
                logger.warning("analyst_heartbeat_lost")
                self._standby = True
            if self._last_signal_time and (now - self._last_signal_time).total_seconds() > self.stale_signal_timeout:
                logger.warning("signals_stale_entering_standby")
                self._standby = True

            refresh_counter += 1
            if refresh_counter >= 4:
                await self._refresh_users()
                refresh_counter = 0

            for session in self.sessions.values():
                if session.mode == BotMode.PAPER and session.paper_engine.positions:
                    market_prices: dict[str, float] = {}
                    for sym in session.paper_engine.positions:
                        p = session.position_tracker.get_open_position(sym)
                        if p:
                            market_prices[sym] = p.entry_price
                    total_equity = session.paper_engine.get_total_equity(market_prices)
                    session.risk_manager.update_balance(total_equity)

            try:
                hb = {"status": "alive", "timestamp": now.isoformat(), "mode": "multi"}
                await self.redis.lpush("heartbeat:trader", json.dumps(hb))
                await self.redis.ltrim("heartbeat:trader", 0, 9)
            except Exception:
                pass

            await asyncio.sleep(15)
