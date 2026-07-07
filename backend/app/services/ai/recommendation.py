"""个性化推荐引擎 — 兴趣画像更新 + 协同过滤 + LLM推荐理由"""

import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.recommendation import UserInterestProfile
from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession, ChatMessage
from app.models.favorite import Favorite
from app.models.exhibition import HeritageItem, UserUpload
from app.models.custom_inheritor import CustomInheritor
from app.services.ai.base import mock_mode, load_mock

logger = logging.getLogger("recommendation")

COLD_START_THRESHOLD = 5  # 前5次交互后开始个性化


# === 画像更新 ===

def update_interest_profile(user_id: int, action_type: str, action_data: dict, db: Session):
    """
    更新用户兴趣画像 — 增量累加品类/技法/地域权重。

    设计为 fire-and-forget 调用：在用户完成操作后异步更新，不阻塞响应。
    """
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()

    if not profile:
        profile = UserInterestProfile(user_id=user_id)
        db.add(profile)

    # 更新品类权重
    cat_weights = json.loads(profile.category_weights_json or "{}")
    tech_weights = json.loads(profile.technique_weights_json or "{}")
    region_weights = json.loads(profile.region_weights_json or "{}")

    category = action_data.get("category", "")
    technique = action_data.get("technique", "")
    region = action_data.get("region", "")
    techniques = action_data.get("techniques", [])  # 批量技法列表
    regions = action_data.get("regions", [])         # 批量地域列表

    # 品类权重 +1
    if category:
        cat_weights[category] = cat_weights.get(category, 0) + 1.0

    # 技法权重 +1
    if technique:
        tech_weights[technique] = tech_weights.get(technique, 0) + 1.0
    for t in (techniques or []):
        tech_weights[t] = tech_weights.get(t, 0) + 0.5

    # 地域权重 +1
    if region:
        region_weights[region] = region_weights.get(region, 0) + 1.0
    for r in (regions or []):
        region_weights[r] = region_weights.get(r, 0) + 0.5

    # 归一化 (仅在向量非空时)
    _normalize(cat_weights)
    _normalize(tech_weights)
    _normalize(region_weights)

    profile.category_weights_json = json.dumps(cat_weights, ensure_ascii=False)
    profile.technique_weights_json = json.dumps(tech_weights, ensure_ascii=False)
    profile.region_weights_json = json.dumps(region_weights, ensure_ascii=False)
    profile.interaction_count = (profile.interaction_count or 0) + 1
    profile.updated_at = datetime.utcnow()

    db.commit()
    logger.debug(f"用户 {user_id} 画像更新: interaction #{profile.interaction_count}, "
                 f"品类维度={len(cat_weights)}, 技法维度={len(tech_weights)}, 地域维度={len(region_weights)}")


def _normalize(weights: dict):
    """原地归一化权重向量（和=1）"""
    total = sum(weights.values())
    if total > 0:
        for k in weights:
            weights[k] = weights[k] / total


# === 推荐生成 ===

def generate_feed(user_id: int, page: int = 1, size: int = 8, db: Session = None) -> dict:
    """
    生成个性化推荐流。

    冷启动 (interaction_count < 5): 按 created_at 降序 (popularity 代理)
    活跃: 加权点积评分 + LLM 生成推荐理由
    """
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()

    is_cold = not profile or profile.interaction_count < COLD_START_THRESHOLD

    if mock_mode():
        mock_data = load_mock("recommendation_feed.json")
        if mock_data:
            return {
                "items": mock_data.get("items", [])[:size],
                "page": page,
                "size": size,
                "profile_status": "cold_start" if is_cold else "active",
            }

    if is_cold:
        return _cold_start_feed(page, size, db)

    return _personalized_feed(user_id, profile, page, size, db)


def _cold_start_feed(page: int, size: int, db: Session) -> dict:
    """冷启动: 返回最新藏品 + 用户上传 (按创建时间排序)"""
    items = []

    # 最新 heritage items
    heritage = db.query(HeritageItem).order_by(desc(HeritageItem.created_at)).limit(size).all()
    for h in heritage:
        images = json.loads(h.images_json or "[]")
        items.append({
            "id": h.id,
            "item_type": "heritage",
            "title": h.name,
            "image_url": images[0] if images else "",
            "category": h.category or "",
            "region": h.region,
            "reason": "热门藏品推荐",
            "score": 0.5,
            "target_route": f"/exhibition?id={h.id}",
        })

    # 补充用户上传
    if len(items) < size:
        uploads = db.query(UserUpload).filter(UserUpload.is_approved == True).order_by(
            desc(UserUpload.created_at)
        ).limit(size - len(items)).all()
        for u in uploads:
            images = json.loads(u.images_json or "[]")
            items.append({
                "id": u.id,
                "item_type": "user_upload",
                "title": u.title,
                "image_url": images[0] if images else "",
                "category": u.category or "",
                "region": u.region,
                "reason": "社区热门上传",
                "score": 0.4,
                "target_route": f"/exhibition?id={u.id}",
            })

    return {"items": items, "page": page, "size": size, "profile_status": "cold_start"}


