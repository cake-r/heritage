"""各 AI 模块的步骤声明

每个模块自声明步骤序列，@track_execution 装饰器据此驱动执行追踪。
模块间完全独立，无硬编码的 if/elif 分支。
"""

from app.schemas.agent import StepDef

# ── 识别模块 ───────────────────────────────────────────────

RECOGNITION_STEPS: list[StepDef] = [
    StepDef(id="validate", title="图片校验", icon="📷"),
    StepDef(id="recognize", title="AI 识别品类", icon="🔍"),
    StepDef(id="heatmap", title="特征热力图", icon="🗺️"),
    StepDef(id="explain", title="生成文化讲解", icon="📖"),
    StepDef(id="tts", title="语音合成", icon="🔊"),
    StepDef(id="recommend", title="关联推荐", icon="🎯"),
]

# ── 修复模块 ───────────────────────────────────────────────

RESTORATION_STEPS: list[StepDef] = [
    StepDef(id="damage_analysis", title="损伤分析", icon="🔬"),
    StepDef(id="contour_extraction", title="纹样轮廓提取", icon="✏️"),
    StepDef(id="prompt_generation", title="修复方案生成", icon="📝"),
    StepDef(id="image_restoration", title="AI 图像修复", icon="🖼️"),
    StepDef(id="verification", title="修复验证", icon="✅"),
]

# ── 文创生成模块 ───────────────────────────────────────────

GENERATION_STEPS: list[StepDef] = [
    StepDef(id="prompt_build", title="构建提示词", icon="💬"),
    StepDef(id="image_gen", title="AI 图像生成", icon="🎨"),
    StepDef(id="save_result", title="保存作品", icon="💾"),
]

# ── 对话模块 ───────────────────────────────────────────────

CHAT_STEPS: list[StepDef] = [
    StepDef(id="tool_detect", title="意图识别", icon="🧠"),
    StepDef(id="context_build", title="上下文构建", icon="📋"),
    StepDef(id="llm_generate", title="AI 生成回复", icon="🤖"),
    StepDef(id="tts", title="语音合成", icon="🔊"),
]

# ── 伴游模块 ───────────────────────────────────────────────

COMPANION_STEPS: list[StepDef] = [
    StepDef(id="journey_gather", title="用户旅程采集", icon="🗂️"),
    StepDef(id="semantic_search", title="语义检索", icon="🔎"),
    StepDef(id="suggest_generate", title="建议生成", icon="💡"),
]

# ── 推荐模块 ───────────────────────────────────────────────

RECOMMENDATION_STEPS: list[StepDef] = [
    StepDef(id="profile_load", title="加载兴趣画像", icon="📊"),
    StepDef(id="recall", title="候选召回", icon="📡"),
    StepDef(id="ranking", title="排序打分", icon="📈"),
    StepDef(id="reason_generate", title="推荐理由生成", icon="💬"),
]

# ── 知识图谱模块 ─────────────────────────────────────────────

KNOWLEDGE_GRAPH_STEPS: list[StepDef] = [
    StepDef(id="entity_extract", title="实体抽取", icon="🔗"),
    StepDef(id="relation_build", title="关系构建", icon="🕸️"),
    StepDef(id="graph_render", title="图谱渲染", icon="🗺️"),
]
