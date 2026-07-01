"""
RAG (检索增强生成) 检索管线 — pgvector ANN + 降级 brute-force

用法:
    from app.services.ai.rag import retrieve, retrieve_for_heritage_item

    docs = retrieve("景德镇瓷器釉料技法", top_k=5)
    # → [{chunk_text, chunk_type, name, category, similarity, ...}, ...]

    docs = retrieve("什么是苏绣的平针绣", chunk_type="technique")
    # → 仅检索技术类分块
"""

import json
import logging
from typing import Optional

from app.models.database import SessionLocal
from app.models.heritage_chunk import HeritageChunk
from app.services.ai.embedding import get_embedding, cosine_similarity

logger = logging.getLogger("rag")


def _use_pgvector() -> bool:
    """检测是否可使用 pgvector"""
    from app.config import USE_POSTGRES
    if not USE_POSTGRES:
        return False
    # 尝试查询 pgvector 扩展是否存在
    db = SessionLocal()
    try:
        from sqlalchemy import text
        result = db.execute(text("SELECT 1 FROM pg_extension WHERE extname='vector'")).fetchone()
        return result is not None
    except Exception:
        return False
    finally:
        db.close()


def retrieve(
    query: str,
    top_k: int = 5,
    chunk_type: Optional[str] = None,
    include_item_level: bool = False,
) -> list[dict]:
    """
    RAG 检索: 查询语义最相关的知识分块。

    Args:
        query: 查询文本
        top_k: 返回数量
        chunk_type: 过滤分块类型 (description/technique/cultural_meaning/inheritor_desc)
        include_item_level: 是否同时检索条目级 (heritage_items 表)

    Returns:
        [{chunk_id, chunk_text, chunk_type, item_id, name, category, region, era, similarity}, ...]
    """
    query_vec = get_embedding(query)
    if query_vec is None:
        logger.warning("RAG: 无法生成查询向量，返回空结果")
        return []

    if _use_pgvector():
        results = _pgvector_search(query_vec, top_k, chunk_type)
    else:
        results = _brute_force_search(query_vec, top_k, chunk_type)

    # 条目级检索 (仅当 pgvector 启用且请求时)
    if include_item_level:
        item_results = _item_level_search(query_vec, top_k)
        # 合并去重
        seen_ids = {r.get("chunk_id") for r in results}
        for ir in item_results:
            if ir.get("item_id") not in seen_ids:
                results.append(ir)

    return results[:top_k]


def _pgvector_search(query_vec: list[float], top_k: int, chunk_type: Optional[str]) -> list[dict]:
    """pgvector ANN 检索"""
    from sqlalchemy import text
    db = SessionLocal()
    try:
        vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"
        type_filter = ""
        params = {"vec": vec_str, "limit": top_k * 2}
        if chunk_type:
            type_filter = "AND hc.chunk_type = :chunk_type"
            params["chunk_type"] = chunk_type

        sql = text(f"""
            SELECT hc.id AS chunk_id, hc.chunk_text, hc.chunk_type,
                   hc.heritage_item_id AS item_id, hi.name, hi.category,
                   hi.region, hi.era,
                   1 - (hc.embedding <=> :vec) AS similarity
            FROM heritage_chunks hc
            JOIN heritage_items hi ON hc.heritage_item_id = hi.id
            WHERE hc.embedding IS NOT NULL {type_filter}
            ORDER BY hc.embedding <=> :vec
            LIMIT :limit
        """)
        rows = db.execute(sql, params).fetchall()

        results = []
        for row in rows:
            results.append({
                "chunk_id": row.chunk_id,
                "chunk_text": row.chunk_text,
                "chunk_type": row.chunk_type,
                "item_id": row.item_id,
                "name": row.name,
                "category": row.category,
                "region": row.region,
                "era": row.era,
                "similarity": round(float(row.similarity) if row.similarity else 0, 4),
            })

        # 精确余弦重排序
        results.sort(key=lambda r: _exact_cosine(r["chunk_text"], query_vec), reverse=True)
        return results[:top_k]

    except Exception as e:
        logger.warning(f"pgvector 检索失败 ({e})，降级为 brute-force")
        return _brute_force_search(query_vec, top_k, chunk_type)
    finally:
        db.close()


