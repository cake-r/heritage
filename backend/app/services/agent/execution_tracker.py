"""Agent 执行追踪中间件

装饰器模式 + ContextVar + SSE pub/sub broker。

使用方式:
    from app.services.agent.execution_tracker import track_execution, track_step
    from app.services.agent.step_defs import RECOGNITION_STEPS

    @track_execution(module="recognition", steps=RECOGNITION_STEPS)
    def recognize(image_path: str) -> dict:
        track_step("recognize", "running")
        # ... AI 调用 ...
        track_step("recognize", "completed", detail={"category": "陶瓷"})
        return result

    # 调用方通过 get_last_execution_id() 获取 execution_id
    result = recognize(img_path)
    execution_id = get_last_execution_id()
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Callable, Literal, Optional

from app.schemas.agent import AgentExecution, AgentStep, StepDef

logger = logging.getLogger("execution_tracker")

# ── ContextVar: 当前线程/协程的执行上下文 ────────────────────

_current_execution: ContextVar[Optional["_ExecutionState"]] = ContextVar(
    "_current_execution", default=None
)
_last_execution_id: ContextVar[Optional[str]] = ContextVar(
    "_last_execution_id", default=None
)
_last_execution_steps: ContextVar[Optional[list[dict]]] = ContextVar(
    "_last_execution_steps", default=None
)


class _ExecutionState:
    """单个执行的内部状态"""
    def __init__(self, execution_id: str, module: str, steps: list[StepDef]):
        self.execution_id = execution_id
        self.module = module
        self.steps: list[AgentStep] = []
        for sd in steps:
            self.steps.append(AgentStep(
                id=sd.id,
                title=sd.title,
                description=sd.description,
                icon=sd.icon,
                status="pending",
            ))
        self.started_at = datetime.now(timezone.utc)
        self.finished_at: Optional[datetime] = None
        self._step_index: dict[str, int] = {s.id: i for i, s in enumerate(self.steps)}

    def get_step(self, step_id: str) -> Optional[AgentStep]:
        idx = self._step_index.get(step_id)
        if idx is not None:
            return self.steps[idx]
        return None

    def to_execution(self) -> AgentExecution:
        has_failure = any(s.status == "failed" for s in self.steps)
        all_done = all(s.status in ("completed", "failed") for s in self.steps)
        if has_failure:
            status = "failed"
        elif all_done:
            status = "completed"
        else:
            status = "running"

        return AgentExecution(
            execution_id=self.execution_id,
            module=self.module,
            status=status,
            steps=self.steps,
            started_at=self.started_at,
            finished_at=self.finished_at,
            summary=_build_summary(self.steps),
        )


def _build_summary(steps: list[AgentStep]) -> str:
    completed = sum(1 for s in steps if s.status == "completed")
    failed = sum(1 for s in steps if s.status == "failed")
    total = len(steps)
    if failed > 0:
        return f"{completed}/{total} 步完成，{failed} 步失败"
    return f"{completed}/{total} 步完成"


# ── SSE Pub/Sub Broker ─────────────────────────────────────

# 使用 asyncio.Queue 作为事件通道
_sse_broker: dict[str, list[asyncio.Queue]] = {}
_broker_lock = asyncio.Lock()


async def _publish_event(event_type: str, data: dict) -> None:
    """向所有订阅该 execution_id 的客户端推送事件"""
    execution_id = data.get("execution_id", "")
    async with _broker_lock:
        queues = _sse_broker.get(execution_id, [])
    if not queues:
        return
    payload = json.dumps(data, ensure_ascii=False, default=str)
    dead_queues = []
    for q in queues:
        try:
            q.put_nowait({"type": event_type, "data": payload})
        except asyncio.QueueFull:
            dead_queues.append(q)
    # 清理满队列（客户端太慢）
    if dead_queues:
        async with _broker_lock:
            for q in dead_queues:
                try:
                    _sse_broker.get(execution_id, []).remove(q)
                except ValueError:
                    pass


async def subscribe_execution(execution_id: str) -> asyncio.Queue:
    """SSE 端点调用：为 execution_id 订阅事件"""
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    async with _broker_lock:
        _sse_broker.setdefault(execution_id, []).append(q)
    logger.info(f"SSE 订阅: execution_id={execution_id}, 当前订阅数={len(_sse_broker.get(execution_id, []))}")
    return q


async def unsubscribe_execution(execution_id: str, q: asyncio.Queue) -> None:
    """SSE 断连时清理"""
    async with _broker_lock:
        try:
            _sse_broker.get(execution_id, []).remove(q)
            if not _sse_broker[execution_id]:
                del _sse_broker[execution_id]
        except (ValueError, KeyError):
            pass
    logger.info(f"SSE 取消订阅: execution_id={execution_id}")


async def _cleanup_execution(execution_id: str, delay: int = 300) -> None:
    """延迟清理：N 秒后移除 broker 中残留的订阅队列"""
    await asyncio.sleep(delay)
    async with _broker_lock:
        _sse_broker.pop(execution_id, None)


# ── 公开 API: 装饰器 ────────────────────────────────────────

def track_execution(module: str, steps: list[StepDef]):
    """装饰器：追踪函数执行过程，通过 SSE 发布步骤事件。

    放在 @with_retry 外层，重试对 tracker 透明。

    Args:
        module: 模块标识，如 "recognition", "restoration"
        steps: 该模块的步骤声明列表
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            execution_id = str(uuid.uuid4())[:8]
            state = _ExecutionState(execution_id, module, steps)

            # 设置 ContextVar
            token_current = _current_execution.set(state)
            token_last = _last_execution_id.set(execution_id)

            # 发布所有步骤为 pending 状态
            _schedule_publish_initial(state)

            try:
                result = func(*args, **kwargs)

                # 尚未标记状态的步骤 → 标记为 completed（函数可能未显式跟踪所有步骤）
                for step in state.steps:
                    if step.status == "pending":
                        step.status = "completed"
                        step.start_time = datetime.now(timezone.utc)
                        step.end_time = datetime.now(timezone.utc)

                state.finished_at = datetime.now(timezone.utc)
                execution = state.to_execution()
                _schedule_publish_finish(execution)
                _schedule_cleanup(execution_id)
                return result

            except Exception as exc:
                # 当前正在运行的步骤标记为 failed
                for step in state.steps:
                    if step.status == "running":
                        step.status = "failed"
                        step.end_time = datetime.now(timezone.utc)
                        step.error = str(exc)
                state.finished_at = datetime.now(timezone.utc)
                execution = state.to_execution()
                _schedule_publish_finish(execution)
                _schedule_cleanup(execution_id)
                raise

            finally:
                # 保存步骤数据供调用方读取（ContextVar 重置后就取不到了）
                steps_data = [
                    {
                        "id": s.id, "title": s.title, "icon": s.icon,
                        "status": s.status, "progress": s.progress,
                        "start_time": s.start_time.isoformat() if s.start_time else None,
                        "end_time": s.end_time.isoformat() if s.end_time else None,
                        "detail": s.detail, "error": s.error,
                    }
                    for s in state.steps
                ]
                _last_execution_steps.set(steps_data)
                _current_execution.reset(token_current)

        return wrapper
    return decorator


