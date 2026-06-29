"""AI 智能伴游 — 跨模块上下文建议引擎

核心流程:
1. 频率控制 (同模块3分钟内不重复)
2. 收集跨模块上下文 (识别/对话/收藏/任务/兴趣画像)
3. RAG 检索 (heritage_items + techniques)
4. DeepSeek 生成 1-3 条 JSON 建议
5. 过滤 confidence < 0.6
"""

import json
import logging
import time
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession
from app.models.favorite import Favorite
from app.models.restoration import RestorationRecord
from app.models.exhibition import HeritageItem
from app.models.cultivation import UserQuest, UserCultivation
from app.models.recommendation import UserInterestProfile
from app.services.ai.base import mock_mode

logger = logging.getLogger("companion_service")

# === 频率控制 (内存级) ===
_last_suggestion_time: dict[str, float] = {}  # key: "{user_id}:{module}", value: timestamp

FREQUENCY_COOLDOWN = 180  # 3 分钟 (秒)
CONFIDENCE_THRESHOLD = 0.6

# 模块名映射: 前端路由 → 模块标识
PAGE_TO_MODULE: dict[str, str] = {
    "/": "home",
    "/recognition": "recognition",
    "/creative-studio": "generation",
    "/workshop": "workshop",
    "/exhibition": "exhibition",
    "/knowledge-graph": "knowledge_graph",
    "/restoration": "restoration",
    "/passport": "passport",
    "/cultivation": "cultivation",
    "/user-center": "user_center",
}


def generate_suggestions(user_id: int, page: str, context_hint: str | None, db: Session) -> list[dict]:
    """
    生成 1-3 条个性化伴游建议。

    Args:
        user_id: 用户 ID
        page: 当前前端路由
        context_hint: 额外上下文 (如 "just_completed_recognition")
        db: 数据库会话

    Returns:
        建议列表 (最多3条, confidence >= 0.6)
    """
    module = PAGE_TO_MODULE.get(page, "unknown")

    # 1. 频率控制
    key = f"{user_id}:{module}"
    now = time.time()
    if key in _last_suggestion_time and (now - _last_suggestion_time[key]) < FREQUENCY_COOLDOWN:
        logger.debug(f"频率控制: 模块 {module} 在 {FREQUENCY_COOLDOWN}s 内已有建议")
        return []

    # 2. 收集跨模块上下文
    context = _gather_context(user_id, db)

    # 3. RAG 检索
    rag_items = _rag_retrieval(context, db)

    # 4. Mock 模式下返回预设建议
    if mock_mode():
        suggestions = _mock_suggestions(page, context, rag_items)
        _last_suggestion_time[key] = now
        return suggestions

    # 5. DeepSeek 生成建议
    try:
        suggestions = _llm_generate_suggestions(page, context, rag_items, context_hint)
        _last_suggestion_time[key] = now
        return suggestions
    except Exception as e:
        logger.warning(f"伴游建议生成失败: {e}")
        return _fallback_suggestions(context, page)


def _gather_context(user_id: int, db: Session) -> dict:
    """收集用户跨模块行为数据"""
    context = {
        "user_id": user_id,
        "recognition": {},
        "generation": {},
        "chat": {},
        "favorites": {},
        "restoration": {},
        "quests": {},
    }

    # 最近识别
    last_rec = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).order_by(RecognitionRecord.created_at.desc()).first()
    if last_rec:
        context["recognition"] = {
            "last_category": last_rec.category,
            "last_confidence": last_rec.confidence,
            "total_count": db.query(RecognitionRecord).filter(
                RecognitionRecord.user_id == user_id
            ).count(),
        }

    # 最近生成
    last_gen = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).order_by(GeneratedWork.created_at.desc()).first()
    if last_gen:
        context["generation"] = {
            "last_style": last_gen.base_style,
            "total_count": db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id
            ).count(),
        }

    # 对话
    chat_count = db.query(ChatSession).filter(
        ChatSession.user_id == user_id
    ).count()
    if chat_count > 0:
        last_session = db.query(ChatSession).filter(
            ChatSession.user_id == user_id
        ).order_by(ChatSession.updated_at.desc()).first()
        context["chat"] = {
            "total_sessions": chat_count,
            "last_persona": last_session.persona if last_session else "",
        }

    # 收藏
    fav_count = db.query(Favorite).filter(Favorite.user_id == user_id).count()
    context["favorites"] = {"total_count": fav_count}

    # 修复
    rest_count = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == user_id
    ).count()
    context["restoration"] = {"total_count": rest_count}

    # 兴趣画像
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()
    if profile:
        cat_weights = json.loads(profile.category_weights_json or "{}")
        context["interests"] = {
            "top_categories": sorted(cat_weights.items(), key=lambda x: -x[1])[:3],
            "interaction_count": profile.interaction_count,
        }

    # 待完成任务
    today = datetime.utcnow().date()
    pending_quests = db.query(UserQuest).filter(
        UserQuest.user_id == user_id,
        UserQuest.date == today,
        UserQuest.status == "pending",
    ).count()
    context["quests"] = {"pending_count": pending_quests}

    return context


