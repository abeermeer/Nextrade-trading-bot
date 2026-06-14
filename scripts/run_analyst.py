import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared.config_loader import ConfigLoader
from shared.redis_client import RedisClient, create_redis_client
from shared.logger import setup_logging, get_logger
from analyst.analyst_bot import AnalystBot


async def main():
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

    redis_client = create_redis_client(settings)

    bot = AnalystBot(
        config_loader=config_loader,
        redis_client=redis_client,
    )

    logger.info("analyst_bot_starting")
    await bot.start()


if __name__ == "__main__":
    asyncio.run(main())
