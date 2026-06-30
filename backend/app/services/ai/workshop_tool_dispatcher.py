"""技艺工坊 — 工具调度器

负责检测工具意图、路由到对应的后端服务。
"""

import json
import logging
from pathlib import Path
from sqlalchemy.orm import Session

logger = logging.getLogger("workshop_tools")

# 工具ID到中文名称的映射
TOOL_DISPLAY = {
    "inspect": "识物·品鉴",
    "create": "创作·生成",
    "connect": "博学·关联",
    "teach": "教学·答疑",
    "pattern": "纹样·提取",
    "story": "故事·讲述",
    "compare": "对比·鉴赏",
}

TOOL_DESCRIPTIONS = {
    "inspect": "上传非遗作品图片，AI分析工艺技法",
    "create": "AI生成非遗相关创作内容（图案、设计等）",
    "connect": "跨品类文化关联，发现非遗之间的联系",
    "teach": "自动生成入门课程，系统学习非遗知识",
    "pattern": "上传纹样图片，AI提取并分析传统纹样（对称性、母题、文化寓意）",
    "story": "根据主题生成非遗相关的故事、传说或匠人叙事",
    "compare": "对比两个非遗项目的技法、风格、历史背景异同",
}

# 工具触发前缀
TOOL_TRIGGERS = {
    "/inspect": "inspect",
    "/create": "create",
    "/connect": "connect",
    "/teach": "teach",
    "/pattern": "pattern",
    "/story": "story",
    "/compare": "compare",
}

# 传承人ID —> 非遗品类中文名映射（用于connect工具的精准过滤）
PERSONA_CATEGORY_MAP = {
    "paper_cutter": "剪纸",
    "embroidery_lady": "刺绣",
    "ceramic_master": "陶瓷",
    "shadow_puppet": "皮影",
    "culture_guide": "",  # 文博覆盖所有品类，不过滤
}


def detect_tool_intent(message: str, available_tools: list[str]) -> str | None:
    """检测消息中的工具调用意图（显式触发）

    Args:
        message: 用户输入文本
        available_tools: 该传承人可用的工具列表

    Returns:
        工具ID（"inspect"/"create"/"connect"/"teach"/"pattern"/"story"/"compare"）或 None（普通对话）
    """
    msg = message.strip()
    for trigger, tool_id in TOOL_TRIGGERS.items():
        if msg.startswith(trigger) and tool_id in available_tools:
            return tool_id
    return None


def extract_tool_payload(message: str, tool_id: str) -> str:
    """提取工具调用的参数（去掉触发词前缀）"""
    for trigger, tid in TOOL_TRIGGERS.items():
        if tid == tool_id and message.strip().startswith(trigger):
            payload = message.strip()[len(trigger):].strip()
            return payload if payload else "请帮我分析"
    return message.strip()


def execute_tool_inspect(
    image_path: str,
    domain_prompt: str,
    inheritor_context: dict,
) -> dict:
    """执行「识物·品鉴」工具

    调用识别服务 → 用传承人视角包装结果

    Returns:
        {"type": "inspect_result", "recognition": {...}, "commentary": "..."}
    """
    from app.services.ai.recognition import recognize
    from app.services.ai.llm import chat as llm_chat
    from app.services.ai.base import mock_mode

    # Step 1: 识别
    recog_result = recognize(image_path)

    # Step 2: 用传承人视角生成评析
    commentary = ""
    if recog_result.get("category") and recog_result["category"] != "无法识别":
        commentary_prompt = f"""{domain_prompt}

以下是AI对该作品的识别结果：
- 品类：{recog_result.get('category')}
- 置信度：{recog_result.get('confidence', 0)}
- 候选品类：{json.dumps(recog_result.get('top3', []), ensure_ascii=False)}
- 特征：{json.dumps(recog_result.get('features', []), ensure_ascii=False)}
- 原始描述：{recog_result.get('raw_description', '')}

请以你作为传承人的视角，对这个识别结果进行评析，200-400字。
如果识别置信度较低（<0.7），请如实告知用户，并建议用户提供更清晰的图片或补充描述。"""

        try:
            commentary = llm_chat([{"role": "user", "content": commentary_prompt}])
        except Exception as e:
            logger.warning(f"品鉴评析生成失败: {e}")
            commentary = f"根据识别结果，这件作品属于{recog_result['category']}类别。"

    return {
        "type": "inspect_result",
        "recognition": recog_result,
        "commentary": commentary,
    }


