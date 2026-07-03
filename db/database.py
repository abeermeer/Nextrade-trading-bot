import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from db.models import Base


def _get_async_database_url() -> str:
    raw = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./trading.db")
    if raw.startswith("postgres://") or raw.startswith("postgresql://"):
        return raw.replace("postgres://", "postgresql+asyncpg://", 1).replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
    return raw


DATABASE_URL = _get_async_database_url()

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _run_migrations(conn) -> None:
    """Add columns that were introduced after the tables were first created.
    create_all() only CREATEs missing tables, never ALTERs existing ones — so a
    model column added later (e.g. trades.exchange_order_id) is absent in an old
    prod DB and every full-row query 500s. Idempotent; Postgres only."""
    if conn.dialect.name != "postgresql":
        return
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE trades ADD COLUMN IF NOT EXISTS exchange_order_id VARCHAR(128)",
        "CREATE INDEX IF NOT EXISTS ix_trades_exchange_order_id ON trades (exchange_order_id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS paper_balance_usdt DOUBLE PRECISION DEFAULT 10000.0",
    ]
    for s in stmts:
        try:
            await conn.execute(text(s))
        except Exception:
            pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _run_migrations(conn)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def close_db() -> None:
    await engine.dispose()
