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


async def ai_user_context(request: Request, call_next):
    """从 JWT Token 提取 user_id 并设置 AI 用量上下文 — 用于自动关联 API 调用者"""
    from app.utils.ai_governance import set_ai_user
    from app.utils.security import decode_access_token

    user_id: int | None = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            try:
                user_id = int(payload["sub"])
            except (ValueError, TypeError):
                pass

    set_ai_user(user_id)
    response = await call_next(request)
    return response
