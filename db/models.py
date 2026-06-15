from datetime import datetime
from sqlalchemy import Boolean, Column, String, Float, DateTime, Enum, JSON, Integer
from sqlalchemy.orm import DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


class SignalActionDB(str, enum.Enum):
    buy = "buy"
    sell = "sell"
    hold = "hold"


class OrderSideDB(str, enum.Enum):
    buy = "buy"
    sell = "sell"


class OrderStatusDB(str, enum.Enum):
    pending = "pending"
    open = "open"
    filled = "filled"
    canceled = "canceled"
    rejected = "rejected"
    expired = "expired"


class BotModeDB(str, enum.Enum):
    paper = "paper"
    live = "live"


class SignalRecord(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    action = Column(Enum(SignalActionDB), nullable=False)
    confidence = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    timeframe = Column(String(10), nullable=True)
    strategy_results = Column(JSON, nullable=True)
    signal_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class PositionRecord(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(Enum(OrderSideDB), nullable=False)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    unrealized_pnl = Column(Float, default=0.0)
    realized_pnl = Column(Float, default=0.0)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    status = Column(Enum(OrderStatusDB), default=OrderStatusDB.open)
    mode = Column(Enum(BotModeDB), default=BotModeDB.paper)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)


class TradeRecord(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(Enum(OrderSideDB), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    fee = Column(Float, default=0.0)
    pnl = Column(Float, nullable=True)
    mode = Column(Enum(BotModeDB), default=BotModeDB.paper)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class TradeTypeDB(str, enum.Enum):
    spot = "spot"
    futures = "futures"


class PlanTypeDB(str, enum.Enum):
    basic = "basic"
    pro = "pro"
    enterprise = "enterprise"


class UserRecord(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    mexc_api_key = Column(String(512), nullable=True)
    mexc_api_secret = Column(String(512), nullable=True)
    mode = Column(Enum(BotModeDB), default=BotModeDB.paper)
    trade_type = Column(Enum(TradeTypeDB), default=TradeTypeDB.spot)
    plan = Column(Enum(PlanTypeDB), default=PlanTypeDB.basic)
    bot_active = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    max_position_usdt = Column(Float, default=500.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)
