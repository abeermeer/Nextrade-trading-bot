"""Tests for the live-trading safety hardening (audit fixes #1-#6)."""
import json
import pytest

from shared.models import OrderSide, BotMode
from trader.risk_manager import RiskManager
from trader.position_tracker import PositionTracker
from trader.paper_engine import PaperEngine
from trader.trader_bot import TraderBot, UserSession, _push_failed_trade, FAILED_TRADES_KEY
from trader.exchange.mexc_client import MEXCClient


# --- Fakes -----------------------------------------------------------------

class FakeCcxt:
    def __init__(self, raises=False):
        self._raises = raises
        self.leverage_calls = []

    async def set_leverage(self, leverage, symbol):
        if self._raises:
            raise RuntimeError("exchange rejected leverage")
        self.leverage_calls.append((leverage, symbol))


class FakeRedis:
    def __init__(self):
        self.lists = {}

    async def lpush(self, key, value):
        self.lists.setdefault(key, []).insert(0, value)

    async def rpush(self, key, value):
        self.lists.setdefault(key, []).append(value)

    async def ltrim(self, key, start, stop):
        pass


class FakeExchange:
    def __init__(self, leverage_ok=True, funding_rate=None):
        self._leverage_ok = leverage_ok
        self._funding_rate = funding_rate
        self.create_order_called = False

    async def fetch_balance(self, market="spot"):
        return {"free_usdt": 10000.0, "total_usdt": 10000.0, "used_usdt": 0.0}

    async def fetch_funding_rate(self, symbol):
        return self._funding_rate

    async def set_leverage(self, symbol, leverage, market="swap"):
        return self._leverage_ok

    async def create_order(self, **kwargs):
        self.create_order_called = True
        return {"id": "x", "price": kwargs.get("price", 0)}


def _live_futures_session():
    sess = UserSession.__new__(UserSession)
    sess.user_id = 1
    sess.mode = BotMode.LIVE
    sess.trade_type = "futures"
    sess.risk_manager = RiskManager()
    sess.position_tracker = PositionTracker()
    sess.paper_engine = PaperEngine()
    sess._exchange_created = True
    sess.redis = FakeRedis()
    return sess


def _bot(settings):
    bot = TraderBot.__new__(TraderBot)
    bot.settings = settings
    bot.redis = FakeRedis()
    bot._last_known_balance = {}
    return bot


# --- #1 leverage returns bool ---------------------------------------------

class TestSetLeverageBool:
    @pytest.mark.asyncio
    async def test_returns_true_on_success(self):
        client = MEXCClient(api_key="k", api_secret="s")
        fake = FakeCcxt(raises=False)
        client._get_futures = lambda: _coro(fake)
        assert await client.set_leverage("BTC/USDT", 10) is True

    @pytest.mark.asyncio
    async def test_returns_false_on_failure(self):
        client = MEXCClient(api_key="k", api_secret="s")
        fake = FakeCcxt(raises=True)
        client._get_futures = lambda: _coro(fake)
        assert await client.set_leverage("BTC/USDT", 10) is False


async def _coro(val):
    return val


# --- #1 leverage abort in _open_position ----------------------------------

class TestLeverageAbort:
    @pytest.mark.asyncio
    async def test_aborts_and_places_no_order_when_leverage_fails(self):
        bot = _bot({"trader": {"leverage": 10}})
        sess = _live_futures_session()
        sess.exchange = FakeExchange(leverage_ok=False)
        await bot._open_position(sess, "BTC/USDT", 50000.0)
        assert sess.exchange.create_order_called is False
        assert sess.position_tracker.position_count() == 0


# --- #6 liquidation guard --------------------------------------------------

class TestLiquidationGuard:
    @pytest.mark.asyncio
    async def test_aborts_when_stop_loss_beyond_liquidation(self):
        # leverage 100 => liq_distance = 1/100 - 0.005 = 0.005; sl 1.5% = 0.015 >= 0.005 -> abort
        bot = _bot({"trader": {"leverage": 100, "maintenance_margin_pct": 0.005, "liquidation_guard_enabled": True}})
        sess = _live_futures_session()
        sess.exchange = FakeExchange(leverage_ok=True)
        await bot._open_position(sess, "BTC/USDT", 50000.0)
        assert sess.exchange.create_order_called is False


# --- #5 funding-rate block -------------------------------------------------

class TestFundingGuard:
    @pytest.mark.asyncio
    async def test_blocks_when_funding_over_limit_and_block_enabled(self):
        bot = _bot({"trader": {"leverage": 10, "funding_rate_max_abs": 0.001, "funding_rate_block": True}})
        sess = _live_futures_session()
        sess.exchange = FakeExchange(leverage_ok=True, funding_rate=0.05)  # 5% >> limit
        await bot._open_position(sess, "BTC/USDT", 50000.0)
        assert sess.exchange.create_order_called is False


# --- #2 dead-letter queue --------------------------------------------------

class TestDeadLetter:
    @pytest.mark.asyncio
    async def test_push_failed_trade_enqueues_payload(self):
        redis = FakeRedis()
        kwargs = dict(symbol="BTC/USDT", side="buy", price=50000.0, quantity=0.1,
                      fee=0.5, mode="live", user_id=7, exchange_order_id="abc")
        await _push_failed_trade(redis, kwargs)
        queued = redis.lists[FAILED_TRADES_KEY]
        assert len(queued) == 1
        payload = json.loads(queued[0])
        assert payload["symbol"] == "BTC/USDT"
        assert payload["attempts"] == 0
        assert "failed_at" in payload

    @pytest.mark.asyncio
    async def test_push_failed_trade_no_redis_does_not_raise(self):
        await _push_failed_trade(None, {"symbol": "ETH/USDT"})  # must not throw


# --- #3 flatten no-session path -------------------------------------------

class TestFlattenNoSession:
    @pytest.mark.asyncio
    async def test_returns_not_found_when_no_session(self):
        bot = _bot({"trader": {}})
        bot.sessions = {}
        result = await bot.flatten_user(999)
        assert result["found"] is False
        assert result["closed"] == []


# --- Risk baseline seeding (small live balance) ---------------------------

class TestRiskBaselineSeeding:
    def test_small_live_balance_does_not_trip_circuit_breaker(self):
        # default initial_balance=10000; a $6 balance must NOT read as a drawdown
        rm = RiskManager()
        rm.update_balance(6.0)
        can, reason = rm.can_trade("BTC/USDT")
        assert can is True, reason

    def test_drawdown_still_protects_relative_to_real_balance(self):
        rm = RiskManager(circuit_breaker_drawdown_pct=10.0)
        rm.update_balance(6.0)   # baseline seeded to real $6
        rm.update_balance(5.0)   # 5 <= 6*0.9 -> breaker trips
        can, reason = rm.can_trade("BTC/USDT")
        assert can is False
        assert "ircuit" in reason
