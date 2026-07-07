"""Admin API — Prompt 管理（Phase C Step 8 极简版）

不做 diff 对比、在线测试、变量高亮预览。
仅支持：列表查看、编辑内容、切换激活版本、查看历史。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_current_admin
from app.models.database import get_db
from app.models.user import User
from app.models.prompt import Prompt
from app.schemas.admin import (
    PromptItem,
    PromptModule,
    PromptUpdateRequest,
    PromptListResponse,
)
from app.schemas.common import MessageResponse
from app.utils.exceptions import AppException

logger = logging.getLogger("admin_prompts")

router = APIRouter()

# 5 个 Prompt 模块
PROMPT_MODULES = ["recognition", "companion", "generation", "story", "recommendation"]


# ── 内存缓存 ──────────────────────────────────────────────

_prompt_cache: dict[str, str] = {}  # module → active prompt content


def load_prompts_from_db():
    """启动时从 DB 加载所有激活的 Prompt 到内存缓存"""
    global _prompt_cache
    from app.models.database import SessionLocal
    db = SessionLocal()
    try:
        for module in PROMPT_MODULES:
            active = db.query(Prompt).filter(
                Prompt.module == module,
                Prompt.is_active == True,
            ).order_by(desc(Prompt.version)).first()
            if active:
                _prompt_cache[module] = active.content
        logger.info(f"Prompt 缓存加载完成: {list(_prompt_cache.keys())}")
    except Exception as e:
        logger.warning(f"Prompt 缓存加载失败 (可能表尚未创建): {e}")
    finally:
        db.close()


def get_active_prompt(module: str) -> str | None:
    """获取指定模块的当前激活 Prompt（从内存缓存）"""
    return _prompt_cache.get(module)


def _refresh_cache(db: Session):
    """刷新内存缓存（激活状态变更后调用）"""
    global _prompt_cache
    _prompt_cache.clear()
    for module in PROMPT_MODULES:
        active = db.query(Prompt).filter(
            Prompt.module == module,
            Prompt.is_active == True,
        ).order_by(desc(Prompt.version)).first()
        if active:
            _prompt_cache[module] = active.content


# ── 端点 ──────────────────────────────────────────────────

@router.get("/api/admin/prompts", response_model=PromptListResponse)
def list_prompts(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """获取所有模块的 Prompt 列表（含激活状态和历史版本）"""
    modules = []
    for module in PROMPT_MODULES:
        prompts = db.query(Prompt).filter(
            Prompt.module == module
        ).order_by(desc(Prompt.version)).all()

        active_id = None
        prompt_items = []
        for p in prompts:
            prompt_items.append(PromptItem(
                id=p.id,
                module=p.module,
                version=p.version,
                content=p.content,
                is_active=p.is_active,
                description=p.description or "",
                created_at=p.created_at,
                updated_at=p.updated_at,
            ))
            if p.is_active:
                active_id = p.id

        modules.append(PromptModule(
            module=module,
            prompts=prompt_items,
            active_id=active_id,
        ))

    return PromptListResponse(modules=modules)


@router.put("/api/admin/prompts/{prompt_id}", response_model=PromptItem)
def update_prompt(
    prompt_id: int,
    body: PromptUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """更新 Prompt 内容或切换激活状态

    - 设置 is_active=true 时会自动将同模块其他版本设为 false
    - 内容变更会自动生成新版本号
    """
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise AppException("Prompt 不存在", code=404)

    # 如果内容有变更，创建新版本而非直接修改
    if body.content is not None and body.content != prompt.content:
        # 获取该模块的最大版本号
        max_ver = db.query(Prompt).filter(
            Prompt.module == prompt.module
        ).order_by(desc(Prompt.version)).first()
        new_version = (max_ver.version + 1) if max_ver else 1

        new_prompt = Prompt(
            module=prompt.module,
            version=new_version,
            content=body.content,
            is_active=False,
            description=body.description or f"v{new_version}: 内容更新",
        )
        db.add(new_prompt)
        db.flush()
        prompt = new_prompt  # 后续操作针对新版本

    # 切换激活状态
    if body.is_active is True:
        # 将同模块其他激活版本取消
        db.query(Prompt).filter(
            Prompt.module == prompt.module,
            Prompt.is_active == True,
            Prompt.id != prompt.id,
        ).update({"is_active": False})
        prompt.is_active = True

        # 刷新内存缓存
        _refresh_cache(db)

    # 更新描述
    if body.description is not None:
        prompt.description = body.description

    db.commit()
    db.refresh(prompt)

    return PromptItem(
        id=prompt.id,
        module=prompt.module,
        version=prompt.version,
        content=prompt.content,
        is_active=prompt.is_active,
        description=prompt.description or "",
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
    )


@router.get("/api/admin/prompts/{prompt_id}/history")
def get_prompt_history(
    prompt_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """获取指定 Prompt 所在模块的全部历史版本（用于回滚参考）"""
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise AppException("Prompt 不存在", code=404)

    history = db.query(Prompt).filter(
        Prompt.module == prompt.module
    ).order_by(desc(Prompt.version)).all()

    return [
        PromptItem(
            id=p.id,
            module=p.module,
            version=p.version,
            content=p.content,
            is_active=p.is_active,
            description=p.description or "",
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in history
    ]
