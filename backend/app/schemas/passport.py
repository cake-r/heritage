"""数字文博护照相关 Pydantic Schema"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class StampConfig(BaseModel):
    """stamps.json 中的印章定义"""
    type: str
    module: str
    name: str
    description: str
    icon: str
    rarity: str  # common / rare / epic


class EarnedStamp(BaseModel):
    """用户已获得的印章 — 合并 config 元数据 + 用户数据"""
    type: str
    module: str
    name: str
    description: str
    icon: str
    rarity: str
    earned_at: datetime
    progress: int


class PassportStatus(BaseModel):
    """护照概览"""
    total_stamps: int = 18             # 总印章数
    earned_count: int = 0              # 已获得印章数
    common_count: int = 0              # 普通印章数
    rare_count: int = 0                # 稀有印章数
    epic_count: int = 0                # 传说印章数
    completion_percentage: float = 0.0 # 完成度百分比
    last_earned: list[EarnedStamp] = []  # 最近获得的5枚


class StampEarnResponse(BaseModel):
    """印章获取响应"""
    earned: bool
    stamp: EarnedStamp | None = None
    is_new: bool = False  # True = 首次获得此印章


# ── Passport 2.0 新增 ──

class TimelineMilestone(BaseModel):
    """探索时间轴里程碑"""
    type: str           # first_recognition / first_restoration / first_creation / first_stamp / first_cultivation
    title: str
    description: str
    date: Optional[datetime] = None
    icon: str
    module: str


class RegionProgress(BaseModel):
    """地域探索进度"""
    region_code: str
    region_name: str
    unlocked_at: Optional[datetime] = None
    item_count: int = 0


class PassportExport(BaseModel):
    """护照导出"""
    user_name: str
    total_stamps: int
    earned_count: int
    completion_percentage: float
    stamps: list[EarnedStamp] = []
    timeline: list[TimelineMilestone] = []
    regions: list[RegionProgress] = []
    exported_at: datetime
