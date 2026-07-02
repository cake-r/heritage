"""纹样基因引擎 Pydantic Schemas"""

from pydantic import BaseModel
from typing import Optional


class PatternGeneOut(BaseModel):
    """纹样基因输出"""
    id: int
    gene_id: str
    name: str
    shape_category: str
    meaning: str
    era: str = ""
    region: str = ""
    description: str = ""
    svg_viewbox: str = "0 0 100 100"
    svg_content: str = ""
    default_color: str = "#B8463A"
    tags: list[str] = []

    model_config = {"from_attributes": True}


class PatternMatchRequest(BaseModel):
    """基因匹配请求"""
    pattern_names: list[str]


class PatternMatchResponse(BaseModel):
    """基因匹配响应"""
    matched: list[PatternGeneOut]
    unmatched: list[str]  # 未匹配到的纹样名称


class GeneCultureResponse(BaseModel):
    """基因文化解读"""
    gene: PatternGeneOut
    cultural_meaning: str  # DeepSeek 生成的文化解读