def _personalized_feed(user_id: int, profile: UserInterestProfile, page: int, size: int, db: Session) -> dict:
    """个性化推荐: 两阶段 (召回→排序) + 探索/利用机制"""
    import random
    from app.models.favorite import Favorite

    cat_weights = json.loads(profile.category_weights_json or "{}")
    tech_weights = json.loads(profile.technique_weights_json or "{}")
    region_weights = json.loads(profile.region_weights_json or "{}")

    # 探索比例 — 随交互次数递减
    explore_ratio = max(0.05, 0.25 - profile.interaction_count * 0.01)

    # === Stage 1: 召回 (扩大候选池至 ~200) ===
    candidates: list[dict] = []

    # 1a. 品类召回: 用户 top-5 品类下的所有条目
    top_categories = sorted(cat_weights.keys(), key=lambda k: cat_weights[k], reverse=True)[:5]
    if top_categories:
        heritage = db.query(HeritageItem).filter(
            HeritageItem.category.in_(top_categories)
        ).all()
    else:
        heritage = db.query(HeritageItem).all()

    for h in heritage:
        score = _compute_item_score(h.category, h.region, h.techniques_json, cat_weights, tech_weights, region_weights)
        images = json.loads(h.images_json or "[]")
        favorites = db.query(Favorite).filter(Favorite.item_id == h.id, Favorite.item_type == "heritage").count()
        candidates.append({
            "id": h.id, "item_type": "heritage", "title": h.name,
            "image_url": images[0] if images else "", "category": h.category or "",
            "region": h.region, "score": score, "popularity": favorites,
            "target_route": f"/exhibition?id={h.id}",
        })

    # 1b. 地域召回
    top_regions = sorted(region_weights.keys(), key=lambda k: region_weights[k], reverse=True)[:3]
    if top_regions:
        region_items = db.query(HeritageItem).filter(
            HeritageItem.region.in_(top_regions)
        ).all()
        existing_ids = {c["id"] for c in candidates if c["item_type"] == "heritage"}
        for h in region_items:
            if h.id not in existing_ids:
                score = _compute_item_score(h.category, h.region, h.techniques_json, cat_weights, tech_weights, region_weights) * 0.8
                images = json.loads(h.images_json or "[]")
                candidates.append({
                    "id": h.id, "item_type": "heritage", "title": h.name,
                    "image_url": images[0] if images else "", "category": h.category or "",
                    "region": h.region, "score": score, "popularity": 0,
                    "target_route": f"/exhibition?id={h.id}",
                })

    # 1c. 社区上传
    uploads = db.query(UserUpload).filter(UserUpload.is_approved == True).all()
    for u in uploads:
        score = _compute_item_score(u.category, u.region, u.techniques_json, cat_weights, tech_weights, region_weights)
        images = json.loads(u.images_json or "[]")
        candidates.append({
            "id": u.id, "item_type": "user_upload", "title": u.title,
            "image_url": images[0] if images else "", "category": u.category or "",
            "region": u.region, "score": score, "popularity": 0,
            "target_route": f"/exhibition?id={u.id}",
        })

    # === Stage 2: 排序 (加权打分) ===
    max_pop = max((c.get("popularity", 0) or 1) for c in candidates) if candidates else 1
    for c in candidates:
        c["_final_score"] = (
            0.40 * c["score"] +                       # 品类匹配
            0.20 * (c.get("popularity", 0) / max_pop) +  # 热度归一化
            0.25 * _freshness_score(c) +               # 新鲜度
            0.15 * _semantic_boost(c, cat_weights)     # 语义增强
        )

    # === 探索/利用 ===
    candidates.sort(key=lambda x: x["_final_score"], reverse=True)

    exploit_count = int(size * (1 - explore_ratio))
    explore_count = size - exploit_count

    page_items = candidates[:exploit_count]

    # 探索: 从用户未交互的品类中随机采样
    explored_categories = set(cat_weights.keys())
    unexplored = [c for c in candidates[exploit_count:] if c["category"] not in explored_categories]
    if unexplored and explore_count > 0:
        random.shuffle(unexplored)
        page_items += unexplored[:explore_count]

    # 补充不足的
    if len(page_items) < size:
        remaining = [c for c in candidates if c not in page_items]
        page_items += remaining[:size - len(page_items)]

    page_items = page_items[:size]

    # 为 top 推荐生成 LLM 理由（仅 top 3 调用 LLM 降本）
    for i, item in enumerate(page_items):
        if i < 3 and not mock_mode():
            try:
                item["reason"] = _generate_reason(user_id, item, cat_weights, tech_weights)
            except Exception:
                item["reason"] = _default_reason(item, cat_weights)
        else:
            item["reason"] = _default_reason(item, cat_weights)

        # 清理内部字段
        item.pop("_final_score", None)
        item.pop("popularity", None)

    return {"items": page_items, "page": page, "size": size, "profile_status": "active"}


