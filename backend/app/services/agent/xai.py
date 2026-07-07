"""XAI Trace Builder — 将 AI 输出结果分解为诚实版决策树

核心理念（来自 CLAUDE.md）：
- Qwen-VL 是一次性调用返回所有信息，不存在真实推理步骤
- 本模块将 AI 输出结果按维度拆解为树形结构
- 每个节点诚实标注来源类型：computed / model-output / retrieved / rule-based
"""

from __future__ import annotations

import json
import logging

from app.schemas.xai import TraceNode, TraceResponse, SourceType

logger = logging.getLogger("xai")


# ── Recognition 结果分解 ──────────────────────────────────

def build_recognition_trace(record) -> TraceResponse:
    """从 RecognitionRecord 构建结果分解树

    拆解维度（自上而下）：
      1. 品类判定（model-output）→ 首选 + top3 备选
      2. 置信度判定（computed）→ 阈值检查
      3. 特征识别（model-output）→ 工艺技法列表
      4. 纹样检测（model-output）→ 传统纹样名称
      5. 文化解读（model-output）→ 历史/技法/传承人/意义
      6. 视觉描述（model-output）→ 原始描述文本
      7. 关联推荐（retrieved）→ 同品类文创 + 展厅藏品
    """
    # 解析数据库字段
    category = record.category or "未知"
    confidence = record.confidence or 0.0

    top3 = _safe_json(record.top3_json, [])
    features = _safe_json(record.features_json, [])
    explanation = _safe_json(record.explanation_json, {})
    raw_resp = _safe_json(record.raw_response_json, {})

    pattern_names = raw_resp.get("pattern_names", [])
    raw_description = raw_resp.get("raw_description", "")

    # ── 1. 品类判定（model-output） ──
    category_children = [
        TraceNode(
            name=f"首选: {category}",
            source_type=SourceType.MODEL_OUTPUT,
            confidence=round(confidence, 4),
        )
    ]
    for i, t in enumerate(top3[:3]):
        if t.get("category") != category:
            category_children.append(
                TraceNode(
                    name=f"备选{i+1}: {t.get('category', '?')}",
                    source_type=SourceType.MODEL_OUTPUT,
                    confidence=round(float(t.get("confidence", 0)), 4),
                )
            )

    category_node = TraceNode(
        name="品类判定",
        source_type=SourceType.MODEL_OUTPUT,
        confidence=round(confidence, 4) if confidence > 0 else None,
        detail=f"Qwen-VL 一次性输出品类 + top3 + 特征 + 纹样 + 描述",
        children=category_children,
    )

    # ── 2. 置信度判定（computed） ──
    threshold = 0.35
    passed = confidence >= threshold
    confidence_node = TraceNode(
        name="置信度判定",
        source_type=SourceType.COMPUTED,
        detail=f"阈值 {threshold}，实际 {confidence:.2%} → {'✓ 采纳' if passed else '✗ 标记为无法识别'}",
        confidence=round(confidence, 4) if confidence > 0 else None,
    )

    # ── 3. 特征识别（model-output） ──
    feature_children = []
    for feat in (features or [])[:8]:
        feature_children.append(TraceNode(
            name=str(feat),
            source_type=SourceType.MODEL_OUTPUT,
        ))
    if not feature_children:
        feature_children.append(TraceNode(
            name="（无特征识别结果）",
            source_type=SourceType.MODEL_OUTPUT,
        ))
    feature_node = TraceNode(
        name="特征识别",
        source_type=SourceType.MODEL_OUTPUT,
        detail=f"识别到 {len(features or [])} 项工艺特征",
        children=feature_children,
    )

    # ── 4. 纹样检测（model-output） ──
    pattern_children = []
    for p in (pattern_names or [])[:10]:
        pattern_children.append(TraceNode(
            name=str(p),
            source_type=SourceType.MODEL_OUTPUT,
        ))
    if not pattern_children:
        pattern_children.append(TraceNode(
            name="（未检测到纹样）",
            source_type=SourceType.MODEL_OUTPUT,
        ))
    pattern_node = TraceNode(
        name="纹样检测",
        source_type=SourceType.MODEL_OUTPUT,
        detail=f"检测到 {len(pattern_names or [])} 种传统纹样",
        children=pattern_children,
    )

    # ── 5. 文化解读（model-output, LLM 生成） ──
    culture_children = []
    for key, label in [("history", "历史背景"), ("technique", "工艺技法"),
                        ("inheritor", "传承人"), ("meaning", "文化意义")]:
        text = explanation.get(key, "")
        if text:
            culture_children.append(TraceNode(
                name=label,
                source_type=SourceType.MODEL_OUTPUT,
                detail=text[:120] + ("..." if len(str(text)) > 120 else ""),
            ))
    if not culture_children:
        culture_children.append(TraceNode(
            name="（无文化解读）",
            source_type=SourceType.MODEL_OUTPUT,
        ))
    culture_node = TraceNode(
        name="文化解读",
        source_type=SourceType.MODEL_OUTPUT,
        detail="DeepSeek LLM 生成四维解读",
        children=culture_children,
    )

    # ── 6. 视觉描述（model-output） ──
    desc_text = str(raw_description)[:200] if raw_description else ""
    visual_node = TraceNode(
        name="视觉描述",
        source_type=SourceType.MODEL_OUTPUT,
        detail=desc_text + ("..." if len(str(raw_description or "")) > 200 else ""),
    )

    # ── 组装根节点 ──
    root = TraceNode(
        name=f"AI 识别结果: {category}",
        source_type=SourceType.MODEL_OUTPUT,
        confidence=round(confidence, 4) if confidence > 0 else None,
        children=[
            category_node,
            confidence_node,
            feature_node,
            pattern_node,
            culture_node,
            visual_node,
        ],
    )

    return TraceResponse(
        module="recognition",
        record_id=record.id,
        root=root,
    )


