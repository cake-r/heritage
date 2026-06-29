"""修习之路 Pydantic Schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class SkillTreeProgress(BaseModel):
    """单条技能树进度"""
    tree_name: str           # "鉴宝"
    label: str               # "鉴宝之路"
    icon: str                # emoji
    level: int               # 1-5
    current: int             # 当前进度数值
    threshold: int           # 升级所需阈值
    percentage: float        # 0-100


class CultivationStatus(BaseModel):
    """用户修习状态"""
    xp: int
    rank: str                # 初窥门径 / 略有小成 / 融会贯通 / 炉火纯青 / 一代宗师
    rank_index: int          # 0-4
    xp_to_next: int          # 距离下一段位所需 XP
    skill_trees: list[SkillTreeProgress]  # 6 条


class DailyQuest(BaseModel):
    """每日任务"""
    id: int
    quest_template_id: str
    title: str
    description: str
    module: str
    skill_tree: str
    xp_reward: int
    status: str              # pending | completed | claimed
    icon: str = "📋"


class WeeklyChallenge(BaseModel):
    """每周挑战"""
    week_label: str          # "2026-W27"
    theme: str               # "青瓷周"
    description: str
    tasks_completed: int
    tasks_total: int
    reward_stamp_name: str   # 限定印章名
    reward_stamp_icon: str   # 印章图标
    expires_at: str          # ISO 日期


class QuestCompleteResponse(BaseModel):
    """任务完成响应"""
    xp_gained: int
    total_xp: int
    new_rank: Optional[str] = None      # 升级后的段位，未升级则为 None
    new_rank_index: Optional[int] = None
    stamp_earned: Optional[dict] = None  # 获得的新印章信息