# ── 公开 API: 步骤追踪函数 ──────────────────────────────────

def track_step(
    step_id: str,
    status: Literal["running", "completed", "failed"],
    detail: Optional[dict] = None,
    error: Optional[str] = None,
    progress: int = 0,
) -> None:
    """在 @track_execution 装饰的函数内部调用，更新步骤状态并推送 SSE 事件。

    Args:
        step_id: 步骤 ID（对应 StepDef.id）
        status: 新状态
        detail: 步骤特定的结构化数据
        error: 失败时的错误信息
        progress: 进度百分比 0-100
    """
    state = _current_execution.get()
    if state is None:
        # 未在 @track_execution 上下文中运行，静默忽略
        return

    step = state.get_step(step_id)
    if step is None:
        logger.warning(f"未知步骤 ID: {step_id} (module={state.module})")
        return

    now = datetime.now(timezone.utc)

    if status == "running" and step.status in ("pending",):
        step.status = "running"
        step.start_time = now

    elif status in ("completed", "failed") and step.status in ("pending", "running"):
        step.status = status
        step.end_time = now
        if detail is not None:
            step.detail = detail
        if error is not None:
            step.error = error

    step.progress = 100 if status == "completed" else progress

    _schedule_publish_step(state, step)


def update_progress(step_id: str, progress: int) -> None:
    """更新当前步骤的进度百分比 (0-100)"""
    state = _current_execution.get()
    if state is None:
        return
    step = state.get_step(step_id)
    if step:
        step.progress = max(0, min(100, progress))
        _schedule_publish_progress(state.execution_id, step_id, step.progress)


def get_last_execution_id() -> Optional[str]:
    """返回最近一次 @track_execution 包裹的调用的 execution_id"""
    return _last_execution_id.get()


def get_last_execution_steps() -> list[dict]:
    """返回最近一次执行的步骤列表（dict 格式，供 API 响应使用）"""
    return _last_execution_steps.get() or []


# ── 内部: 异步发布调度（桥接同步→异步） ─────────────────────

def _schedule_publish_initial(state: _ExecutionState) -> None:
    """发布所有步骤的初始 pending 状态"""
    for step in state.steps:
        _schedule_publish_step(state, step)


def _schedule_publish_step(state: _ExecutionState, step: AgentStep) -> None:
    """通过 asyncio 事件循环发布 agent_step 事件"""
    data = {
        "execution_id": state.execution_id,
        "step_id": step.id,
        "status": step.status,
        "title": step.title,
        "icon": step.icon,
        "progress": step.progress,
        "start_time": step.start_time.isoformat() if step.start_time else None,
        "end_time": step.end_time.isoformat() if step.end_time else None,
        "detail": step.detail,
        "error": step.error,
    }
    _schedule_event("agent_step", data)


def _schedule_publish_progress(execution_id: str, step_id: str, progress: int) -> None:
    data = {"execution_id": execution_id, "step_id": step_id, "progress": progress}
    _schedule_event("agent_progress", data)


def _schedule_publish_finish(execution: AgentExecution) -> None:
    data = {
        "execution_id": execution.execution_id,
        "module": execution.module,
        "status": execution.status,
        "steps": [s.model_dump(mode="json") for s in execution.steps],
        "started_at": execution.started_at.isoformat() if execution.started_at else None,
        "finished_at": execution.finished_at.isoformat() if execution.finished_at else None,
        "summary": execution.summary,
    }
    _schedule_event("agent_finish", data)


def _schedule_cleanup(execution_id: str) -> None:
    """安排延迟清理 broker 中的残留队列"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_cleanup_execution(execution_id, delay=300))
    except RuntimeError:
        pass


def _schedule_event(event_type: str, data: dict) -> None:
    """将事件发布到 asyncio 事件循环（从同步线程安全调度）"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.call_soon_threadsafe(
                lambda: asyncio.create_task(_publish_event(event_type, data))
            )
    except RuntimeError:
        pass
