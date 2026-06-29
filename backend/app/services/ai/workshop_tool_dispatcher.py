"""技艺工坊 — 工具调度器

负责检测工具意图、路由到对应的后端服务。
"""

import json
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger("workshop_tools")

# 工具ID到中文名称的映射
TOOL_DISPLAY = {
    "inspect": "识物·品鉴",
    "create": "创作·生成",
    "connect": "博学·关联",
    "teach": "教学·答疑",
}

TOOL_DESCRIPTIONS = {
    "inspect": "上传非遗作品图片，AI分析工艺技法",
    "create": "AI生成非遗相关创作内容（图案、设计等）",
    "connect": "跨品类文化关联，发现非遗之间的联系",
    "teach": "自动生成入门课程，系统学习非遗知识",
}

# 工具触发前缀
TOOL_TRIGGERS = {
    "/inspect": "inspect",
    "/create": "create",
    "/connect": "connect",
    "/teach": "teach",
}


def detect_tool_intent(message: str, available_tools: list[str]) -> str | None:
    """检测消息中的工具调用意图（显式触发）

    Args:
        message: 用户输入文本
        available_tools: 该传承人可用的工具列表

    Returns:
        工具ID（"inspect"/"create"/"connect"/"teach"）或 None（普通对话）
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
    db: Session,
) -> dict:
    """执行「博学·关联」工具

    查询知识图谱 → 用传承人视角总结关联

    Returns:
        {"type": "connect_result", "related_items": [...], "summary": "..."}
    """
    from app.services.ai.llm import chat as llm_chat
    from app.models.exhibition import HeritageItem

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


#  re-export Path for internal use
from pathlib import Path
