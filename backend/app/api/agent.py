"""Agent 平台 API 端点

- SSE 执行流订阅
- 记忆管理（Module 2 扩展）
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.services.agent.execution_tracker import (
    subscribe_execution,
    unsubscribe_execution,
)

logger = logging.getLogger("agent_api")

router = APIRouter(prefix="/api/agent", tags=["Agent 平台"])


@router.get("/execution/{execution_id}/stream")
async def stream_execution(
    execution_id: str,
    current_user: User = Depends(get_current_user),
):
    """SSE 流：订阅 Agent 执行进度事件

    事件类型：
      agent_step     — 步骤状态变更
      agent_progress — 步骤进度更新
      agent_finish   — 执行完成（含摘要）
      error          — 连接超时或异常
    """
    q = await subscribe_execution(execution_id)

    async def event_stream():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=300)
                except asyncio.TimeoutError:
                    yield f"event: error\ndata: {json.dumps({'error': '执行超时或已完成'}, ensure_ascii=False)}\n\n"
                    break

                yield f"event: {event['type']}\ndata: {event['data']}\n\n"

                if event["type"] == "agent_finish":
                    break
        except asyncio.CancelledError:
            pass
        finally:
            await unsubscribe_execution(execution_id, q)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
