"""用户中心相关 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel, Field


class UserProfileResponse(BaseModel):
    id: int
    username: str
    nickname: str
    avatar_url: str
    voice_speed: float = 1.0
    theme: str = "light"
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    nickname: str = Field(default="", max_length=50)
    avatar_url: str = Field(default="", max_length=500)


class FavoriteCreate(BaseModel):
    item_type: str = Field(..., pattern=r"^(heritage|generated|user_upload)$")
    item_id: int = Field(..., gt=0)


class FavoriteItem(BaseModel):
    """收藏列表中的单条 — 解析后的完整信息"""
    id: int                          # favorite record id
    item_type: str                   # heritage | generated | user_upload
    item_id: int
    # 解析后的详情
    title: str = ""
    image_url: str = ""
    category: str = ""
    creator: str = ""                # 作者/上传者
    created_at: datetime | None = None


class UserStatistics(BaseModel):
    recognition_count: int = 0
    generation_count: int = 0
    chat_count: int = 0
    favorite_count: int = 0
    upload_count: int = 0
    passport_stamp_count: int = 0
    restoration_count: int = 0