def _rag_retrieval(context: dict, db: Session) -> list[dict]:
    """从知识图谱检索相关内容"""
    items = []
    top_categories = context.get("interests", {}).get("top_categories", [])

    for cat, weight in top_categories:
        heritage = db.query(HeritageItem).filter(
            HeritageItem.category == cat
        ).limit(3).all()
        for h in heritage:
            images = json.loads(h.images_json or "[]")
            items.append({
                "id": h.id,
                "name": h.name,
                "category": h.category,
                "region": h.region,
                "era": h.era,
                "image_url": images[0] if images else "",
                "description": (h.description or "")[:120],
                "techniques": json.loads(h.techniques_json or "[]"),
            })

    # 也加入最近识别的关联品类
    last_cat = context.get("recognition", {}).get("last_category", "")
    if last_cat and last_cat not in [c for c, _ in top_categories]:
        heritage = db.query(HeritageItem).filter(
            HeritageItem.category == last_cat
        ).limit(2).all()
        for h in heritage:
            images = json.loads(h.images_json or "[]")
            items.append({
                "id": h.id,
                "name": h.name,
                "category": h.category,
                "region": h.region,
                "image_url": images[0] if images else "",
                "description": (h.description or "")[:120],
                "techniques": json.loads(h.techniques_json or "[]"),
            })

    return items[:5]


def _llm_generate_suggestions(page: str, context: dict, rag_items: list[dict], hint: str | None) -> list[dict]:
    """调用 DeepSeek 生成个性化建议"""
    from app.services.ai.llm import chat

    # 构建 prompt
    rag_text = "\n".join([
        f"- [{item['category']}] {item['name']} ({item.get('region', '')}): {item['description']}"
        for item in rag_items
    ])

    interests = context.get("interests", {})
    top_cats = ", ".join([c for c, _ in interests.get("top_categories", [])[:3]])

    hint_text = f"\n额外提示: 用户刚刚{hint}" if hint else ""

    prompt = f"""你是「文博灵境」AI伴游助手，为非遗文化爱好者提供个性化探索建议。

用户当前页面: {page}
用户兴趣品类: {top_cats or "尚未形成明确偏好"}
对话次数: {context.get('chat', {}).get('total_sessions', 0)}
收藏数: {context.get('favorites', {}).get('total_count', 0)}
待完成任务: {context.get('quests', {}).get('pending_count', 0)}
{hint_text}

可推荐的知识图谱内容:
{rag_text if rag_text else "暂无匹配内容"}

请生成 1-3 条个性化伴游建议。每条建议包含标题、描述、目标路由和图标。
建议类型可以是:
- progression: 引导用户继续学习/探索
- discovery: 推荐新内容
- quest: 提醒完成任务
- related: 关联推荐

严格按 JSON 数组格式返回 (不要任何其他文本):
[
  {{
    "title": "建议标题(8-16字)",
    "description": "建议描述(15-30字)",
    "target_route": "/exhibition?id=N 或 /workshop 等",
    "icon": "emoji字符",
    "confidence": 0.0-1.0,
    "category": "progression|discovery|quest|related"
  }}
]

要求:
- 至少1条与知识图谱具体内容相关
- 如果有待完成任务，至少1条引导完成任务
- confidence 低于0.6的建议不要输出
- 不要建议用户已在的页面"""

    messages = [{"role": "user", "content": prompt}]
    try:
        text = chat(messages, stream=False)
        # 解析 JSON
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text

        suggestions = json.loads(text)
        if isinstance(suggestions, dict):
            suggestions = [suggestions]

        # 过滤 + 添加 ID
        result = []
        for s in suggestions:
            if s.get("confidence", 0) >= CONFIDENCE_THRESHOLD:
                s["id"] = uuid.uuid4().hex[:12]
                result.append(s)

        return result[:3]
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"解析伴游建议失败: {e}")
        return []


