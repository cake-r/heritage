"""Fire-and-forget 线程工具 — 独立 Session + 错误日志 + 可重试"""

import threading
import logging
from typing import Callable, TypeVar

logger = logging.getLogger("ich_backend.fire_and_forget")

T = TypeVar("T")


def run_in_thread(
    fn: Callable[[], T],
    *,
    name: str = "ff",
    retry: bool = False,
    max_retries: int = 1,
) -> None:
    """
    在独立 daemon 线程中执行 fn。

    Args:
        fn: 可调用对象（应使用独立 SessionLocal）
        name: 线程名，用于日志标识
        retry: 是否在失败后重试（默认不重试）
        max_retries: 重试次数（默认 1 次）
    """
    def _runner():
        attempt = 0
        while True:
            try:
                fn()
                return  # 成功
            except Exception:
                attempt += 1
                if retry and attempt <= max_retries:
                    logger.warning(
                        "fire-and-forget [%s] 失败 (第 %d/%d 次)，准备重试",
                        name, attempt, max_retries + 1,
                        exc_info=True,
                    )
                    continue
                logger.error(
                    "fire-and-forget [%s] 最终失败 (共 %d 次尝试)",
                    name, attempt,
                    exc_info=True,
                )
                return

    threading.Thread(target=_runner, name=f"ff-{name}", daemon=True).start()
