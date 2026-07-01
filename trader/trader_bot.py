import asyncio
import json
import os
import signal
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from db.repository import save_trade, save_position
from db.database import async_session_factory
from db.models import UserRecord, BotModeDB, TradeTypeDB, TradeRecord
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

FAILED_TRADES_KEY = "failed_trades:pending"
FAILED_TRADES_DEAD_KEY = "failed_trades:dead"
MAX_TRADE_RETRIES = 10


async def _push_failed_trade(redis: Optional[RedisClient], trade_kwargs: dict) -> None:
    """Dead-letter a save_trade payload that failed to persist, so a background
    retry loop can re-attempt the DB write. A live order that filled but never
    hit the ledger is a silent money-losing gap — never drop it."""
    if redis is None:
        logger.error("dlq_no_redis_trade_lost", symbol=trade_kwargs.get("symbol"))
        return
    try:
        payload = dict(trade_kwargs)
        payload["failed_at"] = datetime.now(timezone.utc).isoformat()
        payload["attempts"] = 0
        await redis.rpush(FAILED_TRADES_KEY, json.dumps(payload, default=str))
        logger.warning("trade_dead_lettered", symbol=trade_kwargs.get("symbol"))
    except Exception as e:
        logger.error("dlq_push_failed", error=str(e), symbol=trade_kwargs.get("symbol"))