def _mock_suggestions(page: str, context: dict, rag_items: list[dict]) -> list[dict]:
    """Mock 模式下的预设建议"""
    suggestions = []

    if page == "/recognition" or page == "/":
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "探索陶瓷的世界",
            "description": "景德镇青花瓷正在展厅等你，去看看宋代五大名窑吧",
            "target_route": "/exhibition?id=7",
            "icon": "🏺",
            "confidence": 0.85,
            "category": "discovery",
        })

    if page == "/exhibition" or page == "/":
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "试试苏绣创作",
            "description": "在文创工坊用苏绣风格生成一幅属于你的作品",
            "target_route": "/creative-studio",
            "icon": "🎨",
            "confidence": 0.78,
            "category": "related",
        })

    if page == "/workshop" and context.get("quests", {}).get("pending_count", 0) > 0:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "还有任务待完成",
            "description": "今日修习任务尚未完成，去修习之路看看进度吧",
            "target_route": "/cultivation",
            "icon": "📋",
            "confidence": 0.9,
            "category": "quest",
        })

    if len(suggestions) < 2:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "游览文化图谱",
            "description": "穿越时间轴，发现非遗项目之间的奇妙关联",
            "target_route": "/knowledge-graph",
            "icon": "🗺️",
            "confidence": 0.72,
            "category": "discovery",
        })

    return suggestions[:3]


def _fallback_suggestions(context: dict, page: str) -> list[dict]:
    """无 LLM 时的回退建议"""
    suggestions = []

    if context.get("recognition", {}).get("total_count", 0) == 0:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "开始你的第一次识别",
            "description": "上传一件非遗作品图片，让AI为你解读其中的文化密码",
            "target_route": "/recognition",
            "icon": "📸",
            "confidence": 0.85,
            "category": "progression",
        })

    if context.get("quests", {}).get("pending_count", 0) > 0:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "完成今日修习任务",
            "description": f"还有 {context['quests']['pending_count']} 个每日任务等待完成",
            "target_route": "/cultivation",
            "icon": "🎯",
            "confidence": 0.88,
            "category": "quest",
        })

    suggestions.append({
        "id": uuid.uuid4().hex[:12],
        "title": "逛逛数字展厅",
        "description": "浏览50+国家级非遗藏品的高清图文资料",
        "target_route": "/exhibition",
        "icon": "🏛️",
        "confidence": 0.7,
        "category": "discovery",
    })

    return suggestions[:3]


def get_companion_context(user_id: int, db: Session) -> dict:
    """获取用户跨模块摘要（供 Drawer 欢迎语使用）"""
    context = _gather_context(user_id, db)

    rec_count = context.get("recognition", {}).get("total_count", 0)
    gen_count = context.get("generation", {}).get("total_count", 0)
    chat_count = context.get("chat", {}).get("total_sessions", 0)
    fav_count = context.get("favorites", {}).get("total_count", 0)

    # 构建人可读的摘要
    summary_parts = []
    if rec_count > 0:
        summary_parts.append(f"你已识别了 {rec_count} 件非遗作品")
    if gen_count > 0:
        summary_parts.append(f"创作了 {gen_count} 件文创作品")
    if chat_count > 0:
        summary_parts.append(f"与传承人进行了 {chat_count} 次对话")

    summary = "、".join(summary_parts) if summary_parts else "欢迎来到非遗数字交互平台，开始你的文化探索之旅吧"

    # 最近活动
    recent = []
    last_cat = context.get("recognition", {}).get("last_category", "")
    if last_cat:
        recent.append(f"最近识别了{last_cat}作品")
    last_style = context.get("generation", {}).get("last_style", "")
    if last_style:
        recent.append(f"最近以{last_style}风格创作了作品")
    last_persona = context.get("chat", {}).get("last_persona", "")
    if last_persona:
        name = last_persona.replace("custom:", "传承人#")
        recent.append(f"最近与{name}对话")

    # 推荐模块
    recommended = []
    if rec_count == 0:
        recommended.append("recognition")
    if gen_count == 0:
        recommended.append("creative-studio")
    if fav_count < 3:
        recommended.append("exhibition")
    if chat_count == 0:
        recommended.append("workshop")

    return {
        "user_summary": summary,
        "recent_activity": recent[-3:],
        "pending_quests": context.get("quests", {}).get("pending_count", 0),
        "recommended_modules": recommended[:3],
    }