def _brute_force_search(query_vec: list[float], top_k: int, chunk_type: Optional[str]) -> list[dict]:
    """SQLite 降级: 遍历所有分块计算余弦相似度"""
    db = SessionLocal()
    try:
        q = db.query(HeritageChunk)
        if chunk_type:
            q = q.filter(HeritageChunk.chunk_type == chunk_type)

        chunks = q.all()
        results = []
        for chunk in chunks:
            if not chunk.embedding_json:
                continue
            try:
                emb = json.loads(chunk.embedding_json)
            except (json.JSONDecodeError, TypeError):
                continue
            sim = cosine_similarity(query_vec, emb)
            if sim is None:
                continue
            # 懒加载 heritage_item 信息
            from app.models.exhibition import HeritageItem
            item = db.query(HeritageItem).filter(HeritageItem.id == chunk.heritage_item_id).first()
            results.append({
                "chunk_id": chunk.id,
                "chunk_text": chunk.chunk_text,
                "chunk_type": chunk.chunk_type,
                "item_id": chunk.heritage_item_id,
                "name": item.name if item else "",
                "category": item.category if item else "",
                "region": item.region if item else "",
                "era": item.era if item else "",
                "similarity": round(sim, 4),
            })

        results.sort(key=lambda r: r["similarity"], reverse=True)
        return results[:top_k]
    finally:
        db.close()


def _item_level_search(query_vec: list[float], top_k: int) -> list[dict]:
    """条目级检索 — 使用 heritage_items.embedding_json"""
    db = SessionLocal()
    try:
        from app.models.exhibition import HeritageItem
        items = db.query(HeritageItem).all()
        results = []
        for item in items:
            emb_json = getattr(item, "embedding_json", None)
            if not emb_json:
                continue
            try:
                emb = json.loads(emb_json)
            except (json.JSONDecodeError, TypeError):
                continue
            sim = cosine_similarity(query_vec, emb)
            if sim is None:
                continue
            # 用 description 作为 chunk_text
            desc = item.description or ""
            results.append({
                "chunk_id": None,
                "chunk_text": desc[:500],
                "chunk_type": "item",
                "item_id": item.id,
                "name": item.name or "",
                "category": item.category or "",
                "region": item.region or "",
                "era": item.era or "",
                "similarity": round(sim, 4),
            })
        results.sort(key=lambda r: r["similarity"], reverse=True)
        return results[:top_k]
    finally:
        db.close()


def _exact_cosine(text: str, query_vec: list[float]) -> float:
    """对候选结果重新计算精确余弦相似度 (避免 ANN 近似误差)"""
    from app.services.ai.embedding import get_embedding, cosine_similarity
    text_vec = get_embedding(text)
    if text_vec is None:
        return 0.0
    return cosine_similarity(query_vec, text_vec) or 0.0


def retrieve_for_chat(user_message: str, top_k: int = 3) -> str:
    """为对话/伴游格式化 RAG 上下文文本"""
    docs = retrieve(user_message, top_k=top_k)
    if not docs:
        return ""

    parts = []
    for i, doc in enumerate(docs):
        parts.append(
            f"[{i + 1}] {doc['name']} ({doc['category']}, {doc['region']}, {doc['era']})\n"
            f"{doc['chunk_text'][:300]}"
        )
    return "\n\n".join(parts)


def retrieve_for_prompt(query: str, top_k: int = 5) -> list[str]:
    """获取纯文本片段列表，适合注入 LLM system prompt"""
    docs = retrieve(query, top_k=top_k)
    return [doc["chunk_text"] for doc in docs]
