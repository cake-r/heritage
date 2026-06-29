"""AI服务基类 — 重试、超时、日志、Mock支持"""

import time
import json
import logging
import os
from pathlib import Path
from functools import wraps

logger = logging.getLogger("ai_service")

MOCK_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock"


def mock_mode():
    """检查是否Mock模式"""
    return os.getenv("MOCK_MODE", "false").lower() == "true"


def load_mock(filename: str):
    """加载Mock数据"""
    path = MOCK_DIR / filename
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


class AIServiceError(Exception):
    """AI服务异常"""
    def __init__(self, message: str, service: str = "", retryable: bool = True):
        self.service = service
        self.retryable = retryable
        super().__init__(f"[{service}] {message}")


def with_retry(max_retries: int = 3, base_delay: float = 1.0, timeout: float = 30):
    """重试装饰器 — 指数退避"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    start = time.time()
                    result = func(*args, **kwargs)
                    elapsed = time.time() - start
                    logger.info(f"{func.__name__} 成功 (耗时 {elapsed:.2f}s, 尝试 {attempt + 1}/{max_retries})")
                    return result
                except AIServiceError as e:
                    if not e.retryable:
                        raise
                    last_error = e
                except Exception as e:
                    last_error = AIServiceError(str(e), retryable=True)

                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.warning(f"{func.__name__} 失败 (尝试 {attempt + 1}/{max_retries}), {delay}s后重试: {last_error}")
                    time.sleep(delay)

            logger.error(f"{func.__name__} 全部重试失败: {last_error}")
            raise last_error or AIServiceError("未知错误", retryable=False)
        return wrapper
    return decorator