class UserSession:
    def __init__(self, user: UserRecord, redis_client: Optional[RedisClient] = None):
        self.user_id = user.id
        self.email = user.email
        self.redis = redis_client
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
                use_sandbox = os.getenv("EXCHANGE_SANDBOX", "false").lower() in ("true", "1", "yes")
                self.exchange = create_exchange(
                    exchange_name=exchange_name,
                    api_key=api_key,
                    api_secret=api_secret,
                    use_sandbox=use_sandbox,
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
                try:
                    await self.exchange.load_markets()
                    logger.info("markets_loaded", user=self.user_id)
                except Exception as e:
                    logger.warning("markets_load_error", user=self.user_id, error=str(e))
                await self.recover_positions()
                # Seed the risk manager from the REAL balance as soon as keys are
                # validated in live mode, so the circuit-breaker baseline matches the
                # actual account (not the $10k default) and small balances can trade.
                try:
                    market_type = "swap" if self.trade_type == "futures" else "spot"
                    bal = await self.exchange.fetch_balance(market_type)
                    real_bal = max(bal.get("free_usdt", 0) or 0, bal.get("total_usdt", 0) or 0)
                    if real_bal > 0:
                        self.risk_manager.update_balance(real_bal)
                        logger.info("risk_baseline_seeded", user=self.user_id, balance=real_bal)
                except Exception as e:
                    logger.warning("risk_baseline_seed_failed", user=self.user_id, error=str(e))
                return True
            logger.warning("exchange_validation_failed", user=self.user_id, result=result)
            return False
        except Exception as e:
            logger.error("exchange_validation_error", user=self.user_id, error=str(e))
            return False

    async def recover_positions(self) -> None:
        if not self.exchange or not self._exchange_created:
            return
        try:
            market_type = "swap" if self.trade_type == "futures" else "spot"
            positions = await self.exchange.fetch_positions(market_type)
            for pos in positions:
                symbol = pos.get("symbol")
                side_raw = pos.get("side", "long")
                contracts = float(pos.get("contracts", 0) or pos.get("size", 0))
                entry = float(pos.get("entryPrice", 0) or pos.get("entry_price", 0))
                if not symbol or contracts <= 0 or entry <= 0:
                    continue
                if self.position_tracker.has_position(symbol):
                    continue
                side = OrderSide.BUY if side_raw in ("long", "buy") else OrderSide.SELL
                stop_loss = float(pos.get("stopLoss", 0) or pos.get("stop_loss", 0)) or None
                take_profit = float(pos.get("takeProfit", 0) or pos.get("take_profit", 0)) or None
                self.position_tracker.open_position(
                    symbol=symbol, side=side, entry_price=entry,
                    quantity=contracts, stop_loss=stop_loss, take_profit=take_profit,
                )
                logger.info("position_recovered", user=self.user_id, symbol=symbol, side=side.value, qty=contracts, price=entry)
            recovered = len([p for p in positions if float(p.get("contracts", 0) or p.get("size", 0)) > 0])
            if recovered:
                logger.info("positions_recovered", user=self.user_id, count=recovered)
        except Exception as e:
            logger.error("position_recovery_error", user=self.user_id, error=str(e))

    async def reconcile_positions(self) -> None:
        if not self.exchange or not self._exchange_created:
            return
        try:
            market_type = "swap" if self.trade_type == "futures" else "spot"
            exchange_positions = await self.exchange.fetch_positions(market_type)
            exchange_symbols = set()
            for pos in exchange_positions:
                symbol = pos.get("symbol")
                contracts = float(pos.get("contracts", 0) or pos.get("size", 0))
                if symbol and contracts > 0:
                    exchange_symbols.add(symbol)
            local_symbols = set(self.position_tracker.get_all_open_symbols())
            closed_by_exchange = local_symbols - exchange_symbols
            for symbol in closed_by_exchange:
                logger.warning("position_closed_by_exchange", user=self.user_id, symbol=symbol)
                pos = self.position_tracker.get_open_position(symbol)
                if pos:
                    exit_price = pos.current_price or pos.entry_price
                    self.position_tracker.close_position(symbol, exit_price, "exchange_closed")
                    logger.info("position_reconciled_closed", user=self.user_id, symbol=symbol, price=exit_price, pnl=pos.realized_pnl)
                    # exchange-side close (SL/TP fired on the exchange) — no order id from our side,
                    # pass None explicitly so the ledger shows this was not a bot-initiated sell.
                    trade_kwargs = dict(
                        symbol=symbol, side="sell", price=exit_price, quantity=pos.quantity,
                        fee=0.001 * exit_price * pos.quantity, pnl=pos.realized_pnl,
                        mode=self.mode.value, user_id=self.user_id, exchange_order_id=None,
                    )
                    try:
                        await save_trade(**trade_kwargs)
                    except Exception as e:
                        logger.error("db_save_trade_error_reconciliation", user=self.user_id, symbol=symbol, error=str(e))
                        await _push_failed_trade(self.redis, trade_kwargs)
            new_on_exchange = exchange_symbols - local_symbols
            for symbol in new_on_exchange:
                logger.info("position_found_on_exchange", user=self.user_id, symbol=symbol)
            await self.recover_positions()
        except Exception as e:
            logger.error("position_reconciliation_error", user=self.user_id, error=str(e))


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
        self._last_known_balance: dict[int, float] = {}
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
                session_obj = UserSession(u, redis_client=self.redis)
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
                    session_obj = UserSession(user, redis_client=self.redis)
                    self.sessions[user_id] = session_obj
                    logger.info("user_session_created_realtime", user=user_id)
                    if user.mode == BotModeDB.live and user.mexc_keys_verified:
                        asyncio.create_task(session_obj.validate_exchange())
            elif action == "flatten":
                summary = await self.flatten_user(user_id)
                logger.info("flatten_command_handled", user=user_id, closed=len(summary.get("closed", [])))
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
            closed = await session.paper_engine.update_price(symbol, price)
            if closed:
                pos = session.position_tracker.get_open_position(symbol)
                if pos:
                    session.position_tracker.close_position(symbol, price, "sl_tp")
                    pnl = pos.realized_pnl
                    logger.info("paper_position_closed_by_sltp", user=session.user_id, symbol=symbol, price=price, pnl=pnl)
                    trade_kwargs = dict(
                        symbol=symbol, side="sell", price=price, quantity=pos.quantity,
                        fee=0.001 * price * pos.quantity, pnl=pnl,
                        mode=session.mode.value, user_id=session.user_id, exchange_order_id=None,
                    )
                    try:
                        await save_trade(**trade_kwargs)
                    except Exception as e:
                        logger.error("db_save_trade_error_sltp", user=session.user_id, symbol=symbol, error=str(e))
                        await _push_failed_trade(self.redis, trade_kwargs)

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
                symbols=["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
                         "ADA/USDT", "DOGE/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT",
                         "MATIC/USDT", "UNI/USDT", "SHIB/USDT", "LTC/USDT", "ATOM/USDT",
                         "ETC/USDT", "XLM/USDT", "FIL/USDT", "TRX/USDT", "NEAR/USDT"],
            ))

        logger.info("trader_bot_started", session_count=len(self.sessions))

        monitor_task = asyncio.create_task(self._monitor_loop())
        asyncio.create_task(self._retry_failed_trades_loop())
        asyncio.create_task(self._daily_ledger_recon_loop())
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
        live_conf_threshold = self.settings.get("signal_resolution", {}).get("confidence_threshold", 0.5)
        live_min_signals = self.settings.get("signal_resolution", {}).get("min_signals_required", 2)
        if signal.confidence < live_conf_threshold:
            logger.info("signal_below_live_threshold", symbol=symbol, confidence=round(signal.confidence, 3), threshold=live_conf_threshold)

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

        can_trade, reason = session.risk_manager.can_trade(symbol, open_symbols=session.position_tracker.get_all_open_symbols())
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

    async def _validate_order(self, session: UserSession, symbol: str, quantity: float, price: float) -> bool:
        notional = quantity * price
        if notional < 0.5:  # TEMP live-test: $5->$0.50 floor (revert)
            logger.warning("order_below_min_notional", user=session.user_id, symbol=symbol, notional=notional)
            return False
        open_count = session.position_tracker.position_count()
        hard_cap = 50
        if open_count >= hard_cap:
            logger.warning("hard_cap_reached", user=session.user_id, symbol=symbol, count=open_count, cap=hard_cap)
            return False
        return True

    async def _get_live_balance(self, session: UserSession) -> float:
        if not session.exchange or not session._exchange_created:
            return 0.0
        try:
            market_type = "swap" if session.trade_type == "futures" else "spot"
            bal = await session.exchange.fetch_balance(market_type)
            free_usdt = bal.get("free_usdt", 0)
            total_usdt = bal.get("total_usdt", 0)
            balance = max(free_usdt, total_usdt)
            self._last_known_balance[session.user_id] = balance
            return balance
        except Exception as e:
            logger.error("balance_fetch_error", user=session.user_id, error=str(e))
            return self._last_known_balance.get(session.user_id, 0.0)

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
            available = await self._get_live_balance(session)

        quantity = session.risk_manager.calculate_position_size(available, price)
        if quantity <= 0:
            logger.warning("invalid_quantity", user=session.user_id, symbol=symbol)
            return

        if not await self._validate_order(session, symbol, quantity, price):
            return

        sl_pct = 1.5
        tp_pct = 5.0
        stop_loss = price * (1 - sl_pct / 100)
        if stop_loss <= 0:
            stop_loss = 0.0
        take_profit = price * (1 + tp_pct / 100)

        if session.mode == BotMode.PAPER:
            order = await session.paper_engine.create_order(
                symbol=symbol, side=OrderSide.BUY, order_type=OrderType.MARKET,
                quantity=quantity, price=price, stop_loss=stop_loss, take_profit=take_profit,
            )
            fill_price = order.average_fill_price
            exchange_order_id = getattr(order, "id", None)
            fee_amount = 0.001 * fill_price * quantity
        else:
            if not session.exchange or not session._exchange_created:
                logger.warning("no_exchange_for_user", user=session.user_id)
                return
            market_type = "swap" if session.trade_type == "futures" else "spot"
            if session.trade_type == "futures":
                trader_cfg = self.settings.get("trader", {})
                leverage = trader_cfg.get("leverage", 10)

                # #5 Funding-rate guard — avoid opening into an expensive funding interval
                funding_max = trader_cfg.get("funding_rate_max_abs", 0.001)
                funding_block = trader_cfg.get("funding_rate_block", False)
                funding_rate = await session.exchange.fetch_funding_rate(symbol)
                if funding_rate is not None and abs(funding_rate) > funding_max:
                    if funding_block:
                        logger.error("funding_rate_too_high_aborting", user=session.user_id, symbol=symbol, funding_rate=funding_rate, threshold=funding_max)
                        await self._push_log("warning", f"Skip {symbol}: funding {funding_rate*100:.3f}% over limit", user=session.user_id, symbol=symbol)
                        return
                    logger.warning("funding_rate_high", user=session.user_id, symbol=symbol, funding_rate=funding_rate, threshold=funding_max)

                # #1 Leverage abort — set_leverage returns False on failure; never trade at unknown leverage
                leverage_ok = await session.exchange.set_leverage(symbol, leverage)
                if not leverage_ok:
                    logger.error("set_leverage_failed_aborting_trade", user=session.user_id, symbol=symbol, leverage=leverage)
                    await self._push_log("error", f"Aborted {symbol}: could not set leverage {leverage}x", user=session.user_id, symbol=symbol)
                    return

                # #6 Liquidation-distance guard — stop-loss must trigger before liquidation
                if trader_cfg.get("liquidation_guard_enabled", True) and leverage > 1 and price > 0:
                    maint = trader_cfg.get("maintenance_margin_pct", 0.005)
                    liq_price = price * (1 - (1 / leverage) + maint)
                    sl_distance = abs(price - stop_loss) / price
                    liq_distance = abs(price - liq_price) / price
                    if sl_distance >= liq_distance:
                        logger.error("sl_beyond_liquidation_aborting", user=session.user_id, symbol=symbol, leverage=leverage, stop_loss=stop_loss, liq_price=liq_price, sl_distance=round(sl_distance, 4), liq_distance=round(liq_distance, 4))
                        await self._push_log("error", f"Aborted {symbol}: stop-loss beyond liquidation at {leverage}x", user=session.user_id, symbol=symbol)
                        return
            client_id = str(uuid.uuid4())
            result = await session.exchange.create_order(
                symbol=symbol, side=OrderSide.BUY, order_type=OrderType.MARKET,
                quantity=quantity, price=price, stop_loss=stop_loss, take_profit=take_profit,
                market=market_type, client_order_id=client_id,
            )
            fill_price = float(result.get("price", price))
            exchange_order_id = str(result.get("id", "")) or None
            fee_info = result.get("fee") if isinstance(result, dict) else None
            fee_amount = float(fee_info.get("cost", 0)) if isinstance(fee_info, dict) and fee_info.get("cost") else 0.001 * fill_price * quantity

        pos = session.position_tracker.open_position(
            symbol=symbol, side=OrderSide.BUY, entry_price=fill_price,
            quantity=quantity, stop_loss=stop_loss, take_profit=take_profit,
        )
        session.risk_manager.record_trade(symbol)
        await self._push_log("info", f"BUY {symbol} @ {fill_price} qty={quantity:.4f}", user=session.user_id, symbol=symbol)

        trade_kwargs = dict(
            symbol=symbol, side="buy", price=fill_price, quantity=quantity,
            fee=fee_amount, mode=session.mode.value, user_id=session.user_id,
            exchange_order_id=exchange_order_id,
        )
        try:
            await save_position(pos, session.mode.value, user_id=session.user_id)
            await save_trade(**trade_kwargs)
        except Exception as e:
            logger.error("db_save_trade_error", error=str(e))
            await _push_failed_trade(self.redis, trade_kwargs)

        notifier = self._get_notifier()
        await notifier.send_trade_notification(
            symbol=symbol, action="buy", price=fill_price, quantity=quantity,
        )

    async def _close_position(self, session: UserSession, symbol: str, price: float, reason: str) -> None:
        pos = session.position_tracker.get_open_position(symbol)
        if not pos:
            return

        if session.mode == BotMode.PAPER:
            order = await session.paper_engine.create_order(
                symbol=symbol, side=OrderSide.SELL, order_type=OrderType.MARKET,
                quantity=pos.quantity, price=price,
            )
            exit_price = price
            exchange_order_id = getattr(order, "id", None)
            sell_fee = 0.001 * exit_price * pos.quantity
        else:
            if not session.exchange or not session._exchange_created:
                logger.warning("no_exchange_for_user", user=session.user_id)
                return
            market_type = "swap" if session.trade_type == "futures" else "spot"
            client_id = str(uuid.uuid4())
            result = await session.exchange.create_order(
                symbol=symbol, side=OrderSide.SELL, order_type=OrderType.MARKET,
                quantity=pos.quantity, market=market_type, client_order_id=client_id,
            )
            exit_price = float(result.get("price", price))
            exchange_order_id = str(result.get("id", "")) or None
            fee_info = result.get("fee") if isinstance(result, dict) else None
            sell_fee = float(fee_info.get("cost", 0)) if isinstance(fee_info, dict) and fee_info.get("cost") else 0.001 * exit_price * pos.quantity

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
                live_bal = await self._get_live_balance(session)
                session.risk_manager.update_balance(live_bal)

            trade_kwargs = dict(
                symbol=symbol, side="sell", price=exit_price, quantity=pos.quantity,
                fee=sell_fee, pnl=closed.realized_pnl,
                mode=session.mode.value, user_id=session.user_id,
                exchange_order_id=exchange_order_id,
            )
            try:
                await save_trade(**trade_kwargs)
            except Exception as e:
                logger.error("db_save_trade_error", error=str(e))
                await _push_failed_trade(self.redis, trade_kwargs)

            notifier = self._get_notifier()
            await notifier.send_trade_notification(
                symbol=symbol, action="sell", price=exit_price, quantity=pos.quantity, pnl=closed.realized_pnl,
            )

    async def _retry_failed_trades_loop(self) -> None:
        """Re-attempt DB writes for trades that failed to persist (dead-letter queue).
        A filled order that never reached the ledger must never be silently dropped."""
        while self._running:
            try:
                count = await self.redis.llen(FAILED_TRADES_KEY)
                for _ in range(count):
                    raw = await self.redis.lpop(FAILED_TRADES_KEY)
                    if not raw:
                        break
                    try:
                        payload = json.loads(raw)
                    except Exception:
                        continue
                    attempts = int(payload.pop("attempts", 0))
                    payload.pop("failed_at", None)
                    try:
                        await save_trade(**payload)
                        logger.info("failed_trade_recovered", symbol=payload.get("symbol"), attempts=attempts)
                    except Exception as e:
                        attempts += 1
                        if attempts >= MAX_TRADE_RETRIES:
                            logger.error("failed_trade_exhausted_dead_letter", symbol=payload.get("symbol"), attempts=attempts, error=str(e))
                            await self.redis.rpush(FAILED_TRADES_DEAD_KEY, json.dumps({**payload, "attempts": attempts, "last_error": str(e)}, default=str))
                        else:
                            payload["attempts"] = attempts
                            await self.redis.rpush(FAILED_TRADES_KEY, json.dumps(payload, default=str))
            except Exception as e:
                logger.error("retry_failed_trades_loop_error", error=str(e))
            await asyncio.sleep(30)

    async def _daily_ledger_recon_loop(self) -> None:
        """Once per UTC day (persisted across restarts), reconcile each live user's
        exchange trade history against the local ledger. Detect-and-alert only."""
        while self._running:
            try:
                today = datetime.now(timezone.utc).date().isoformat()
                last = await self.redis.get("ledger_recon:last_run_date")
                if last != today:
                    await self.redis.set("ledger_recon:last_run_date", today)
                    await self._run_ledger_reconciliation()
            except Exception as e:
                logger.error("daily_ledger_recon_error", error=str(e))
            await asyncio.sleep(3600)

    async def _run_ledger_reconciliation(self) -> None:
        from sqlalchemy import select
        start_of_yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        since_ms = int(start_of_yesterday.timestamp() * 1000)
        total_mismatch = 0
        for uid, session in list(self.sessions.items()):
            if session.mode != BotMode.LIVE or not session.exchange or not session._exchange_created:
                continue
            try:
                market_type = "spot" if session.trade_type == "spot" else "swap"
                exchange_trades = await session.exchange.fetch_my_trades(since=since_ms, market=market_type)
                # match on order id — our ledger stores exchange_order_id (the order id, not fill id)
                exchange_ids = {str(t.get("order")) for t in exchange_trades if t.get("order")}
                if not exchange_ids:
                    continue
                async with async_session_factory() as db:
                    result = await db.execute(
                        select(TradeRecord.exchange_order_id).where(
                            TradeRecord.user_id == uid,
                            TradeRecord.created_at >= start_of_yesterday.replace(tzinfo=None),
                        )
                    )
                    db_ids = {str(r[0]) for r in result.all() if r[0]}
                missing_in_db = exchange_ids - db_ids
                if missing_in_db:
                    total_mismatch += len(missing_in_db)
                    logger.error("ledger_mismatch_detected", user=uid, missing_count=len(missing_in_db), missing_ids=list(missing_in_db)[:20])
                    await self._push_log("error", f"Ledger mismatch user {uid}: {len(missing_in_db)} exchange trades missing from DB", user=uid)
            except Exception as e:
                logger.error("ledger_recon_user_error", user=uid, error=str(e))
        try:
            snapshot = {"mismatch_count": total_mismatch, "checked_at": datetime.now(timezone.utc).isoformat()}
            await self.redis.set("ledger_health", json.dumps(snapshot))
        except Exception:
            pass
        logger.info("ledger_reconciliation_complete", total_mismatch=total_mismatch)

    async def flatten_user(self, user_id: int) -> dict:
        """Kill switch: cancel all open orders and market-close every open position
        for one user. Returns a summary of what was actioned."""
        session = self.sessions.get(user_id)
        if not session:
            logger.warning("flatten_no_session", user=user_id)
            return {"user_id": user_id, "found": False, "cancelled_orders": False, "closed": [], "errors": ["no active session"]}

        summary = {"user_id": user_id, "found": True, "cancelled_orders": False, "closed": [], "errors": []}

        if session.exchange and session._exchange_created:
            try:
                await session.exchange.cancel_all_orders()
                summary["cancelled_orders"] = True
                logger.info("flatten_orders_cancelled", user=user_id)
            except Exception as e:
                summary["errors"].append(f"cancel_all_orders: {e}")
                logger.error("flatten_cancel_error", user=user_id, error=str(e))

        for symbol in list(session.position_tracker.get_all_open_symbols()):
            pos = session.position_tracker.get_open_position(symbol)
            if not pos:
                continue
            try:
                # _close_position places the live sell order (live mode) or closes the
                # paper position, and records the trade — one path, no double orders.
                await self._close_position(session, symbol, pos.current_price or pos.entry_price, "flatten")
                summary["closed"].append(symbol)
                logger.info("flatten_position_closed", user=user_id, symbol=symbol)
            except Exception as e:
                summary["errors"].append(f"{symbol}: {e}")
                logger.error("flatten_close_error", user=user_id, symbol=symbol, error=str(e))

        await self._push_log("warning", f"FLATTEN executed for user {user_id}: closed {len(summary['closed'])} positions", user=user_id)
        try:
            await self.redis.set(f"flatten_result:{user_id}", json.dumps(summary, default=str), ttl=3600)
        except Exception:
            pass
        return summary

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
                elif session.mode == BotMode.LIVE and session.exchange and session._exchange_created:
                    live_bal = await self._get_live_balance(session)
                    session.risk_manager.update_balance(live_bal)
                    await session.reconcile_positions()

            try:
                hb = {"status": "alive", "timestamp": now.isoformat(), "mode": "multi"}
                await self.redis.lpush("heartbeat:trader", json.dumps(hb))
                await self.redis.ltrim("heartbeat:trader", 0, 9)
            except Exception:
                pass

            try:
                for uid, session_obj in self.sessions.items():
                    bal = session_obj.risk_manager._last_balance
                    if bal is not None:
                        snapshot = {
                            "user_id": uid,
                            "balance": bal,
                            "open_positions": session_obj.position_tracker.position_count(),
                            "total_realized_pnl": session_obj.position_tracker.get_total_realized_pnl(),
                            "timestamp": now.isoformat(),
                        }
                        await self.redis.lpush(f"balance_snapshots:{uid}", json.dumps(snapshot))
                        await self.redis.ltrim(f"balance_snapshots:{uid}", 0, 999)
            except Exception:
                pass

            await asyncio.sleep(15)