def _freshness_score(item: dict) -> float:
    """新鲜度评分 — 简单返回固定值 (后续可接 created_at)"""
    return 0.7  # 默认新鲜度


def _semantic_boost(item: dict, cat_weights: dict) -> float:
    """语义增强 — 品类深度匹配加权"""
    cat = item.get("category", "")
    if cat in cat_weights:
        return min(1.0, cat_weights[cat] / 5.0)
    return 0.0


def _default_reason(item: dict, cat_weights: dict) -> str:
    """基于品类生成默认推荐理由"""
    top_cat = _top_key(cat_weights)
    if item.get("category") in cat_weights:
        return f"与你喜欢的 {item['category']} 相关"
    elif top_cat:
        return f"探索更多 {item.get('category', '非遗')} 文化"
    return "发现非遗之美"


def _compute_item_score(category: str, region: str, techniques_json: str,
                         cat_weights: dict, tech_weights: dict, region_weights: dict) -> float:
    """计算候选项与用户兴趣向量的加权匹配分"""
    score = 0.0

    # 品类匹配 (权重 0.4)
    if category and category in cat_weights:
        score += 0.4 * cat_weights[category]

    # 技法匹配 (权重 0.3)
    techniques_raw = json.loads(techniques_json or "[]")
    # techniques_json 格式为 [{"name":"平针绣","desc":"..."}]，需提取 name 字段
    techniques = [t["name"] if isinstance(t, dict) else t for t in techniques_raw]
    if techniques:
        tech_match = sum(tech_weights.get(t, 0) for t in techniques) / len(techniques)
        score += 0.3 * tech_match

    # 地域匹配 (权重 0.3)
    if region and region in region_weights:
        score += 0.3 * region_weights[region]

    return round(score, 4)


def _generate_reason(user_id: int, item: dict, cat_weights: dict, tech_weights: dict) -> str:
    """调用 DeepSeek 生成一句可解释的推荐理由"""
    from app.services.ai.llm import chat

    top_cats = ", ".join([k for k, v in sorted(cat_weights.items(), key=lambda x: -x[1])[:3]])
    prompt = f"""你是非遗文化推荐助手。请用一句话(15-25字)解释为什么向用户推荐这个非遗项目。

用户偏好品类: {top_cats}
推荐项目: {item['title']} (品类:{item['category']}, 地域:{item.get('region','')})

要求: 自然、亲切、有文化感，不提及算法或权重。仅输出推荐理由，不要任何前缀。"""

    try:
        messages = [{"role": "user", "content": prompt}]
        reason = chat(messages, stream=False)
        return reason.strip()[:60]
    except Exception:
        return f"与你喜欢的 {_top_key(cat_weights)} 相关"


def _top_key(weights: dict) -> str:
    """返回权重最高的键"""
    if not weights:
        return "非遗文化"
    return max(weights, key=weights.get)


# === 模块级推荐 ===

def get_module_recommendations(user_id: int, module: str, db: Session) -> dict:
    """
    针对特定模块的个性化推荐。

    - exhibition: 品类0.4 + 技法0.3 + 地域0.3
    - workshop: 传承人专长匹配
    - knowledge_graph: 技法 + 地域重叠
    """
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()

    cat_weights = json.loads(profile.category_weights_json or "{}") if profile else {}
    tech_weights = json.loads(profile.technique_weights_json or "{}") if profile else {}
    region_weights = json.loads(profile.region_weights_json or "{}") if profile else {}

    if module == "exhibition":
        return _module_exhibition(cat_weights, tech_weights, region_weights, db)
    elif module == "workshop":
        return _module_workshop(cat_weights, tech_weights, db)
    elif module == "knowledge-graph":
        return _module_knowledge_graph(cat_weights, tech_weights, region_weights, db)
    else:
        return {"module": module, "items": []}