def execute_tool_create(
    prompt: str,
    domain_prompt: str,
    inheritor_context: dict,
) -> dict:
    """执行「创作·生成」工具

    用传承人的领域知识增强prompt → 调用生图服务

    Returns:
        {"type": "create_result", "images": [...], "prompt_used": "..."}
    """
    from app.services.ai.image_gen import text_to_image
    from app.services.ai.llm import chat as llm_chat
    from app.services.ai.base import mock_mode

    # Step 1: 用传承人视角扩写prompt
    enhanced_prompt = prompt
    try:
        expand_prompt_text = f"""{domain_prompt}

用户想生成的创作内容是：{prompt}

请将用户的简短描述扩展为详细的AI图像生成提示词（100-200字，中文），包含：
- 题材与主题
- 风格与技法特征
- 色彩方案
- 构图建议
- 画面氛围

直接给出提示词，不要加引号或说明。"""
        enhanced_prompt = llm_chat([{"role": "user", "content": expand_prompt_text}])
    except Exception as e:
        logger.warning(f"Prompt扩写失败: {e}")
        enhanced_prompt = f"{domain_prompt[:100]}。创作内容：{prompt}"

    # Step 2: 调用生图
    result = text_to_image(prompt=enhanced_prompt, count=2)

    return {
        "type": "create_result",
        "images": result.get("images", []),
        "prompt_used": enhanced_prompt,
    }


def execute_tool_connect(
    query: str,
    inheritor_context: dict,
) -> dict:
    """执行「博学·关联」工具

    查询知识图谱 → 用传承人视角总结关联

    Returns:
        {"type": "connect_result", "related_items": [...], "summary": "..."}
    """
    from app.services.ai.llm import chat as llm_chat
    from app.models.exhibition import HeritageItem
    from app.models.database import SessionLocal

    # 使用独立的DB Session（此函数在后台线程中运行，不能共享请求级Session）
    db = SessionLocal()
    try:
        # 查询相关的非遗项目（按品类和关键词）
        category = inheritor_context.get("category", "")
        items = []
        if category:
            items = db.query(HeritageItem).filter(
                HeritageItem.category.like(f"%{category}%")
            ).limit(10).all()

        if not items:
            items = db.query(HeritageItem).limit(10).all()

        related = []
        for item in items:
            images = []
            try:
                imgs = json.loads(item.images_json) if item.images_json else []
                if imgs:
                    images = [f"/static/images/{Path(imgs[0]).name}" if not imgs[0].startswith("/") else imgs[0]]
            except Exception:
                pass

            related.append({
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "region": item.region,
                "era": item.era,
                "description": item.description[:200] if item.description else "",
                "image": images[0] if images else "",
            })

        # 用传承人视角总结
        summary = f"找到了{len(related)}个与'{category or query}'相关的非遗项目。"
        try:
            summary_prompt = f"""{inheritor_context.get('domain_prompts', {}).get('connect', inheritor_context.get('system_prompt', ''))}

用户查询: {query}
找到以下相关非遗项目:
{json.dumps([{'名称': r['name'], '品类': r['category'], '地区': r['region'], '朝代': r['era'], '简介': r['description'][:100]} for r in related[:8]], ensure_ascii=False, indent=2)}

请以你的视角，总结这些非遗项目之间的文化关联，150-300字。"""
            summary = llm_chat([{"role": "user", "content": summary_prompt}])
        except Exception as e:
            logger.warning(f"关联总结生成失败: {e}")

        return {
            "type": "connect_result",
            "related_items": related,
            "summary": summary,
        }
    finally:
        db.close()


