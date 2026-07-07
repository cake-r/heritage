"""Story Mode 沉浸式探索 — Pydantic Schemas"""
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel


class DemoStepDef(BaseModel):
    """demo_scripts.json 步骤定义"""
    id: str
    title: str
    description: str = ""
    icon: str = ""
    timeout_s: int = 60
    on_fail: Literal["skip", "fallback", "retry"] = "skip"
    action: Optional[str] = None
    sample_image: Optional[str] = None


class StoryModeStartRequest(BaseModel):
    """启动 Story Mode 请求"""
    demo_id: Optional[str] = None


class DemoStepResult(BaseModel):
    """单个步骤的返回结果"""
    step_id: str
    title: str
    icon: str = ""
    status: Literal["running", "completed", "failed", "skipped"] = "running"
    progress: int = 0
    message: str = ""
    output_data: Optional[dict] = None
    error: Optional[str] = None


class StoryModeReport(BaseModel):
    """探索报告"""
    total_steps: int
    completed_steps: int
    failed_steps: int
    skipped_steps: int
    total_duration_s: float
    highlights: list[str] = []
    summary: str = ""
