from datetime import datetime
from sqlalchemy import Boolean, Column, String, Float, DateTime, Enum, JSON, Integer, BigInteger
from sqlalchemy.orm import DeclarativeBase
import enum


class Base(DeclarativeBase):
    pass


class UserApiKeyRecord(Base):
    __tablename__ = "user_api_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    key_prefix = Column(String(8), nullable=False)
    key_hash = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


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


class ExchangeDB(str, enum.Enum):
    mexc = "mexc"
    binance = "binance"
    bybit = "bybit"


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
    exchange = Column(Enum(ExchangeDB), default=ExchangeDB.mexc)
    bot_active = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    max_position_usdt = Column(Float, default=500.0)
    wallet_address = Column(String(255), nullable=True, index=True)
    wallet_type = Column(String(10), nullable=True)  # "evm" | "solana"
    withdrawal_delay_hours = Column(Integer, default=24)
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    api_key_hash = Column(String(255), nullable=True)
    api_key_prefix = Column(String(8), nullable=True)
    strategy_settings = Column(JSON, nullable=True)
    notification_prefs = Column(JSON, nullable=True)
    selected_pairs = Column(JSON, nullable=True)
    mexc_keys_verified = Column(Boolean, default=False)
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    usage_api_calls = Column(Integer, default=0)
    usage_bot_hours = Column(Float, default=0.0)
    usage_trade_volume = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class WithdrawalWhitelistRecord(Base):
    __tablename__ = "withdrawal_whitelist"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    address = Column(String(255), nullable=False)
    network = Column(String(50), nullable=False)
    label = Column(String(100), nullable=True)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
