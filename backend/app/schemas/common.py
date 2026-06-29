"""通用响应模型"""

from typing import TypeVar, Generic, Optional
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    pages: int

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
