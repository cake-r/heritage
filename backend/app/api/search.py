"""全局搜索 API — 跨模块统一搜索"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
import json

from app.models.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.exhibition import HeritageItem, UserUpload
from app.models.custom_inheritor import CustomInheritor

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1, max_length=100, description="搜索关键词"),
    scope: str = Query("all", description="搜索范围: all | heritage | inheritor | upload"),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """全局搜索：跨藏品、传承人、用户上传等模块"""
    results = []
    keyword = f"%{q}%"

    # 1. 非遗藏品
    if scope in ("all", "heritage"):
        heritage = db.query(HeritageItem).filter(
            or_(
                HeritageItem.name.ilike(keyword),
                HeritageItem.category.ilike(keyword),
                HeritageItem.region.ilike(keyword),
                HeritageItem.era.ilike(keyword),
                HeritageItem.description.ilike(keyword),
            )
        ).limit(limit).all()

        for h in heritage:
            images = json.loads(h.images_json or "[]")
            results.append({
                "id": h.id,
                "type": "heritage",
                "title": h.name,
                "subtitle": f"{h.category or ''} · {h.era or ''} · {h.region or ''}",
                "image_url": images[0] if images else "",
                "route": f"/exhibition?id={h.id}",
                "category": h.category or "",
                "region": h.region or "",
            })

    # 2. 传承人（仅系统传承人 + 公开自定义传承人）
    if scope in ("all", "inheritor"):
        from pathlib import Path
        config_path = Path(__file__).parent.parent.parent / "config" / "characters.json"
        if config_path.exists():
            with open(config_path, "r", encoding="utf-8") as f:
                chars = json.load(f)
            for char in chars:
                if (keyword.strip("%") in char.get("name", "") or
                    keyword.strip("%") in char.get("id", "") or
                    any(keyword.strip("%") in e for e in char.get("expertise", []))):
                    results.append({
                        "id": 0,
                        "type": "inheritor",
                        "title": char["name"],
                        "subtitle": " · ".join(char.get("expertise", [])[:2]) if char.get("expertise") else "系统传承人",
                        "image_url": char.get("avatar", ""),
                        "route": f"/workshop?persona={char['id']}",
                        "category": char.get("expertise", [""])[0] if char.get("expertise") else "",
                        "region": "",
                    })

        # 自定义传承人
        customs = db.query(CustomInheritor).filter(
            or_(
                CustomInheritor.name.ilike(keyword),
                CustomInheritor.category.ilike(keyword),
            ),
            CustomInheritor.is_public == True,
        ).limit(limit).all()

        for c in customs:
            results.append({
                "id": c.id,
                "type": "inheritor",
                "title": c.name,
                "subtitle": f"{c.category or ''} · 自定义传承人",
                "image_url": c.avatar_url or "",
                "route": f"/workshop?persona=custom:{c.id}",
                "category": c.category or "",
                "region": "",
            })

    # 3. 用户上传
    if scope in ("all", "upload"):
        uploads = db.query(UserUpload).filter(
            UserUpload.is_approved == True,
            or_(
                UserUpload.title.ilike(keyword),
                UserUpload.category.ilike(keyword),
            )
        ).limit(limit).all()

        for u in uploads:
            images = json.loads(u.images_json or "[]")
            results.append({
                "id": u.id,
                "type": "upload",
                "title": u.title,
                "subtitle": f"{u.category or ''} · 用户上传",
                "image_url": images[0] if images else "",
                "route": f"/exhibition?id={u.id}",
                "category": u.category or "",
                "region": u.region or "",
            })

    # 去重 + 截断
    seen = set()
    unique = []
    for r in results:
        key = (r["type"], r["id"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return {"query": q, "results": unique[:limit], "total": len(unique)}
