"""鉴权相关 Pydantic Schema"""

import re
from pydantic import BaseModel, Field, field_validator


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)
    nickname: str = Field(default="")

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        """密码必须包含字母和数字，至少 8 位"""
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("密码必须包含至少一个字母")
        if not re.search(r"\d", v):
            raise ValueError("密码必须包含至少一个数字")
        return v


class UserLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)


class UserPublic(BaseModel):
    id: int
    username: str
    nickname: str
    avatar_url: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
