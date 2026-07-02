"""AI 调用治理 — 账单记录 + 用户限流 + 熔断降级"""

import time
import threading
import logging
from contextvars import ContextVar
from functools import wraps
from typing import Callable, Any, Optional

from app.models.database import SessionLocal
from app.services.ai.base import mock_mode

logger = logging.getLogger("ai_governance")

# === 请求级用户上下文 (contextvars 自动跨线程传播) ===
_current_ai_user: ContextVar[Optional[int]] = ContextVar("ai_user_id", default=None)


def set_ai_user(user_id: Optional[int]) -> None:
    """设置当前请求的 AI 调用用户 ID (API 入口处调用)"""
    _current_ai_user.set(user_id)


def get_ai_user() -> Optional[int]:
    """获取当前请求的 AI 调用用户 ID (AI service 内部调用)"""
    return _current_ai_user.get()

# === 熔断器状态 ===
_circuit_state = {
    "failures": 0,
    "last_failure": 0.0,
    "open": False,
    "threshold": 5,         # 连续失败 5 次触发熔断
    "recovery_time": 300,   # 5 分钟后尝试半开
    "half_open_max": 1,     # 半开状态允许 1 次试探
    "half_open_count": 0,
}

_circuit_lock = threading.Lock()


# === 用户级限流 (Redis 优先, 内存降级) ===
_rate_limits: dict[str, list[float]] = {}  # fallback: {user_id:endpoint: [timestamps]}
_rate_lock = threading.Lock()

# Redis Lua 脚本: 原子化检查并递增滑动窗口
_RATE_LIMIT_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
-- 清理过期记录
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, now .. ':' .. count)
    return {1, limit - count - 1}  -- allowed, remaining
else
    return {0, 0}  -- denied
