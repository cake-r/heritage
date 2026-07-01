"""Admin API schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# === 用户管理 ===

class UserRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|user)$")


class UserBanRequest(BaseModel):
    reason: Optional[str] = None


class AdminUserSummary(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    role: str = "user"
    is_banned: bool = False
    recognition_count: int = 0
    generation_count: int = 0
    xp_total: int = 0
    created_at: Optional[str] = None
    last_active: Optional[str] = None


# === 成本看板 ===

class CostSummaryResponse(BaseModel):
    total_cost: float
    by_model: dict[str, float]
    by_endpoint: dict[str, float]
    by_day: list[dict]  # [{date, cost, count}]


# === 任务监控 ===

class TaskQueueStatus(BaseModel):
    pending: int = 0
    running: int = 0
    success: int = 0
    failed: int = 0
    avg_latency_ms: float = 0


# === 系统配置 ===

class ConfigItem(BaseModel):
    key: str
    value: dict
    updated_at: Optional[str] = None


class ConfigUpdateRequest(BaseModel):
    updates: dict[str, dict]  # {key: value_json}