def execute_tool_pattern(
    image_path: str,
    domain_prompt: str,
    inheritor_context: dict,
) -> dict:
    """执行「纹样·提取」工具

    上传纹样图片 → 识别 → 分析母题、对称性、文化寓意

    Returns:
        {"type": "pattern_result", "recognition": {...}, "analysis": {...}, "commentary": "..."}
    """
    from app.services.ai.recognition import recognize
    from app.services.ai.llm import chat as llm_chat

    # Step 1: 识别图片
    recog_result = recognize(image_path)

    # Step 2: LLM 深度分析纹样
    analysis_prompt = f"""{domain_prompt}

你面前的是一张传统纹样/图案的图片。AI识别结果为：
- 品类：{recog_result.get('category', '未知')}
- 特征：{json.dumps(recog_result.get('features', []), ensure_ascii=False)}
- 描述：{recog_result.get('raw_description', '')}

请从以下维度分析这个纹样（输出JSON格式，确保是合法JSON）：
{{
  "motif_type": "纹样母题类型（如：缠枝纹、云纹、回纹、龙凤纹、莲花纹、如意纹等）",
  "symmetry": "对称性分析（如：二方连续、四方连续、中心对称、轴对称、自由式等）",
  "composition": "构图特点（50字以内）",
  "color_scheme": "色彩分析（50字以内）",
  "cultural_meaning": "文化寓意（100字以内，说明纹样背后的吉祥寓意或文化内涵）",
  "craft_technique": "可能的工艺技法（如：刺绣、雕刻、印染、掐丝等）",
  "era_style": "可能所属的时代风格特征"
}}

只输出JSON，不要有其他文字。"""

    analysis = {}
    try:
        raw = llm_chat([{"role": "user", "content": analysis_prompt}])
        # 提取JSON（LLM可能在前后加说明文字）
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            analysis = json.loads(raw[json_start:json_end])
    except Exception as e:
        logger.warning(f"纹样分析JSON解析失败: {e}")
        analysis = {
            "motif_type": "无法确定",
            "symmetry": "无法确定",
            "cultural_meaning": "分析失败，请重试",
        }

    # Step 3: 生成评析
    commentary = ""
    try:
        commentary_prompt = f"""你是一位{inheritor_context.get('name', '非遗传承人')}。
{inheritor_context.get('style', '')}

你刚刚分析了一件传统纹样，结果如下：
{json.dumps(analysis, ensure_ascii=False, indent=2)}

请以你的视角，用通俗易懂的语言为用户讲解这个纹样的特点和文化内涵，150-250字。
重点讲纹样美在哪里、有什么讲究、普通人怎么欣赏。"""
        commentary = llm_chat([{"role": "user", "content": commentary_prompt}])
    except Exception as e:
        logger.warning(f"纹样评析生成失败: {e}")
        commentary = f"这个纹样属于{analysis.get('motif_type', '传统纹样')}，具有独特的文化韵味。"

    return {
        "type": "pattern_result",
        "recognition": recog_result,
        "analysis": analysis,
        "commentary": commentary,
    }


def execute_tool_story(
    topic: str,
    domain_prompt: str,
    inheritor_context: dict,
) -> dict:
    """执行「故事·讲述」工具

    根据用户主题，生成一段非遗相关的生动故事/传说/匠人叙事

    Returns:
        {"type": "story_result", "title": "...", "story": "...", "tags": [...]}
    """
    from app.services.ai.llm import chat as llm_chat

    inheritor_name = inheritor_context.get("name", "非遗传承人")
    inheritor_style = inheritor_context.get("style", "")

    story_prompt = f"""{domain_prompt}

用户对以下非遗主题感兴趣，想听一段故事："{topic}"

请以你（{inheritor_name}）的口吻和风格，讲一段与这个主题相关的非遗故事。要求：
1. 可以是民间传说、历史典故、匠人轶事，或你"亲身经历"的故事
2. 故事要有情节、有画面感，能让听众身临其境
3. 融入真实的非遗知识（技法、材料、习俗等），寓教于乐
4. 长度300-500字
5. {inheritor_style}

请输出JSON格式：
{{
  "title": "故事标题（10字以内）",
  "story": "故事正文",
  "tags": ["标签1", "标签2", "标签3"]
}}

只输出JSON，不要有其他文字。"""

    result = {
        "title": f"关于{topic}的故事",
        "story": "",
        "tags": [],
    }

    try:
        raw = llm_chat([{"role": "user", "content": story_prompt}])
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(raw[json_start:json_end])
            result.update(parsed)
        else:
            result["story"] = raw
    except Exception as e:
        logger.warning(f"故事生成失败: {e}")
        result["story"] = f"关于{topic}，{inheritor_name}有很多故事可以讲。非遗的传承不仅仅是一门手艺，更是一段段鲜活的人生。每一件作品背后，都藏着匠人的心血与智慧。如果有机会，欢迎亲自来了解。"

    return {
        "type": "story_result",
        **result,
    }


