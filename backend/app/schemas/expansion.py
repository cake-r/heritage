"""知识库扩充 — Pydantic Schemas"""

from datetime import datetime
from pydantic import BaseModel, Field


class TechniqueItem(BaseModel):
    name: str
    desc: str = ""


class InheritorItem(BaseModel):
    name: str
    title: str = ""
    desc: str = ""


class ExpandRequest(BaseModel):
    """启动扩充请求"""
    count: int = Field(default=5, ge=1, le=30, description="扩充数量 (1-30)")
    categories: list[str] | None = Field(default=None, description="指定品类，不指定则自动轮询")
    regions: list[str] | None = Field(default=None, description="偏好地域 (如 ['江苏苏州', '四川成都'])")
    eras: list[str] | None = Field(default=None, description="偏好年代 (如 ['唐代', '宋代', '明清'])")
    keywords: list[str] | None = Field(default=None, description="自定义搜索关键词 (如 ['蜀绣', '景德镇瓷器'])")


class ExpandResponse(BaseModel):
    task_id: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str          # running | completed | failed
    total: int
    completed: int
    items_found: int
    error: str | None = None


class ExpansionQueueItem(BaseModel):
    """待审核项"""
    id: int
    status: str
    name: str
    category: str
    region: str | None = None
    era: str | None = None
    description: str | None = None
    techniques: list[TechniqueItem] = []
    inheritors: list[InheritorItem] = []
    images: list[str] = []
    cultural_meaning: str | None = None
    search_keyword: str | None = None
    source_urls: list[str] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ExpansionQueueUpdate(BaseModel):
    """编辑待审核项 (审批前修改)"""
    name: str | None = None
    category: str | None = None
    region: str | None = None
    era: str | None = None
    description: str | None = None
    techniques: list[TechniqueItem] | None = None
    inheritors: list[InheritorItem] | None = None
    cultural_meaning: str | None = None


class ReviewAction(BaseModel):
    """审批操作"""
    action: str = Field(..., pattern="^(approve|reject)$")


class PaginatedResponse(BaseModel):
    items: list[ExpansionQueueItem]
    total: int
    page: int
    pages: int