end
"""

# 默认日配额 (按 endpoint)
DEFAULT_DAILY_LIMITS: dict[str, int] = {
    "recognition": 50,
    "image_gen": 20,
    "chat": 200,
    "restoration": 30,
    "tts": 50,
    "embedding": 100,
    "companion": 100,
    "recommendation": 50,
    "expansion": 10,
}


# === 模型费率 (元/1K tokens，按官方定价) ===
MODEL_PRICING: dict[str, dict[str, float]] = {
    "qwen-vl-max": {"input": 0.003, "output": 0.006},
    "wanx2.1-t2i-plus": {"per_image": 0.12},
    "wan2.5-i2i-preview": {"per_image": 0.12},
    "deepseek-chat": {"input": 0.001, "output": 0.002},
    "deepseek-embedding": {"input": 0.0001, "output": 0.0},
    "cosyvoice-v1": {"per_char": 0.00002},
}


def _calculate_cost(model: str, tokens_in: int = 0, tokens_out: int = 0) -> float:
    """根据模型和 token 消耗估算费用"""
    pricing = MODEL_PRICING.get(model, {})
    if "per_image" in pricing:
        return pricing["per_image"]
    if "per_char" in pricing:
        return pricing.get("per_char", 0) * max(tokens_in, tokens_out, 0)
    cost_in = pricing.get("input", 0) * tokens_in / 1000
    cost_out = pricing.get("output", 0) * tokens_out / 1000
    return round(cost_in + cost_out, 6)


def log_ai_usage(
    user_id: Optional[int],
    model: str,
    endpoint: str,
    tokens_in: int = 0,
    tokens_out: int = 0,
    latency_ms: int = 0,
    status: str = "success",
    error_msg: Optional[str] = None,
) -> None:
    """记录 AI 调用到 ai_usage_logs 表（fire-and-forget，不阻塞主流程）"""
    from app.utils.write_queue import enqueue_write

    cost = _calculate_cost(model, tokens_in, tokens_out)

    def _write():
        db = SessionLocal()
        try:
            from app.models.ai_usage import AIUsageLog
            log = AIUsageLog(
                user_id=user_id,
                model=model,
                endpoint=endpoint,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
                latency_ms=latency_ms,
                cost_cny=cost,
                status=status,
                error_msg=error_msg[:500] if error_msg else None,
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    enqueue_write(_write, name="ai_usage_log")


# === 熔断器 ===

def is_circuit_open() -> bool:
    """检查熔断器是否打开"""
    with _circuit_lock:
        if not _circuit_state["open"]:
            return False
        # 检查是否可以半开
        if time.time() - _circuit_state["last_failure"] > _circuit_state["recovery_time"]:
            if _circuit_state["half_open_count"] < _circuit_state["half_open_max"]:
                _circuit_state["half_open_count"] += 1
                logger.info("熔断器半开，允许试探调用")
                return False
        return True


def on_ai_success():
    """AI 调用成功 — 重置熔断器"""
    with _circuit_lock:
        if _circuit_state["open"] or _circuit_state["failures"] > 0:
            logger.info("AI 调用成功，熔断器重置")
        _circuit_state["failures"] = 0
        _circuit_state["open"] = False
        _circuit_state["half_open_count"] = 0


def on_ai_failure():
    """AI 调用失败 — 记录失败，可能触发熔断"""
    with _circuit_lock:
        _circuit_state["failures"] += 1
        _circuit_state["last_failure"] = time.time()
        _circuit_state["half_open_count"] = 0
        if _circuit_state["failures"] >= _circuit_state["threshold"]:
            _circuit_state["open"] = True
            logger.error(
                f"熔断器触发！连续 {_circuit_state['failures']} 次 AI 调用失败"
            )


# === 用户限流 (Redis 原子操作, 内存降级) ===

def check_rate_limit(user_id: int, endpoint: str) -> tuple[bool, int]:
    """
    检查用户是否超过日配额。
    Redis 优先 (Lua 原子操作), 不可用时降级为内存滑动窗口。
    返回 (allowed, remaining)
    """
    limit = DEFAULT_DAILY_LIMITS.get(endpoint, 50)
    window = 86400  # 24h
    now = time.time()

    # --- Redis 路径 (原子化 Lua 脚本) ---
    from app.utils.redis_client import is_redis_available, redis_execute_lua
    if is_redis_available():
        redis_key = f"rate_limit:{user_id}:{endpoint}"
        result = redis_execute_lua(
            _RATE_LIMIT_LUA,
            keys=[redis_key],
            args=[str(now), str(window), str(limit)],
        )
        if result and len(result) == 2:
            return bool(result[0]), int(result[1])
        # Redis 返回异常时降级到内存

    # --- 内存降级路径 (单进程滑动窗口) ---
    key = f"{user_id}:{endpoint}"
    with _rate_lock:
        timestamps = _rate_limits.get(key, [])
        # 清理过期记录
        timestamps = [t for t in timestamps if now - t < window]
        if len(timestamps) >= limit:
            return False, 0
        timestamps.append(now)
        _rate_limits[key] = timestamps
        return True, limit - len(timestamps)


def get_rate_limit_remaining(user_id: int, endpoint: str) -> int:
    """获取剩余配额 (Redis 优先)"""
    limit = DEFAULT_DAILY_LIMITS.get(endpoint, 50)
    window = 86400
    now = time.time()

    from app.utils.redis_client import is_redis_available, get_redis
    if is_redis_available():
        client = get_redis()
        if client:
            try:
                redis_key = f"rate_limit:{user_id}:{endpoint}"
                client.zremrangebyscore(redis_key, "-inf", now - window)
                count = client.zcard(redis_key)
                return max(0, limit - count)
            except Exception:
                pass

    # 内存降级
    key = f"{user_id}:{endpoint}"
    with _rate_lock:
        timestamps = _rate_limits.get(key, [])
        timestamps = [t for t in timestamps if now - t < window]
        return max(0, limit - len(timestamps))


# === 装饰器：一站式 AI 调用治理 ===

def with_ai_governance(model: str, endpoint: str):
    """
    装饰器：自动记录账单 + 用户限流 + 熔断降级。
    被装饰函数的第一个参数必须是 user_id (int)。
    """
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # 提取 user_id (第一个位置参数)
            user_id = args[0] if args else kwargs.get("user_id")

            # Mock 模式不治理
            if mock_mode():
                return fn(*args, **kwargs)

            # 熔断检查
            if is_circuit_open():
                logger.warning(f"熔断生效，{endpoint} 请求被降级")
                on_ai_failure()
                raise AICircuitOpenError(f"AI 服务暂时不可用，{endpoint} 已降级为本地模式")

            # 限流检查 (仅当有 user_id)
            if isinstance(user_id, int):
                allowed, remaining = check_rate_limit(user_id, endpoint)
                if not allowed:
                    raise AIRateLimitError(f"今日 {endpoint} 调用次数已用完，请明天再试")

            start = time.time()
            try:
                result = fn(*args, **kwargs)
                elapsed_ms = int((time.time() - start) * 1000)

                # 提取 token 信息 (如果 result 包含)
                tokens_in, tokens_out = 0, 0
                if isinstance(result, dict):
                    tokens_in = result.get("usage_input_tokens", 0)
                    tokens_out = result.get("usage_output_tokens", 0)

                log_ai_usage(
                    user_id=user_id if isinstance(user_id, int) else None,
                    model=model,
                    endpoint=endpoint,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    latency_ms=elapsed_ms,
                    status="success",
                )
                on_ai_success()
                return result
            except (AICircuitOpenError, AIRateLimitError):
                raise
            except Exception as e:
                elapsed_ms = int((time.time() - start) * 1000)
                log_ai_usage(
                    user_id=user_id if isinstance(user_id, int) else None,
                    model=model,
                    endpoint=endpoint,
                    latency_ms=elapsed_ms,
                    status="error",
                    error_msg=str(e)[:500],
                )
                on_ai_failure()
                raise

        return wrapper
    return decorator


class AICircuitOpenError(Exception):
    """AI 熔断错误"""
    pass


class AIRateLimitError(Exception):
    """AI 用户限流错误"""
    pass
