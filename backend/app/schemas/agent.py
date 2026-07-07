"""Agent 子系统共享 Pydantic schema"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ── 步骤声明（模块提供给装饰器） ──────────────────────────────

class StepDef(BaseModel):
    """模块声明步骤定义 —— 传入 @track_execution 的参数"""
    id: str = Field(..., description="步骤唯一标识，如 'recognize', 'damage_analysis'")
    title: str = Field(..., description="步骤中文标题，如 'AI识别品类'")
    description: str = Field(default="", description="步骤简述")
    icon: str = Field(default="", description="emoji 或 Unicode 图标")


# ── 运行时步骤状态（SSE 推送） ──────────────────────────────

class AgentStep(BaseModel):
    """单步运行时状态 —— agent_step 事件的 data payload"""
    id: str
    title: str
    description: str = ""
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    progress: int = Field(default=0, ge=0, le=100)
    icon: str = ""
    detail: Optional[dict] = Field(default=None, description="步骤特定的结构化数据")
    error: Optional[str] = None


# ── 完整执行摘要（agent_finish 事件） ─────────────────────────

class AgentExecution(BaseModel):
    """完整执行摘要 —— agent_finish 事件的 data payload"""
    execution_id: str
    module: str
    status: Literal["running", "completed", "failed"]
    steps: list[AgentStep]
    started_at: datetime
    finished_at: Optional[datetime] = None
    summary: str = ""


# ── SSE 事件 payload 包装 ──────────────────────────────────

class AgentStepEvent(BaseModel):
    """推送给 SSE 客户端的 agent_step 事件"""
    execution_id: str
    step_id: str
    status: Literal["pending", "running", "completed", "failed"]
    title: str
    icon: str = ""
    progress: int = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    detail: Optional[dict] = None
    error: Optional[str] = None


class AgentProgressEvent(BaseModel):
    execution_id: str
    step_id: str
    progress: int = Field(ge=0, le=100)


class AgentFinishEvent(BaseModel):
    execution_id: str
    module: str
    status: Literal["completed", "failed"]
    steps: list[AgentStep]
    started_at: datetime
    finished_at: Optional[datetime] = None
    summary: str = ""
