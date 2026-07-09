"""Rate limiter for sensitive endpoints (login, etc.).

Redis-backed sliding window with in-memory fallback for single-process deployments.
"""

import time
from collections import defaultdict

# Lua script: atomic check-and-increment for fixed-window rate limiting
_RATE_LIMIT_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, now .. ':' .. count)
    return {1, limit - count - 1}
else
    return {0, 0}
end
"""


class RateLimiter:
    """Sliding-window rate limiter keyed by IP or username.

    Redis 可用时使用 Lua 原子操作；否则降级为本地内存模式。
    """

    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._attempts: defaultdict[str, list[float]] = defaultdict(list)

    def _prune(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._attempts[key] = [t for t in self._attempts[key] if t > cutoff]

    def _redis_key(self, key: str) -> str:
        return f"rate_limit:login:{key}"

    def is_allowed(self, key: str) -> bool:
        # Redis 优先
        from app.utils.redis_client import is_redis_available, redis_execute_lua
        if is_redis_available():
            result = redis_execute_lua(
                _RATE_LIMIT_LUA,
                keys=[self._redis_key(key)],
                args=[str(time.time()), str(self.window_seconds), str(self.max_requests)],
            )
            if result and len(result) == 2:
                return bool(result[0])

        # 内存降级
        now = time.time()
        self._prune(key, now)
        return len(self._attempts[key]) < self.max_requests

    def record_attempt(self, key: str) -> None:
        # Redis 路径: is_allowed() 已写入, 此处仅内存降级
        from app.utils.redis_client import is_redis_available
        if is_redis_available():
            return  # Lua 脚本已在 is_allowed 中 ZADD

        now = time.time()
        self._prune(key, now)
        self._attempts[key].append(now)

    def reset(self, key: str) -> None:
        from app.utils.redis_client import is_redis_available, redis_delete
        if is_redis_available():
            redis_delete(self._redis_key(key))

        self._attempts.pop(key, None)


# Global instance for login rate limiting
login_limiter = RateLimiter(max_requests=5, window_seconds=60)

# Register rate limiting — 3 registrations per 10 minutes per IP
register_limiter = RateLimiter(max_requests=3, window_seconds=600)
