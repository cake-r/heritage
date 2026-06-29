"""中间件工具"""

import time
import logging

from fastapi import Request

logger = logging.getLogger("app.middleware")


async def log_requests(request: Request, call_next):
    """请求日志中间件"""
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info("%s %s -> %s (%.2fs)", request.method, request.url.path, response.status_code, duration)
    return response
