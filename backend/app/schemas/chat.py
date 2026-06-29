"""虚拟传承人对话 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel, Field


class CharacterInfo(BaseModel):
    id: str
    name: str
    avatar: str = ""
    expertise: list[str] = []
    greeting: str = ""
    tools: list[str] = []
    quick_questions: list[str] = []


class CreateSessionRequest(BaseModel):
    persona: str = Field(..., min_length=1, max_length=50)


class ChatSessionResponse(BaseModel):
    id: int
    persona: str
    title: str
    updated_at: datetime
    created_at: datetime
    preview: str = ""  # 最后一条消息预览
    available_tools: list[str] = []
    inheritor_name: str = ""
    inheritor_avatar: str = ""

    model_config = {"from_attributes": True}


class ChatMessageResponse(BaseModel):
    id: int
    role: str  # user | assistant
    content: str
    image_url: str | None = None
    voice_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(BaseModel):
    id: int
    persona: str
    title: str
    messages: list[ChatMessageResponse]
    created_at: datetime
    updated_at: datetime
    available_tools: list[str] = []
    quick_questions: list[str] = []

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class SSEDoneData(BaseModel):
    message_id: int
    quick_questions: list[str] = []