# ── Restoration 结果分解 ──────────────────────────────────

def build_restoration_trace(record) -> TraceResponse:
    """从 RestorationRecord 构建结果分解树

    拆解维度（按流水线步骤）：
      1. 损伤分析（model-output, Qwen-VL）→ 类型/严重程度/描述
      2. 修复方案（model-output, DeepSeek + RAG）→ prompt
      3. 图像修复（model-output, 万相 I2I）→ 生成数/种子
      4. 修复验证（model-output, Qwen-VL）→ 总分 + 三维度 + 瑕疵
    """
    # Step 1: 损伤分析
    damage_types = _safe_json(record.damage_types_json, [])
    severity = record.damage_severity or "未知"
    damage_desc = record.damage_description or ""

    damage_children = [
        TraceNode(
            name=f"损伤类型: {', '.join(damage_types) if damage_types else '未知'}",
            source_type=SourceType.MODEL_OUTPUT,
        ),
        TraceNode(
            name=f"严重程度: {severity}",
            source_type=SourceType.MODEL_OUTPUT,
        ),
    ]
    if damage_desc:
        damage_children.append(TraceNode(
            name=f"详细描述",
            source_type=SourceType.MODEL_OUTPUT,
            detail=damage_desc[:200] + ("..." if len(damage_desc) > 200 else ""),
        ))

    step1_node = TraceNode(
        name="Step 1: 损伤分析",
        source_type=SourceType.MODEL_OUTPUT,
        detail="Qwen-VL-Max 分析损伤类型、程度",
        children=damage_children,
    )

    # Step 2: 修复方案
    prompt_text = (record.restoration_prompt or "")[:200]
    step2_node = TraceNode(
        name="Step 2: 修复方案",
        source_type=SourceType.MODEL_OUTPUT,
        detail=f"DeepSeek + 非遗知识库 RAG 生成修复 prompt: {prompt_text}{'...' if len(record.restoration_prompt or '') > 200 else ''}",
    )

    # Step 3: 图像修复
    restored_images = _safe_json(record.restored_images_json, [])
    seed = record.restoration_seed
    step3_node = TraceNode(
        name="Step 3: 图像修复",
        source_type=SourceType.MODEL_OUTPUT,
        detail=f"万相 wan2.5-i2i-preview 异步生成: {len(restored_images)} 张结果图"
                + (f", seed={seed}" if seed else ""),
    )

    # Step 4: 修复验证
    verification = _safe_json(record.verification_json, {})
    score = record.verification_score or 0
    dimensions = verification.get("dimensions", {}) if isinstance(verification, dict) else {}
    artifacts = verification.get("artifacts", []) if isinstance(verification, dict) else []

    verify_children = [
        TraceNode(
            name=f"总分: {score}/100",
            source_type=SourceType.MODEL_OUTPUT,
            confidence=round(score / 100, 2),
        ),
    ]
    for dim_key, dim_label in [("detail_fidelity", "细节保真度"),
                                  ("style_consistency", "风格一致性"),
                                  ("restoration_completeness", "损伤修复完整度")]:
        val = dimensions.get(dim_key, 0) if isinstance(dimensions, dict) else 0
        verify_children.append(TraceNode(
            name=f"{dim_label}: {val}/100",
            source_type=SourceType.MODEL_OUTPUT,
            confidence=round(val / 100, 2) if isinstance(val, (int, float)) else None,
        ))
    if artifacts:
        verify_children.append(TraceNode(
            name=f"瑕疵: {', '.join(str(a) for a in artifacts[:5])}",
            source_type=SourceType.MODEL_OUTPUT,
        ))

    step4_node = TraceNode(
        name="Step 4: 修复验证",
        source_type=SourceType.MODEL_OUTPUT,
        detail="Qwen-VL-Max 五维度评估修复效果",
        children=verify_children,
    )

    # ── 组装根节点 ──
    pipeline_status = record.pipeline_status or "unknown"
    root = TraceNode(
        name=f"修复流水线: {pipeline_status}",
        source_type=SourceType.MODEL_OUTPUT,
        children=[step1_node, step2_node, step3_node, step4_node],
    )

    # 如果有 pipeline_error，添加错误节点
    if record.pipeline_error:
        root.children.append(TraceNode(
            name=f"失败原因",
            source_type=SourceType.COMPUTED,
            detail=record.pipeline_error[:200],
        ))

    return TraceResponse(
        module="restoration",
        record_id=record.id,
        root=root,
    )


# ── 工具函数 ──────────────────────────────────────────────

def _safe_json(raw: str | None, default=None):
    """安全解析 JSON 字符串"""
    if default is None:
        default = {}
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default
