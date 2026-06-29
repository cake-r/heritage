"""全局异常处理"""

from fastapi import HTTPException, status


class AppException(HTTPException):
    """应用自定义异常"""
    def __init__(self, detail: str, code: int = 400):
        super().__init__(status_code=code, detail=detail)


class AuthException(AppException):
    def __init__(self, detail: str = "认证失败"):
        super().__init__(detail=detail, code=401)


class NotFoundException(AppException):
    def __init__(self, detail: str = "资源不存在"):
        super().__init__(detail=detail, code=404)
