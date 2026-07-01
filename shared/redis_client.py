import os
from pathlib import Path
from typing import Any, Callable, Optional
import json
from urllib.parse import urlparse
import redis.asyncio as aioredis
from dotenv import load_dotenv
from shared.logger import get_logger

logger = get_logger(__name__)


def _load_env_file() -> None:
    env_path = Path("config") / ".env"
    if env_path.exists():
        load_dotenv(env_path)


def create_redis_client(settings: dict | None = None) -> "RedisClient":
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        _load_env_file()
        redis_url = os.getenv("REDIS_URL")
    if redis_url:
        parsed = urlparse(redis_url)
        client = RedisClient(
            host=parsed.hostname or "localhost",
            port=parsed.port or 6379,
            password=parsed.password or "",
        )
        logger.info("redis_url_used", host=parsed.hostname, port=parsed.port)
        return client
    cfg = (settings or {}).get("redis", {})
    client = RedisClient(
        host=cfg.get("host", "localhost"),
        port=cfg.get("port", 6379),
        password=cfg.get("password", ""),
        db=cfg.get("db", 0),
    )
    logger.info("redis_config_fallback", host=cfg.get("host", "localhost"), port=cfg.get("port", 6379))
    return client


class RedisClient:
    def __init__(self, host: str = "localhost", port: int = 6379, password: str = "", db: int = 0):
        self._connection_params = {
            "host": host,
            "port": port,
            "password": password or None,
            "db": db,
            "decode_responses": True,
        }
        self._pub: Optional[aioredis.Redis] = None
        self._sub: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        self._pub = aioredis.Redis(**self._connection_params)
        self._sub = aioredis.Redis(**self._connection_params)
        await self._pub.ping()
        await self._sub.ping()
        logger.info("redis_connected", host=self._connection_params["host"])

    async def disconnect(self) -> None:
        if self._pub:
            await self._pub.close()
        if self._sub:
            await self._sub.close()
        logger.info("redis_disconnected")

    async def publish(self, channel: str, message: dict[str, Any]) -> None:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        payload = json.dumps(message, default=str)
        await self._pub.publish(channel, payload)
        logger.debug("redis_published", channel=channel)

    async def subscribe(self, channel: str, callback: Callable) -> None:
        if not self._sub:
            raise RuntimeError("Redis not connected")
        pubsub = self._sub.pubsub()
        await pubsub.subscribe(channel)
        logger.info("redis_subscribed", channel=channel)
        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await callback(data)
                except Exception as e:
                    logger.error("redis_callback_error", error=str(e))

    async def publish_heartbeat(self, channel: str, data: dict[str, Any]) -> None:
        data["_type"] = "heartbeat"
        await self.publish(channel, data)

    async def get(self, key: str) -> Optional[str]:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        return await self._pub.get(key)

    async def set(self, key: str, value: str, ttl: Optional[int] = None) -> None:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        if ttl:
            await self._pub.setex(key, ttl, value)
        else:
            await self._pub.set(key, value)

    async def lpush(self, key: str, value: str) -> None:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        await self._pub.lpush(key, value)

    async def rpush(self, key: str, value: str) -> None:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        await self._pub.rpush(key, value)

    async def lpop(self, key: str) -> Optional[str]:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        return await self._pub.lpop(key)

    async def llen(self, key: str) -> int:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        return await self._pub.llen(key)

    async def lrange(self, key: str, start: int, stop: int) -> list[str]:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        return await self._pub.lrange(key, start, stop)

    async def ltrim(self, key: str, start: int, stop: int) -> None:
        if not self._pub:
            raise RuntimeError("Redis not connected")
        await self._pub.ltrim(key, start, stop)
