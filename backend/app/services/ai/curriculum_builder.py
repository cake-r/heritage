"""技艺工坊 — 课程生成器

为「教学·答疑」工具生成结构化入门课程。
支持流式输出，每个课程章节作为一个SSE事件。
"""

import logging

logger = logging.getLogger("curriculum_builder")

# 课程模板结构
CURRICULUM_SECTIONS = [
    ("overview", "概述", "了解{craft}的起源、发展和文化意义"),
    ("tools", "工具与材料", "认识{craft}所需的工具和材料"),
    ("technique_1", "基础技法（一）", "掌握第一个核心技法"),
    ("technique_2", "基础技法（二）", "学习第二个基础技法"),
    ("technique_3", "基础技法（三）", "进一步深入学习"),
    ("practice", "练习项目", "动手完成一个简单作品"),
    ("faq", "常见问题", "初学者容易遇到的问题和解答"),
]


def build_curriculum_stream(
    topic: str,
    domain_prompt: str,
    inheritor_context: dict,
):
    """生成结构化课程（流式）

    每个section作为一个独立的生成单元，产生结构化输出。

    Yields:
        ("section_start", {"section_id": "...", "title": "...", "description": "..."})
        ("token", "逐字输出内容")
        ("section_end", {"section_id": "..."})
    """
    from app.services.ai.llm import chat_stream, chat
    from app.services.ai.base import mock_mode

    craft_name = inheritor_context.get("category", topic)
    inheritor_name = inheritor_context.get("name", "传承人")

    for section_id, section_title, section_desc in CURRICULUM_SECTIONS:
        title = section_title.format(craft=craft_name)
        desc = section_desc.format(craft=craft_name)

        # 发送章节开始事件
        yield ("section_start", {
            "section_id": section_id,
            "title": title,
            "description": desc,
        })

        # 构建章节prompt
        section_prompt = f"""{domain_prompt}

你正在为一位对{craft_name}感兴趣的初学者讲授入门课程。
当前章节：{title}
章节目标：{desc}
课程主题：{topic}

请以你的角色，用口语化的方式讲解这一章节的内容（200-500字）。
要求：
- 语言自然亲切，像是在面对面教学
- 包含具体的例子和实操建议
- 适合作初学者理解
- 用你的风格来说（{inheritor_context.get('style', '')}）"""

        try:
            # 流式输出章节内容
            for token in chat_stream([{"role": "user", "content": section_prompt}]):
                yield ("token", token)
        except Exception as e:
            logger.warning(f"课程章节 '{title}' 生成失败: {e}")
            yield ("token", f"\n\n（此章节生成失败：{e}）\n")

        # 发送章节结束事件
        yield ("section_end", {"section_id": section_id})

    yield ("curriculum_done", {"topic": topic, "craft": craft_name})