def _module_exhibition(cat_weights, tech_weights, region_weights, db) -> dict:
    """展览模块推荐: 品类+技法+地域综合评分"""
    items = []
    heritage = db.query(HeritageItem).all()
    for h in heritage:
        score = _compute_item_score(h.category, h.region, h.techniques_json, cat_weights, tech_weights, region_weights)
        images = json.loads(h.images_json or "[]")
        items.append({
            "id": h.id, "item_type": "heritage", "title": h.name,
            "image_url": images[0] if images else "",
            "category": h.category or "", "region": h.region,
            "score": score, "reason": f"品类匹配 {h.category}" if score > 0.1 else "探索更多非遗文化",
            "target_route": f"/exhibition?id={h.id}",
        })
    items.sort(key=lambda x: x["score"], reverse=True)
    return {"module": "exhibition", "items": items[:6]}


def _module_workshop(cat_weights, tech_weights, db) -> dict:
    """工坊模块推荐: 传承人专长与用户兴趣匹配"""
    items = []
    inheritors = db.query(CustomInheritor).filter(CustomInheritor.is_public == True).all()

    # 也包含预设传承人 (从 chat characters config 读取)
    from pathlib import Path
    import json as _json
    config_path = Path(__file__).parent.parent.parent.parent / "config" / "characters.json"
    preset_chars = []
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            preset_chars = _json.load(f)

    for char in preset_chars:
        score = 0.0
        if char.get("category", "") in cat_weights:
            score += cat_weights[char["category"]]
        expertise = char.get("expertise", [])
        if isinstance(expertise, str):
            expertise = [t.strip() for t in expertise.split(",") if t.strip()]
        for tech in expertise:
            if tech in tech_weights:
                score += tech_weights.get(tech, 0)
        items.append({
            "id": 0, "item_type": "inheritor", "title": char["name"],
            "image_url": char.get("avatar_url", ""),
            "category": char.get("category", ""), "region": None,
            "score": score, "reason": f"专长匹配: {char.get('category','')}",
            "target_route": f"/workshop?persona={char['id']}",
        })

    for inh in inheritors:
        score = 0.0
        if inh.category in cat_weights:
            score += cat_weights[inh.category]
        items.append({
            "id": inh.id, "item_type": "inheritor", "title": inh.name,
            "image_url": inh.avatar_url or "",
            "category": inh.category or "", "region": None,
            "score": score,
            "reason": f"与你喜欢的 {inh.category} 相关" if score > 0 else "探索更多传承人",
            "target_route": f"/workshop?persona=custom:{inh.id}",
        })

    items.sort(key=lambda x: x["score"], reverse=True)
    return {"module": "workshop", "items": items[:3]}


def _module_knowledge_graph(cat_weights, tech_weights, region_weights, db) -> dict:
    """知识图谱模块推荐: 返回用户兴趣相关的技法/地域节点"""
    items = []

    # 推荐与用户 top 技法相关的 heritage items
    top_techniques = sorted(tech_weights.items(), key=lambda x: -x[1])[:3]
    for tech_name, weight in top_techniques:
        # 查找使用此技法的 heritage items
        heritage = db.query(HeritageItem).all()
        for h in heritage:
            techniques_raw = json.loads(h.techniques_json or "[]")
            techniques = [t["name"] if isinstance(t, dict) else t for t in techniques_raw]
            if tech_name in techniques:
                images = json.loads(h.images_json or "[]")
                items.append({
                    "id": h.id, "item_type": "heritage", "title": f"{h.name} · {tech_name}",
                    "image_url": images[0] if images else "",
                    "category": h.category or "", "region": h.region,
                    "score": weight, "reason": f"你感兴趣的技法: {tech_name}",
                    "target_route": f"/knowledge-graph?technique={tech_name}",
                })

    # 去重
    seen = set()
    unique_items = []
    for item in items:
        key = (item["id"], item["item_type"])
        if key not in seen:
            seen.add(key)
            unique_items.append(item)

    unique_items.sort(key=lambda x: x["score"], reverse=True)
    return {"module": "knowledge-graph", "items": unique_items[:6]}


# === Fire-and-forget 辅助 ===

def trigger_profile_update(user_id: int, action_type: str, action_data: dict):
    """串行写入队列 画像更新 — 避免多线程竞争 SQLite 写锁"""
    from app.models.database import SessionLocal
    from app.utils.write_queue import enqueue_write

    def _update():
        db = SessionLocal()
        try:
            update_interest_profile(user_id, action_type, action_data, db)
        except Exception as e:
            db.rollback()
            logger.warning(f"画像更新失败 (user={user_id}, action={action_type}): {e}")
        finally:
            db.close()

    enqueue_write(_update, name="profile_update")
