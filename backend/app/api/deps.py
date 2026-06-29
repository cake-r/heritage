"""FastAPI 依赖注入"""

from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.models.database import get_db, SessionLocal
from app.models.user import User
from app.utils.security import decode_access_token
from app.utils.exceptions import AuthException

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """从JWT Token解析当前用户"""
    if not credentials:
        raise AuthException("请先登录")

    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise AuthException("Token已过期或无效")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthException("Token格式错误")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise AuthException("用户不存在")

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """可选的用户认证 (公开页面也可能需要)"""
    if not credentials:
        return None
    try:
        return get_current_user(credentials, db)
    except AuthException:
        return None
