"""JWT 签发与验证 + 密码哈希"""

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS


# PBKDF2 iteration count (≥600,000 per OWASP 2025 recommendation)
PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 密码哈希（600,000 次迭代）"""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    # 格式: salt_hex:iterations:key_hex (向前兼容旧格式 salt_hex:key_hex)
    return f"{salt.hex()}:{PBKDF2_ITERATIONS}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码 — 兼容旧格式（100,000次迭代）和新格式（600,000次迭代）"""
    try:
        parts = hashed_password.split(":")
        if len(parts) == 3:
            # 新格式: salt:iterations:key
            salt_hex, iterations_str, key_hex = parts
            iterations = int(iterations_str)
        else:
            # 旧格式: salt:key (默认 100,000 次迭代)
            salt_hex, key_hex = parts
            iterations = 100_000
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt, iterations)
        return hmac.compare_digest(new_key, key)
    except (ValueError, AttributeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
