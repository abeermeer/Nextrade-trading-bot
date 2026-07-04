import pytest
from datetime import datetime, timezone

from shared.models import OrderSide, OrderType, SignalAction, StrategyResult, Signal
from trader.paper_engine import PaperEngine, PaperOrder
from trader.risk_manager import RiskManager
from trader.position_tracker import PositionTracker


class TestPaperEngine:
    @pytest.mark.asyncio
    async def test_market_buy_fills_immediately(self):
        engine = PaperEngine(initial_balance_usdt=10000.0)
        order = await engine.create_order(
            symbol="BTC/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=0.1,
            price=50000.0,
        )
        assert order.status.value == "filled"
        assert order.filled_quantity == 0.1
        assert engine.balance < 10000.0

    @pytest.mark.asyncio
    async def test_insufficient_balance_partial_fill(self):
        engine = PaperEngine(initial_balance_usdt=100.0)
        order = await engine.create_order(
            symbol="BTC/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=10.0,
            price=50000.0,
        )
        assert order.status.value == "filled"
        assert order.quantity < 10.0  # partially filled within balance
        assert engine.balance >= 0

    @pytest.mark.asyncio
    async def test_stop_loss_triggers(self):
        engine = PaperEngine(initial_balance_usdt=10000.0)
        await engine.create_order(
            symbol="BTC/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=0.1,
            price=50000.0,
            stop_loss=49000.0,
        )
        assert "BTC/USDT" in engine.positions
        await engine.update_price("BTC/USDT", 48000.0)
        assert "BTC/USDT" not in engine.positions

    @pytest.mark.asyncio
    async def test_take_profit_triggers(self):
        engine = PaperEngine(initial_balance_usdt=10000.0)
        await engine.create_order(
            symbol="ETH/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=1.0,
            price=3000.0,
            take_profit=3200.0,
        )
        assert "ETH/USDT" in engine.positions
        await engine.update_price("ETH/USDT", 3300.0)
        assert "ETH/USDT" not in engine.positions

    @pytest.mark.asyncio
    async def test_sell_closes_position(self):
        engine = PaperEngine(initial_balance_usdt=10000.0)
        await engine.create_order(
            symbol="SOL/USDT",
            side=OrderSide.BUY,
            order_type=OrderType.MARKET,
            quantity=5.0,
            price=100.0,
        )
        assert "SOL/USDT" in engine.positions
        await engine.create_order(
            symbol="SOL/USDT",
            side=OrderSide.SELL,
            order_type=OrderType.MARKET,
            quantity=5.0,
            price=110.0,
        )
        assert "SOL/USDT" not in engine.positions
        assert len(engine.closed_positions) == 1


class TestRiskManager:
    def test_can_trade_returns_true_initially(self):
        rm = RiskManager()
        can, reason = rm.can_trade("BTC/USDT")
        assert can is True
        assert reason == "ok"

    def test_cooldown_blocks_duplicate_trade(self):
        rm = RiskManager(cooldown_seconds=3600)
        rm.record_trade("BTC/USDT")
        can, reason = rm.can_trade("BTC/USDT")
        assert can is False
        assert "Cooldown" in reason

    def test_different_symbol_not_blocked_by_cooldown(self):
        rm = RiskManager(cooldown_seconds=3600)
        rm.record_trade("BTC/USDT")
        can, reason = rm.can_trade("ETH/USDT")
        assert can is True

    def test_circuit_breaker_activates(self):
        rm = RiskManager(circuit_breaker_drawdown_pct=10.0, initial_balance=10000.0)
        rm.update_balance(10000.0)
        rm.update_balance(8500.0)
        can, reason = rm.can_trade("BTC/USDT")
        assert can is False
        assert "circuit breaker" in reason.lower()

    def test_daily_drawdown_blocks_trading(self):
        rm = RiskManager(max_daily_drawdown_pct=5.0, initial_balance=10000.0)
        rm.update_balance(10000.0)
        rm.update_balance(9300.0)
        can, reason = rm.can_trade("BTC/USDT")
        assert can is False
        assert "drawdown" in reason.lower()

    def test_position_size_calculation(self):
        rm = RiskManager(max_position_size_usdt=1000.0)
        qty = rm.calculate_position_size(5000.0, 50000.0)
        assert qty == 0.02  # min(1000, 5000*0.2=1000) = 1000 / 50000 = 0.02

    def test_position_size_limited_by_max(self):
        rm = RiskManager(max_position_size_usdt=1000.0)
        qty = rm.calculate_position_size(100000.0, 50000.0)
        assert qty == 0.02  # 1000 / 50000, not 10000/50000


class TestPositionTracker:
    def test_open_position(self):
        tracker = PositionTracker()
        pos = tracker.open_position(
            symbol="BTC/USDT",
            side=OrderSide.BUY,
            entry_price=50000.0,
            quantity=0.1,
        )
        assert pos.symbol == "BTC/USDT"
        assert pos.unrealized_pnl == 0.0
        assert tracker.position_count() == 1

    def test_update_price_calculates_pnl(self):
        tracker = PositionTracker()
        tracker.open_position("BTC/USDT", OrderSide.BUY, 50000.0, 0.1)
        tracker.update_price("BTC/USDT", 51000.0)
        pos = tracker.get_open_position("BTC/USDT")
        assert pos.unrealized_pnl == 100.0  # (51000 - 50000) * 0.1

    def test_close_position(self):
        tracker = PositionTracker()
        tracker.open_position("BTC/USDT", OrderSide.BUY, 50000.0, 0.1)
        closed = tracker.close_position("BTC/USDT", 51000.0)
        assert closed.realized_pnl == 100.0
        assert tracker.position_count() == 0
        assert tracker.get_total_realized_pnl() == 100.0

    def test_has_position(self):
        tracker = PositionTracker()
        assert tracker.has_position("BTC/USDT") is False
        tracker.open_position("BTC/USDT", OrderSide.BUY, 50000.0, 0.1)
        assert tracker.has_position("BTC/USDT") is True
