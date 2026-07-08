"""自定义传承人 schemas"""

from datetime import datetime
from pydantic import BaseModel, Field


# === 品类目录 ===

class CategoryInfo(BaseModel):
    id: str
    name: str
    icon: str = "🏮"
    description: str = ""


# === 工具预览 ===

class ToolCapabilityPreview(BaseModel):
    tool_id: str
    tool_name: str
    description: str
    sample_output: str = ""


# === 人设生成 ===

class GeneratePersonaRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="传承人名称")
    category: str = Field(..., min_length=1, max_length=50, description="非遗品类")
    personality: str = Field(default="", max_length=500, description="性格描述")
    bio: str = Field(default="", max_length=200, description="一句话简介")
    selected_tools: list[str] = Field(default_factory=list, description="选择的工具列表")
    expertise: list[str] = Field(default_factory=list, description="专长标签")


class GeneratePersonaResponse(BaseModel):
    persona: str  # system_prompt
    greeting: str
    quick_questions: list[str]
    style: str
    suggested_avatar_prompt: str


# === 自定义传承人 ===

class CustomInheritorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=50)
    persona: str = Field(..., min_length=1)
    greeting: str = Field(..., min_length=1)
    tools: list[str] = Field(default_factory=list)
    domain_prompts: dict[str, str] = Field(default_factory=dict)
    style: str = Field(default="", max_length=200)
    expertise: list[str] = Field(default_factory=list)
    avatar_url: str = Field(default="", max_length=500)


class CustomInheritorUpdate(BaseModel):
    name: str | None = Field(None, max_length=50)
    persona: str | None = None
    greeting: str | None = None
    tools: list[str] | None = None
    domain_prompts: dict[str, str] | None = None
    style: str | None = Field(None, max_length=200)
    expertise: list[str] | None = None
    is_public: bool | None = None
    avatar_url: str | None = Field(None, max_length=500)


class CustomInheritorResponse(BaseModel):
    id: int
    user_id: int
    name: str
    category: str
    avatar_url: str = ""
    persona: str  # truncated to 100 chars in list context
    greeting: str
    tools: list[str] = []
    domain_prompts: dict[str, str] = {}
    style: str = ""
    expertise: list[str] = []
    is_public: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class InheritorStats(BaseModel):
    total: int
    limit: int = 10
    remaining: int
