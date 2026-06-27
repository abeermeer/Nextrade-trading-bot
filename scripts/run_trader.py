import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config_loader import ConfigLoader
from shared.redis_client import create_redis_client
from shared.logger import setup_logging, get_logger
from db.database import init_db
from trader.trader_bot import TraderBot


async def main():
    print("Starting trader bot...", flush=True)

    config_loader = ConfigLoader()

    settings = config_loader.load_settings()
    logging_cfg = settings.get("logging", {})
    setup_logging(
        level=logging_cfg.get("level", "INFO"),
        log_format=logging_cfg.get("format", "json"),
        log_file=logging_cfg.get("file", "logs/trading.log"),
        max_bytes=logging_cfg.get("max_bytes", 10485760),
        backup_count=logging_cfg.get("backup_count", 5),
        error_file=logging_cfg.get("error_file", "logs/error.log"),
    )

    logger = get_logger(__name__)

    import os as _os
    print(f"DBG DATABASE_URL={_os.getenv('DATABASE_URL', 'NOT_SET')}", flush=True)

    try:
        await init_db()
        logger.info("database_initialized")
    except Exception as e:
        logger.warning("database_init_skipped", error=str(e))

    redis_client = create_redis_client(settings)
    print(f"Redis config: host={redis_client._connection_params['host']}, port={redis_client._connection_params['port']}", flush=True)

    bot = TraderBot(
        config_loader=config_loader,
        redis_client=redis_client,
    )

    logger.info("trader_bot_starting")
    print("Starting bot...", flush=True)
    await bot.start()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"FATAL: {e}", flush=True)
        sys.exit(1)
