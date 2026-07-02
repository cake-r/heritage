"""纹样基因引擎 API — 基因匹配、列表、文化解读"""

import json
import difflib
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.pattern_gene import PatternGene
from app.schemas.pattern_engine import (
    PatternGeneOut, PatternMatchRequest, PatternMatchResponse, GeneCultureResponse,
)
from app.api.deps import get_current_user

logger = logging.getLogger("pattern_engine")
router = APIRouter()

# 匹配阈值
_MATCH_THRESHOLD = 0.6


def _gene_to_out(gene: PatternGene) -> PatternGeneOut:
    """ORM → Pydantic"""
    tags = []
    if gene.tags_json:
        try:
            tags = json.loads(gene.tags_json)
        except (json.JSONDecodeError, TypeError):
            pass
    return PatternGeneOut(
        id=gene.id,
        gene_id=gene.gene_id,
        name=gene.name,
        shape_category=gene.shape_category,
        meaning=gene.meaning or "",
        era=gene.era or "",
        region=gene.region or "",
        description=gene.description or "",
        svg_viewbox=gene.svg_viewbox or "0 0 100 100",
        svg_content=gene.svg_content or "",
        default_color=gene.default_color or "#B8463A",
        tags=tags,
    )


def _fuzzy_match(query: str, candidates: list[str]) -> float:
    """模糊匹配: 返回最高相似度"""
    best = 0.0
    for c in candidates:
        ratio = difflib.SequenceMatcher(None, query, c).ratio()
        # 同时尝试部分匹配（query 包含 c 或 c 包含 query）
        if query in c or c in query:
            ratio = max(ratio, 0.75)
        best = max(best, ratio)
    return best


@router.post("/match", response_model=PatternMatchResponse)
def match_patterns(
    req: PatternMatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    根据 AI 识别出的纹样名称列表，在基因库中匹配

    支持模糊匹配：Qwen-VL 输出 "云气纹" → 匹配到 "祥云纹"（tags 含 "云气"）
    """
    all_genes = db.query(PatternGene).all()

    matched: list[PatternGeneOut] = []
    matched_ids: set[int] = set()
    unmatched: list[str] = []

    for pname in req.pattern_names:
        best_gene = None
        best_score = 0.0

        for gene in all_genes:
            if gene.id in matched_ids:
                continue
            # 构建候选字符串列表
            candidates = [gene.name, gene.shape_category]
            if gene.tags_json:
                try:
                    tags = json.loads(gene.tags_json)
                    candidates.extend(tags)
                except (json.JSONDecodeError, TypeError):
                    pass

            score = _fuzzy_match(pname, candidates)
            if score > best_score:
                best_score = score
                best_gene = gene

        if best_gene and best_score >= _MATCH_THRESHOLD:
            matched.append(_gene_to_out(best_gene))
            matched_ids.add(best_gene.id)
        else:
            unmatched.append(pname)

    return PatternMatchResponse(matched=matched, unmatched=unmatched)


@router.get("/genes")
def list_genes(
    category: str | None = Query(None, description="形制分类筛选"),
    meaning: str | None = Query(None, description="寓意筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """分页列出纹样基因库"""
    q = db.query(PatternGene)

    if category:
        q = q.filter(PatternGene.shape_category == category)
    if meaning:
        q = q.filter(PatternGene.meaning == meaning)

    total = q.count()
    genes = q.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_gene_to_out(g) for g in genes],
        "total": total,
    }


@router.get("/genes/categories")
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出所有形制分类"""
    rows = db.query(PatternGene.shape_category).distinct().all()
    return {"categories": [r[0] for r in rows if r[0]]}


@router.get("/genes/{gene_id}", response_model=GeneCultureResponse)
def get_gene_detail(
    gene_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单个基因详情 + DeepSeek 文化解读"""
    gene = db.query(PatternGene).filter(PatternGene.gene_id == gene_id).first()
    if not gene:
        from app.utils.exceptions import AppException
        raise AppException("纹样基因不存在", code=404)

    gene_out = _gene_to_out(gene)

    # 生成文化解读（复用 DeepSeek）
    cultural_meaning = _generate_cultural_meaning(gene)

    return GeneCultureResponse(gene=gene_out, cultural_meaning=cultural_meaning)


def _generate_cultural_meaning(gene: PatternGene) -> str:
    """调用 DeepSeek 为纹样生成文化解读"""
    try:
        from app.services.ai.llm import chat
        from app.config import MOCK_MODE

        if MOCK_MODE:
            return _mock_cultural_meaning(gene)

        prompt = f"""你是一位中国传统纹样研究专家。请为以下纹样撰写一段约200字的文化解读，包含纹样的起源、象征意义、常见应用场景。

纹样名称：{gene.name}
形制分类：{gene.shape_category}
文化寓意：{gene.meaning or '通用'}
所属年代：{gene.era or '不详'}
分布地域：{gene.region or '不详'}
纹样描述：{gene.description or ''}

请用自然流畅的中文段落回复，不要使用markdown格式。"""

        messages = [
            {"role": "system", "content": "你是一位资深中国传统纹样研究专家。"},
            {"role": "user", "content": prompt},
        ]
        response = chat(messages)
        return response.strip()

    except Exception as e:
        logger.warning(f"DeepSeek 文化解读生成失败: {e}")
        return gene.description or f"{gene.name}是中国传统{gene.shape_category}中的经典纹样，寓意{gene.meaning or '吉祥'}。"


def _mock_cultural_meaning(gene: PatternGene) -> str:
    """Mock 模式下的文化解读"""
    return (
        f"{gene.name}是中国传统纹样中极具代表性的一员，属于{gene.shape_category}。"
        f"其起源可追溯至{gene.era}的{gene.region}地区，"
        f"承载着'{gene.meaning or '吉祥'}'的美好寓意。"
        f"{gene.description or ''}"
        f"在数千年的传承中，{gene.name}被广泛应用于陶瓷、织锦、建筑、家具等各个领域，"
        f"成为中国非物质文化遗产中不可或缺的视觉符号。"
    )
