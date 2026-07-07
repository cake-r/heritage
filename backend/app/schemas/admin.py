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


# ── Admin Dashboard 2.0: 数据驾驶舱 ──

class DashboardOverview(BaseModel):
    """核心指标概览"""
    total_users: int = 0
    total_recognitions: int = 0
    total_restorations: int = 0
    total_generations: int = 0
    total_chat_sessions: int = 0
    total_stamps_earned: int = 0
    active_users_today: int = 0
    ai_cost_today: float = 0.0
    ai_cost_month: float = 0.0
    task_pending: int = 0
    task_running: int = 0
    knowledge_base_size: int = 0
    pattern_genes_count: int = 0


class DailyTrend(BaseModel):
    """单日趋势数据"""
    date: str
    active_users: int = 0
    recognitions: int = 0
    restorations: int = 0
    generations: int = 0
    cost: float = 0.0
    new_users: int = 0


class LeaderboardEntry(BaseModel):
    """榜单条目"""
    name: str
    value: int


class DashboardLeaderboard(BaseModel):
    """总榜单"""
    top_categories: list[LeaderboardEntry] = []
    top_regions: list[LeaderboardEntry] = []
    top_eras: list[LeaderboardEntry] = []
    top_users: list[LeaderboardEntry] = []


# ── Prompt 管理（Phase C Step 8） ──

class PromptItem(BaseModel):
    """单条 Prompt 记录"""
    id: int
    module: str
    version: int
    content: str
    is_active: bool = False
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PromptModule(BaseModel):
    """单个模块的 Prompt 列表"""
    module: str
    prompts: list[PromptItem]
    active_id: Optional[int] = None  # 当前激活的版本 ID


class PromptUpdateRequest(BaseModel):
    """更新 Prompt 内容或切换激活状态"""
    content: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


class PromptListResponse(BaseModel):
    """所有模块的 Prompt 列表"""
    modules: list[PromptModule]
