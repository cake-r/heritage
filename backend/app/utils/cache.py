"""缓存层 — Redis 热缓存 + 本地降级

提供统一的 cache_get / cache_set / cache_invalidate 接口。
Redis 不可用时降级为 no-op (不缓存但不报错)。

TTL 参考值:
- 知识图谱概览: 600s (数据很少变动)
- 展览列表: 120s (新增项目不频繁)
- 修习状态: 60s (XP 变化频繁)
- 伴游上下文: 180s (会话级)
"""

import logging
from typing import Any, Callable, Optional

from app.utils.redis_client import (
    redis_get_json,
    redis_set_json,
    redis_delete,
    redis_delete_pattern,
    is_redis_available,
)

logger = logging.getLogger("cache")

# 缓存键前缀
PREFIX_EXHIBITION = "cache:exhibition"
PREFIX_CULTIVATION = "cache:cultivation"
PREFIX_KNOWLEDGE_GRAPH = "cache:kg"
PREFIX_COMPANION = "cache:companion"
PREFIX_CONFIG = "cache:config"


def cache_key(prefix: str, *parts: str) -> str:
    """构建缓存键: prefix:part1:part2:..."""
    return ":".join([prefix, *parts])


def cache_get(key: str) -> Optional[Any]:
    """读取缓存 (JSON 反序列化)"""
    if not is_redis_available():
        return None
    result = redis_get_json(key)
    if result is not None:
        logger.debug("cache HIT: %s", key)
    return result


def cache_set(key: str, value: Any, ttl: int = 120) -> bool:
    """写入缓存"""
    if not is_redis_available():
        return False
    ok = redis_set_json(key, value, ttl)
    if ok:
        logger.debug("cache SET: %s (ttl=%ds)", key, ttl)
    return ok


def cache_delete(*keys: str) -> int:
    """删除指定缓存键"""
    if not is_redis_available() or not keys:
        return 0
    return redis_delete(*keys)


def cache_invalidate_pattern(prefix: str) -> int:
    """按前缀批量失效缓存"""
    if not is_redis_available():
        return 0
    count = redis_delete_pattern(f"{prefix}:*")
    if count:
        logger.debug("cache INVALIDATE: %s (%d keys)", prefix, count)
    return count


def cache_or_compute(
    key: str,
    compute_fn: Callable[[], Any],
    ttl: int = 120,
) -> Any:
    """缓存命中返回缓存值，否则调用 compute_fn 计算并写入缓存

    典型用法:
        items = cache_or_compute(
            "cache:exhibition:items:page1",
            lambda: _query_items_from_db(page=1),
            ttl=120,
        )
    """
    cached = cache_get(key)
    if cached is not None:
        return cached
    result = compute_fn()
    cache_set(key, result, ttl)
    return result


# --- 预定义失效函数 (供 API 修改操作调用) ---

def invalidate_exhibition() -> int:
    """失效展品相关缓存"""
    return cache_invalidate_pattern(PREFIX_EXHIBITION)


def invalidate_cultivation(user_id: int) -> int:
    """失效指定用户的修习缓存"""
    return cache_delete(cache_key(PREFIX_CULTIVATION, "status", str(user_id)))


def invalidate_knowledge_graph() -> int:
    """失效知识图谱缓存"""
    return cache_invalidate_pattern(PREFIX_KNOWLEDGE_GRAPH)


def invalidate_companion(user_id: int) -> int:
    """失效指定用户的伴游上下文缓存"""
    return cache_delete(cache_key(PREFIX_COMPANION, "context", str(user_id)))