def execute_tool_compare(
    query: str,
    domain_prompt: str,
    inheritor_context: dict,
) -> dict:
    """执行「对比·鉴赏」工具

    对比两个非遗项目的技法、风格、历史背景异同

    Args:
        query: 用户输入，格式为 "项目A vs 项目B" 或 "项目A 和 项目B"
            如果只提供了一个项目，LLM会自动选择一个相关的进行对比

    Returns:
        {"type": "compare_result", "item_a": "...", "item_b": "...", "comparison": {...}, "summary": "..."}
    """
    from app.services.ai.llm import chat as llm_chat

    # 解析对比的两个项目
    item_a = query
    item_b = ""
    for sep in [" vs ", " VS ", " 和 ", " 与 ", " 对比 ", " 比较 "]:
        parts = query.split(sep, 1)
        if len(parts) == 2:
            item_a = parts[0].strip()
            item_b = parts[1].strip()
            break

    inheritor_name = inheritor_context.get("name", "非遗传承人")
    inheritor_style = inheritor_context.get("style", "")

    compare_prompt = f"""{domain_prompt}

用户想对比两个非遗相关的项目：
- 项目A：{item_a}
- 项目B：{item_b if item_b else '（请根据项目A，自动选择一个最相关、最有对比价值的非遗项目）'}

请以{inheritor_name}的视角，对这两个项目进行全面对比分析。输出JSON格式：

{{
  "item_a": "{item_a}",
  "item_b": "{item_b if item_b else '自动选择的项目名'}",
  "comparison": {{
    "technique": "技法对比（80字以内，说明各自的核心技法和差异）",
    "style": "风格对比（80字以内，说明审美取向和艺术风格的不同）",
    "origin": "起源与地域对比（60字以内）",
    "material": "材料与工具对比（60字以内）",
    "cultural_status": "文化地位对比（60字以内，保护级别、知名度等）"
  }},
  "common_ground": "共同点（100字以内，两者在文化精神或工艺理念上的相通之处）",
  "verdict": "总结点评（80字以内，各有千秋还是高下立判？给读者的建议）"
}}

{inheritor_style}

只输出JSON，不要有其他文字。"""

    result = {
        "item_a": item_a,
        "item_b": item_b,
        "comparison": {},
        "common_ground": "",
        "verdict": "",
    }

    try:
        raw = llm_chat([{"role": "user", "content": compare_prompt}])
        json_start = raw.find("{")
        json_end = raw.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            parsed = json.loads(raw[json_start:json_end])
            result.update(parsed)
    except Exception as e:
        logger.warning(f"对比分析失败: {e}")

    # 生成自然语言总结
    summary = ""
    try:
        comp = result.get("comparison", {})
        summary_prompt = f"""你是{inheritor_name}。

你刚刚对比了「{result.get('item_a', item_a)}」和「{result.get('item_b', '')}」这两个非遗项目。
技法对比：{comp.get('technique', '')}
风格对比：{comp.get('style', '')}
共同点：{result.get('common_ground', '')}
总结：{result.get('verdict', '')}

请把这些对比信息组织成一段流畅自然的讲解，200-350字，让用户感受到这两种非遗的魅力。{inheritor_style}"""
        summary = llm_chat([{"role": "user", "content": summary_prompt}])
    except Exception as e:
        logger.warning(f"对比总结生成失败: {e}")
        summary = f"「{result.get('item_a', item_a)}」和「{result.get('item_b', '')}」各有特色，都是中国非物质文化遗产中的瑰宝。它们虽然技法不同、风格各异，但都承载着深厚的文化底蕴和匠人智慧。"

    return {
        "type": "compare_result",
        "item_a": result.get("item_a", item_a),
        "item_b": result.get("item_b", ""),
        "comparison": result.get("comparison", {}),
        "common_ground": result.get("common_ground", ""),
        "verdict": result.get("verdict", ""),
        "summary": summary,
    }
