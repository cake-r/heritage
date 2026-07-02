"""Admin API — 系统配置热更新"""

import json
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime

from app.models.database import get_db, engine, SessionLocal
from app.models.user import User
from app.api.deps import get_current_admin
from app.schemas.admin import ConfigUpdateRequest
from app.utils.cache import cache_delete, cache_key, PREFIX_CONFIG

logger = logging.getLogger("admin_config")
router = APIRouter()

# 默认配置值
DEFAULT_CONFIG = {
    "rate_limits": {
        "recognition": 50, "image_gen": 20, "chat": 200,
        "restoration": 30, "tts": 50, "embedding": 100,
        "companion": 100, "recommendation": 50, "expansion": 10,
    },
    "circuit_breaker": {"threshold": 5, "recovery_time": 300},
    "companion": {"cooldown_default": 180, "cooldown_high_value": 45},
    "recommendation": {"cold_start_threshold": 5, "explore_ratio": 0.2},
    "expansion": {"max_items_per_task": 20},
}


def _get_config_table():
    """获取或创建 system_config 表 (轻量, 不建 ORM model)"""
    return text("system_config")


@router.get("/api/admin/config")
def get_config(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """获取当前系统配置 (合并默认值)"""
    config = dict(DEFAULT_CONFIG)

    try:
        rows = db.execute(text("SELECT key, value_json, updated_at FROM system_config")).fetchall()
        for row in rows:
            try:
                config[row.key] = json.loads(row.value_json)
            except (json.JSONDecodeError, TypeError):
                config[row.key] = row.value_json
    except Exception:
        # system_config 表可能尚未创建
        pass

    return {"config": config}


@router.put("/api/admin/config")
def update_config(
    body: ConfigUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """热更新系统配置 — 写入 DB 并失效缓存"""
    # 确保 system_config 表存在
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS system_config (
                key VARCHAR(100) PRIMARY KEY,
                value_json TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception:
        db.rollback()

    now = datetime.utcnow().isoformat()
    for key, value in body.updates.items():
        value_json = json.dumps(value, ensure_ascii=False)
        db.execute(
            text("""
                INSERT INTO system_config (key, value_json, updated_at)
                VALUES (:key, :value, :now)
                ON CONFLICT(key) DO UPDATE SET value_json=:value, updated_at=:now
            """),
            {"key": key, "value": value_json, "now": now},
        )

    db.commit()

    # 失效配置缓存
    from app.utils.cache import is_redis_available
    if is_redis_available():
        cache_delete(cache_key(PREFIX_CONFIG, "all"))

    # 热应用部分配置 (内存中的可变值)
    _hot_apply(body.updates)

    logger.info(f"配置已热更新: {list(body.updates.keys())}")
    return {"status": "ok", "updated_keys": list(body.updates.keys())}


def _hot_apply(updates: dict) -> None:
    """将部分配置实时应用到内存中的模块级变量"""
    # 更新限流配额
    if "rate_limits" in updates:
        from app.utils.ai_governance import DEFAULT_DAILY_LIMITS
        DEFAULT_DAILY_LIMITS.update(updates["rate_limits"])
        logger.info("限流配额已热更新")

    # 更新熔断器参数
    if "circuit_breaker" in updates:
        cb = updates["circuit_breaker"]
        from app.utils.ai_governance import _circuit_state, _circuit_lock
        with _circuit_lock:
            if "threshold" in cb:
                _circuit_state["threshold"] = cb["threshold"]
            if "recovery_time" in cb:
                _circuit_state["recovery_time"] = cb["recovery_time"]
        logger.info("熔断器参数已热更新")


def load_config_from_db() -> dict:
    """服务启动时从 DB 加载配置 (在 lifespan 中调用)"""
    config = dict(DEFAULT_CONFIG)

    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT key, value_json FROM system_config")).fetchall()
        for row in rows:
            try:
                config[row.key] = json.loads(row.value_json)
            except (json.JSONDecodeError, TypeError):
                pass

        # 热应用
        _hot_apply({k: v for k, v in config.items() if k != "rate_limits"})
        if "rate_limits" in config:
            from app.utils.ai_governance import DEFAULT_DAILY_LIMITS
            DEFAULT_DAILY_LIMITS.update(config["rate_limits"])

    except Exception:
        pass
    finally:
        db.close()

    return config

