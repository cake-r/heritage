"""语义嵌入服务 — 为 heritage_items 生成向量并支持相似度检索"""

import json
import logging
import math
import os
from typing import Optional

from sqlalchemy.orm import Session

from app.services.ai.base import mock_mode

logger = logging.getLogger("embedding")

EMBEDDING_DIM = 1024  # deepseek-embedding 输出维度 (已知)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度"""
    if len(a) != len(b) or len(a) == 0:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _text_for_item(item) -> str:
    """构建 heritage_item 的检索文本"""
    from app.models.exhibition import HeritageItem
    parts = [
        item.name or "",
        item.category or "",
        item.region or "",
        item.era or "",
        (item.description or "")[:300],
        (item.cultural_meaning or "")[:200],
    ]
    # 解析技法名称
    if item.techniques_json:
        try:
            techs = json.loads(item.techniques_json)
            if isinstance(techs, list):
                for t in techs:
                    if isinstance(t, dict):
                        parts.append(t.get("name", ""))
        except Exception:
            pass
    return " ".join(filter(None, parts))


def call_embedding_api(text: str) -> Optional[list[float]]:
    """调用 DeepSeek 嵌入 API 生成向量"""
    if mock_mode():
        # Mock: 返回一个伪随机但确定性的向量
        import hashlib
        h = hashlib.sha256(text.encode()).digest()
        # 将 32 字节扩展为 1024 维归一化向量
        vec = []
        for i in range(EMBEDDING_DIM):
            byte_val = h[i % 32]
            vec.append(((byte_val / 255.0) * 2 - 1) * 0.1)
        # 归一化
        norm = math.sqrt(sum(v * v for v in vec))
        return [v / norm for v in vec] if norm > 0 else vec

    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        logger.warning("DEEPSEEK_API_KEY 未配置，跳过嵌入生成")
        return None

    try:
        from openai import OpenAI
        client = OpenAI(
            api_key=api_key,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )
        resp = client.embeddings.create(
            model="deepseek-embedding",
            input=text[:8192],  # 截断到安全长度
        )
        return resp.data[0].embedding
    except Exception as e:
        logger.warning(f"嵌入生成失败: {e}")
        return None


def ensure_item_embedding(item, db: Session) -> Optional[list[float]]:
    """确保单个 heritage_item 有嵌入，没有则生成并持久化"""
    from app.models.exhibition import HeritageItem

    # 已有嵌入则直接返回
    existing = getattr(item, "embedding_json", None)
    if existing:
        try:
            vec = json.loads(existing)
            if isinstance(vec, list) and len(vec) == EMBEDDING_DIM:
                return vec
        except Exception:
            pass

    # 生成新嵌入
    text = _text_for_item(item)
    if not text.strip():
        return None

    vec = call_embedding_api(text)
    if vec is None:
        return None

    # 持久化
    try:
        db.query(HeritageItem).filter(HeritageItem.id == item.id).update(
            {"embedding_json": json.dumps(vec)}
        )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"嵌入持久化失败 item_id={item.id}: {e}")

    return vec


def semantic_search(
    query: str,
    db: Session,
    top_k: int = 8,
    category_filter: Optional[str] = None,
) -> list[dict]:
    """
    语义检索 heritage_items

    Args:
        query: 用户查询文本
        db: DB session
        top_k: 返回数量
        category_filter: 可选品类过滤

    Returns:
        [{id, name, category, region, era, image_url, description, similarity}]
    """
    from app.models.exhibition import HeritageItem

    # 1. 生成查询向量
    query_vec = call_embedding_api(query)
    if query_vec is None:
        logger.warning("查询嵌入生成失败，回退关键词匹配")
        return _keyword_search(query, db, top_k, category_filter)

    # 2. 加载全量 heritage items 的嵌入
    q = db.query(HeritageItem)
    if category_filter:
        q = q.filter(HeritageItem.category == category_filter)
    items = q.all()

    if not items:
        return []

    # 3. 确保所有 item 有嵌入（懒加载生成）
    scored: list[tuple[float, dict]] = []
    for item in items:
        vec = ensure_item_embedding(item, db)
        if vec is None:
            continue
        sim = _cosine_similarity(query_vec, vec)
        images = []
        if item.images_json:
            try:
                images = json.loads(item.images_json)
            except Exception:
                pass
        scored.append((sim, {
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "region": item.region or "",
            "era": item.era or "",
            "image_url": images[0] if images else "",
            "description": (item.description or "")[:150],
            "similarity": round(sim, 4),
        }))

    # 4. 按相似度排序
    scored.sort(key=lambda x: -x[0])
    return [info for _, info in scored[:top_k]]


def _keyword_search(
    query: str,
    db: Session,
    top_k: int = 8,
    category_filter: Optional[str] = None,
) -> list[dict]:
    """关键词回退检索 — 基于品类名、名称、描述匹配"""
    from app.models.exhibition import HeritageItem

    q = db.query(HeritageItem)
    if category_filter:
        q = q.filter(HeritageItem.category == category_filter)
    items = q.all()

    results = []
    keywords = set(query)
    for item in items:
        text = _text_for_item(item)
        # 简单 Jaccard-like 字符匹配
        score = len(keywords & set(text)) / max(len(keywords), 1)
        if score > 0.05:
            images = []
            if item.images_json:
                try:
                    images = json.loads(item.images_json)
                except Exception:
                    pass
            results.append((score, {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "region": item.region or "",
                "era": item.era or "",
                "image_url": images[0] if images else "",
                "description": (item.description or "")[:150],
                "similarity": round(score, 4),
            }))

    results.sort(key=lambda x: -x[0])
    return [info for _, info in results[:top_k]]
