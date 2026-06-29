"""数字文博护照相关 Pydantic Schema"""
from datetime import datetime
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
