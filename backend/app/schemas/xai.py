"""XAI 可解释体系 — 推理路径可视化 Schema

诚实地标注为「结果分解」而非「推理过程」：
- Qwen-VL 是一次性调用返回所有信息，不存在真实的逐步推理
- 本模块将 AI 输出结果按维度拆解为树形结构，每个节点标注来源类型
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── 来源类型 ──────────────────────────────────────────────

class SourceType(str, Enum):
    """证据来源类型（四色编码）"""
    COMPUTED = "computed"           # 绿色 — 可验证的计算结果（阈值判定、difflib 匹配度）
    MODEL_OUTPUT = "model-output"   # 蓝色 — AI 模型推断输出（Qwen-VL 标签、LLM 文本）
    RETRIEVED = "retrieved"         # 橙色 — 知识库检索结果（RAG 片段、语义相似度匹配）
    RULE_BASED = "rule-based"       # 紫色 — 规则判定（印章条件、段位计算）


# ── 推理追踪树 ────────────────────────────────────────────

class TraceNode(BaseModel):
    """推理追踪树节点 — ECharts tree 系列的数据格式

    每个节点代表 AI 输出结果的一个维度分解。
    """
    name: str = Field(..., description="节点标签，如「品类判定」「损伤分析」")
    source_type: SourceType = Field(..., description="证据来源类型")
    confidence: Optional[float] = Field(default=None, ge=0, le=1, description="置信度 0-1，仅叶节点或有明确分数的节点")
    detail: Optional[str] = Field(default=None, description="节点详细说明文本")
    children: list[TraceNode] = Field(default_factory=list, description="子节点列表")

    model_config = {"from_attributes": True}


class TraceResponse(BaseModel):
    """GET /api/explain/{module}/{record_id}/trace 响应"""
    module: str = Field(..., description="模块名：recognition / restoration")
    record_id: int = Field(..., description="记录 ID")
    root: TraceNode = Field(..., description="根节点：AI 输出结果的多维度分解树")
    disclaimer: str = Field(
        default="此图展示 AI 输出结果的多维度分解，非 AI 内部推理过程。"
                "Qwen-VL 等视觉模型为一次性调用返回所有信息，"
                "不存在「先判定品类→再判定年代→再判定产地」的逐步推理。",
        description="诚实声明"
    )


# ── 四色常量（前端同步） ──────────────────────────────────

SOURCE_COLORS: dict[SourceType, str] = {
    SourceType.COMPUTED: "#52c41a",      # 绿色
    SourceType.MODEL_OUTPUT: "#1890ff",  # 蓝色
    SourceType.RETRIEVED: "#fa8c16",     # 橙色
    SourceType.RULE_BASED: "#722ed1",    # 紫色
}
