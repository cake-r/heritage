"""Redis 客户端 — 连接池单例

当 REDIS_URL 未设置或连接失败时，所有操作静默降级为 no-op。
确保 SQLite 开发模式下无 Redis 依赖。
"""

import json
import logging
from typing import Any, Optional

from app.config import REDIS_URL, REDIS_ENABLED

logger = logging.getLogger("redis")

_redis_client: Optional[Any] = None
_redis_available: bool = False


def _get_client():
    """延迟初始化 Redis 连接"""
    global _redis_client, _redis_available

    if _redis_client is not None:
        return _redis_client if _redis_available else None

    if not REDIS_ENABLED:
        logger.debug("REDIS_URL 未设置，Redis 功能禁用")
        _redis_available = False
        return None

    try:
        import redis as redis_lib
        _redis_client = redis_lib.from_url(
            REDIS_URL,
            socket_connect_timeout=3,
            socket_timeout=5,
            decode_responses=True,
        )
        _redis_client.ping()
        _redis_available = True
        logger.info("Redis 连接成功: %s", REDIS_URL)
        return _redis_client
    except Exception as e:
        logger.warning("Redis 连接失败 (%s)，降级为本地模式", e)
        _redis_client = None
        _redis_available = False
        return None


def is_redis_available() -> bool:
    """检查 Redis 是否可用"""
    _get_client()
    return _redis_available


def get_redis() -> Optional[Any]:
    """获取 Redis 客户端 (None = 不可用)"""
    return _get_client()


def redis_get(key: str) -> Optional[str]:
    """读取字符串值"""
    client = _get_client()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception as e:
        logger.debug("redis GET %s 失败: %s", key, e)
        return None


def redis_set(key: str, value: str, ttl: int = 0) -> bool:
    """写入字符串值 (ttl=0 表示永不过期)"""
    client = _get_client()
    if client is None:
        return False
    try:
        if ttl > 0:
            client.setex(key, ttl, value)
        else:
            client.set(key, value)
        return True
    except Exception as e:
        logger.debug("redis SET %s 失败: %s", key, e)
        return False


def redis_get_json(key: str) -> Optional[Any]:
    """读取 JSON 值"""
    raw = redis_get(key)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


def redis_set_json(key: str, value: Any, ttl: int = 0) -> bool:
    """写入 JSON 值"""
    return redis_set(key, json.dumps(value, ensure_ascii=False), ttl)


def redis_delete(*keys: str) -> int:
    """删除键，返回删除数量"""
    client = _get_client()
    if client is None or not keys:
        return 0
    try:
        return client.delete(*keys)
    except Exception as e:
        logger.debug("redis DEL %s 失败: %s", keys, e)
        return 0


def redis_delete_pattern(pattern: str) -> int:
    """按模式删除键 (使用 SCAN，非阻塞)"""
    client = _get_client()
    if client is None:
        return 0
    try:
        count = 0
        cursor = 0
        while True:
            cursor, keys = client.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                count += client.delete(*keys)
            if cursor == 0:
                break
        return count
    except Exception as e:
        logger.debug("redis SCAN+DEL %s 失败: %s", pattern, e)
        return 0


def redis_execute_lua(script: str, keys: list[str], args: list[str]) -> Any:
    """执行 Lua 脚本 (原子操作)"""
    client = _get_client()
    if client is None:
        return None
    try:
        return client.eval(script, len(keys), *keys, *args)
    except Exception as e:
        logger.debug("redis EVAL 失败: %s", e)
        return None
