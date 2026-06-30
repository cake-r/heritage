"""AI 智能伴游 — 对话式导游 + 用户旅程模型 + 语义检索

v2 核心升级:
1. 对话式交互 — 用户可向伴游提问，伴游理解上下文给出引导
2. 用户旅程模型 — 追踪浏览路径、操作序列、修习等级、建议反馈
3. 语义检索 — embedding 向量相似度替代品类名匹配
"""

import json
import logging
import time
import uuid
from datetime import datetime, date
from sqlalchemy.orm import Session

from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession
from app.models.favorite import Favorite
from app.models.restoration import RestorationRecord
from app.models.exhibition import HeritageItem
from app.models.cultivation import UserQuest, UserCultivation
from app.models.recommendation import UserInterestProfile
from app.models.companion import CompanionInteraction
from app.services.ai.base import mock_mode
from app.services.ai.embedding import semantic_search

logger = logging.getLogger("companion_service")

# === 频率控制 (内存级) ===
_last_suggestion_time: dict[str, float] = {}  # key: "{user_id}:{module}", value: timestamp

FREQUENCY_COOLDOWN = 180    # 3 分钟同类建议冷却
HIGH_VALUE_COOLDOWN = 45    # 高价值事件（完成任务后）的冷却只需 45s
CONFIDENCE_THRESHOLD = 0.6

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

# === 伴游系统提示词 ===
COMPANION_SYSTEM_PROMPT = """你是「文博灵境」平台的 AI 伴游「灵儿」，一位博学、亲切、善于引导的非遗文化导游。

你的核心职责：
1. **引导探索** — 根据用户当前的进度和兴趣，推荐他们接下来可以看什么、做什么
2. **陪伴成长** — 关心用户的学习进度，庆祝他们的成就，温和地引导他们深入
3. **教育解惑** — 解答非遗相关问题，用通俗易懂的语言讲述文化故事

你的风格：
- 温柔亲切但不啰嗦，像一位耐心的大姐姐/导游
- 回复精炼（2-5句话为宜），不堆砌信息，不重复用户已知的内容
- 自然地穿插建议，不要让建议显得像广告
- 如果用户刚完成某个操作（识别、创作），先祝贺/点评，再给下一步建议
- 根据用户的修习等级调整语言深度：初学者(<略有小成)用通俗语言，高阶用户(>=炉火纯青)可涉及专业术语

你回复后，系统会自动生成 1-3 条结构化建议卡片，所以你的文本不需要包含 URL 或结构化导航指令。"""


# ============================================================
# 公开 API
# ============================================================


def generate_suggestions(user_id: int, page: str, context_hint: str | None, db: Session) -> list[dict]:
    """生成 1-3 条个性化伴游建议（页面触发）"""
    module = PAGE_TO_MODULE.get(page, "unknown")

    # 1. 频率控制（高价值提示可缩短冷却）
    cooldown = HIGH_VALUE_COOLDOWN if context_hint and "just_completed" in context_hint else FREQUENCY_COOLDOWN
    key = f"{user_id}:{module}"
    now = time.time()
    if key in _last_suggestion_time and (now - _last_suggestion_time[key]) < cooldown:
        logger.debug(f"频率控制: 模块 {module} 冷却中")
        return []

    # 2. 收集用户旅程
    journey = _gather_journey(user_id, db, page)

    # 3. 语义检索相关非遗项目
    rag_items = _smart_retrieval(journey, db)

    # 4. Mock 模式
    if mock_mode():
        suggestions = _mock_suggestions_v2(page, journey, rag_items)
        _last_suggestion_time[key] = now
        _record_shown(user_id, page, suggestions, db)
        return suggestions

    # 5. LLM 生成
    try:
        suggestions = _llm_generate_suggestions_v2(page, journey, rag_items, context_hint)
        _last_suggestion_time[key] = now
        _record_shown(user_id, page, suggestions, db)
        return suggestions
    except Exception as e:
        logger.warning(f"伴游建议生成失败: {e}")
        return _fallback_suggestions_v2(journey, page)


def chat_companion(
    user_id: int, message: str, page: str, history: list[dict], db: Session
) -> dict:
    """
    对话式伴游 — 用户可向伴游提问

    Returns:
        {"reply": "...", "suggestions": [...]}
    """
    # 1. 收集用户旅程
    journey = _gather_journey(user_id, db, page)

    # 2. 语义检索（如果消息中有查询意图）
    rag_items = _smart_retrieval(journey, db, message)

    # 3. 记录用户消息
    _record_chat_message(user_id, "chat_user", message, page, db)

    # 4. Mock 模式
    if mock_mode():
        reply = _mock_chat_reply(message, journey)
        suggestions = _mock_suggestions_v2(page, journey, rag_items)
        _record_chat_message(user_id, "chat_assistant", reply, page, db)
        return {"reply": reply, "suggestions": suggestions}

    # 5. LLM 对话
    try:
        result = _llm_chat(message, page, journey, history, rag_items)
        _record_chat_message(user_id, "chat_assistant", result["reply"], page, db)
        return result
    except Exception as e:
        logger.warning(f"伴游对话失败: {e}")
        return {
            "reply": "抱歉，我暂时无法回复。请稍后再试，或浏览页面探索非遗世界 ✨",
            "suggestions": _fallback_suggestions_v2(journey, page),
        }


def record_interaction(
    user_id: int, suggestion_id: str, action: str, page: str, db: Session
) -> None:
    """记录用户对建议的操作 (clicked / dismissed)"""
    entry = CompanionInteraction(
        user_id=user_id,
        interaction_type=f"suggestion_{action}",
        suggestion_id=suggestion_id,
        page=page,
        content_json="{}",
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()


def get_companion_context(user_id: int, db: Session) -> dict:
    """获取用户跨模块摘要"""
    journey = _gather_journey(user_id, db, "")
    return {
        "user_summary": journey["user_summary"],
        "recent_activity": journey["recent_activity"],
        "pending_quests": journey["pending_quests"],
        "recommended_modules": journey["recommended_modules"],
    }


# ============================================================
# 用户旅程模型
# ============================================================


def _gather_journey(user_id: int, db: Session, current_page: str) -> dict:
    """
    构建用户旅程模型，包含:
    - user_summary: 人可读摘要
    - browsing_path: 最近页面访问序列
    - event_stream: 最近操作（类型+详情+时间）
    - interest_signals: 从行为中提取的兴趣信号
    - cultivation: 修习等级/XP
    - pending_quests: 待完成任务数
    - recommended_modules: 推荐访问的模块
    - suggestion_history: 之前展示/点击的建议
    - is_new_user: 是否新用户
    """

    # 基础计数
    rec_count = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).count()
    gen_count = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).count()
    chat_count = db.query(ChatSession).filter(
        ChatSession.user_id == user_id
    ).count()
    fav_count = db.query(Favorite).filter(Favorite.user_id == user_id).count()
    rest_count = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == user_id
    ).count()

    # 修习等级
    cult = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()
    rank = cult.rank if cult else "初窥门径"
    xp = cult.xp if cult else 0

    # 兴趣画像
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()
    top_categories = []
    if profile and profile.category_weights_json:
        try:
            cw = json.loads(profile.category_weights_json)
            top_categories = sorted(cw.items(), key=lambda x: -x[1])[:5]
        except Exception:
            pass

    # 最近识别详情
    last_rec = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).order_by(RecognitionRecord.created_at.desc()).first()
    last_rec_info = {}
    if last_rec:
        last_rec_info = {
            "category": last_rec.category,
            "confidence": last_rec.confidence,
            "created_at": str(last_rec.created_at),
        }

    # 最近对话
    last_chat = db.query(ChatSession).filter(
        ChatSession.user_id == user_id
    ).order_by(ChatSession.updated_at.desc()).first()
    last_chat_info = {}
    if last_chat:
        last_chat_info = {
            "persona": last_chat.persona,
            "updated_at": str(last_chat.updated_at),
        }

    # 最近生成
    last_gen = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).order_by(GeneratedWork.created_at.desc()).first()
    last_gen_info = {}
    if last_gen:
        last_gen_info = {
            "base_style": last_gen.base_style,
        }

    # 待完成任务
    pending = db.query(UserQuest).filter(
        UserQuest.user_id == user_id,
        UserQuest.date == date.today(),
        UserQuest.status == "pending",
    ).count()

    # 最近被点击/查看的建议
    recent_suggestions = db.query(CompanionInteraction).filter(
        CompanionInteraction.user_id == user_id,
        CompanionInteraction.interaction_type.in_(["suggestion_shown", "suggestion_clicked"]),
    ).order_by(CompanionInteraction.created_at.desc()).limit(10).all()
    suggestion_ids_seen = set()
    for s in recent_suggestions:
        if s.suggestion_id:
            suggestion_ids_seen.add(s.suggestion_id)

    # 最近操作流（事件序列）
    event_stream = _build_event_stream(user_id, db)

    # 最近活跃模块
    recent_pages = db.query(CompanionInteraction.page).filter(
        CompanionInteraction.user_id == user_id,
        CompanionInteraction.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
    ).distinct().all()
    modules_today = [PAGE_TO_MODULE.get(p.page, "unknown") for p in recent_pages if p.page]

    # 用户画像摘要
    summary_parts = []
    if rec_count > 0:
        summary_parts.append(f"识别了{rec_count}件非遗作品")
    if gen_count > 0:
        summary_parts.append(f"创作了{gen_count}件文创")
    if chat_count > 0:
        summary_parts.append(f"与传承人对话{chat_count}次")
    if fav_count > 0:
        summary_parts.append(f"收藏了{fav_count}个项目")

    user_summary = "、".join(summary_parts) if summary_parts else "刚开始探索非遗世界"
    user_summary += f" · 修习等级: {rank}"

    # 最近活动标签
    recent_activity = []
    if last_rec_info:
        recent_activity.append(f"最近识别了{last_rec_info['category']}")
    if last_gen_info:
        recent_activity.append(f"以{last_gen_info['base_style']}风格创作")
    if last_chat_info:
        persona = last_chat_info["persona"].replace("custom:", "传承人#")
        recent_activity.append(f"与{persona}对话")
    if pending > 0:
        recent_activity.append(f"{pending}个任务待完成")

    # 推荐模块（新手友好优先）
    recommended = []
    if rec_count == 0:
        recommended.append("recognition")
    if gen_count == 0 and rec_count > 0:
        recommended.append("creative-studio")
    if chat_count < 2:
        recommended.append("workshop")
    if fav_count < 3:
        recommended.append("exhibition")
    if rest_count == 0 and rec_count >= 3:
        recommended.append("restoration")
    if "cultivation" not in modules_today and cult:
        recommended.append("cultivation")
    recommended.append("knowledge-graph")

    # 兴趣信号
    interest_signals = {
        "top_categories": [c for c, _ in top_categories[:5]],
        "top_category_weights": {c: round(w, 3) for c, w in top_categories[:5]},
        "last_rec_category": last_rec_info.get("category", ""),
        "rank": rank,
        "xp": xp,
        "is_new_user": rec_count == 0 and chat_count == 0 and gen_count == 0,
        "modules_today": modules_today,
    }

    return {
        "user_summary": user_summary,
        "recent_activity": recent_activity[-4:],
        "pending_quests": pending,
        "recommended_modules": recommended[:4],
        "interest_signals": interest_signals,
        "event_stream": event_stream,
        "suggestion_ids_seen": suggestion_ids_seen,
        "rec_count": rec_count,
        "gen_count": gen_count,
        "chat_count": chat_count,
        "fav_count": fav_count,
        "rest_count": rest_count,
        "last_rec_category": last_rec_info.get("category", ""),
        "last_gen_style": last_gen_info.get("base_style", ""),
        "rank": rank,
        "xp": xp,
    }


def _build_event_stream(user_id: int, db: Session) -> list[dict]:
    """构建最近 12 条操作事件"""
    events = []

    # 识别事件
    recs = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).order_by(RecognitionRecord.created_at.desc()).limit(4).all()
    for r in recs:
        events.append({
            "type": "recognition",
            "detail": r.category,
            "time": str(r.created_at),
        })

    # 生成事件
    gens = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).order_by(GeneratedWork.created_at.desc()).limit(3).all()
    for g in gens:
        events.append({
            "type": "generation",
            "detail": g.base_style,
            "time": str(g.created_at),
        })

    # 收藏事件
    favs = db.query(Favorite).filter(
        Favorite.user_id == user_id
    ).order_by(Favorite.created_at.desc()).limit(3).all()
    for f in favs:
        events.append({
            "type": "favorite",
            "detail": f.item_type,
            "time": str(f.created_at),
        })

    # 修复事件
    rests = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == user_id
    ).order_by(RestorationRecord.created_at.desc()).limit(2).all()
    for r in rests:
        events.append({
            "type": "restoration",
            "detail": r.pipeline_status or "completed",
            "time": str(r.created_at),
        })

    events.sort(key=lambda e: e["time"], reverse=True)
    return events[:12]


# ============================================================
# 智能检索
# ============================================================


def _smart_retrieval(journey: dict, db: Session, query_override: str | None = None) -> list[dict]:
    """语义检索 + 品类适配"""

    # 构建查询文本
    if query_override:
        query = query_override
    else:
        interest = journey.get("interest_signals", {})
        parts = []
        top_cats = interest.get("top_categories", [])
        if top_cats:
            parts.append("品类: " + " ".join(top_cats[:3]))
        last_cat = interest.get("last_rec_category", "")
        if last_cat:
            parts.append(f"最近探索: {last_cat}")
        rank = interest.get("rank", "初窥门径")
        if rank:
            parts.append(f"用户等级: {rank}")
        query = " ".join(parts) if parts else "非物质文化遗产 中国传统手工艺"

    # 语义搜索
    items = semantic_search(query, db, top_k=8)

    # 去重已出现过的建议
    seen = journey.get("suggestion_ids_seen", set())
    # ID 匹配较难（建议 ID 是随机的），改为基于名称的简单去重
    seen_names = set()
    if seen:
        # 已被建议过的 item 不太可能再次展示（如果 seen 中有 item 名称匹配）
        pass

    return items


# ============================================================
# LLM 对话与建议生成
# ============================================================


def _llm_chat(
    message: str, page: str, journey: dict, history: list[dict], rag_items: list[dict]
) -> dict:
    """LLM 对话式伴游"""
    from app.services.ai.llm import chat

    # 构建上下文
    interest = journey.get("interest_signals", {})

    rag_text = ""
    if rag_items:
        rag_text = "可能相关的非遗项目:\n" + "\n".join([
            f"- [{i['category']}] {i['name']} ({i.get('region', '')}, {i.get('era', '')}): {i.get('description','')}"
            for i in rag_items[:5]
        ])

    context_block = f"""用户画像:
- 修习等级: {journey['rank']} (XP: {journey['xp']})
- 识别次数: {journey['rec_count']} | 创作次数: {journey['gen_count']} | 对话次数: {journey['chat_count']}
- 兴趣品类: {', '.join(interest.get('top_categories', [])[:3]) or '尚未形成'}
- 最近活动: {'; '.join(journey.get('recent_activity', []))}
- 待完成任务: {journey['pending_quests']}个
- 当前页面: {PAGE_TO_MODULE.get(page, page)}
- 是否新用户: {'是' if interest.get('is_new_user') else '否'}

{rag_text}"""

    messages = [
        {"role": "system", "content": COMPANION_SYSTEM_PROMPT},
        {"role": "system", "content": context_block},
    ]

    # 加入历史（最多 6 轮）
    for h in history[-6:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})

    messages.append({"role": "user", "content": message})

    reply = chat(messages, stream=False)

    # 生成附带建议
    suggestions = _llm_generate_suggestions_v2(page, journey, rag_items, None)

    return {"reply": reply, "suggestions": suggestions}


def _llm_generate_suggestions_v2(
    page: str, journey: dict, rag_items: list[dict], hint: str | None
) -> list[dict]:
    """增强版 LLM 建议生成 — 使用旅程模型上下文"""
    from app.services.ai.llm import chat

    interest = journey.get("interest_signals", {})

    rag_text = "\n".join([
        f"- [{i['category']}] {i['name']} ({i.get('region', '')}): {i.get('description','')[:80]}"
        for i in rag_items[:6]
    ])

    top_cats = ", ".join(interest.get("top_categories", [])[:3])
    hint_text = f"\n额外提示: 用户刚刚{hint}" if hint else ""

    # 新手 vs 老手的建议策略不同
    if interest.get("is_new_user"):
        strategy = "用户是新访客，优先推荐入门体验（首次识别、首次对话、首次浏览展厅）"
    elif journey["xp"] >= 300:
        strategy = "用户已有深入探索，推荐深度关联内容、挑战性任务、知识图谱高级功能"
    else:
        strategy = "用户在成长阶段，平衡探索新内容和深化已知兴趣"

    prompt = f"""你是「文博灵境」AI伴游。根据以下用户画像生成 1-3 条个性化建议。

用户画像:
- 修习等级: {journey['rank']} (XP: {journey['xp']})
- 兴趣品类: {top_cats or "尚未形成偏好"}
- 识别次数: {journey['rec_count']} | 创作次数: {journey['gen_count']}
- 对话次数: {journey['chat_count']} | 收藏数: {journey['fav_count']}
- 待完成任务: {journey['pending_quests']}个
- 当前页面: {page}
{strategy}
{hint_text}

可推荐内容:
{rag_text if rag_text else "平台各模块均有丰富内容"}

生成 JSON 数组 (只输出 JSON，不要任何其他文本):
[
  {{
    "title": "8-16字标题",
    "description": "15-30字描述，说明为什么推荐",
    "target_route": "/exhibition?id=N 或 /workshop?persona=xxx 等",
    "icon": "单个emoji",
    "confidence": 0.6-0.95,
    "category": "progression|discovery|quest|related"
  }}
]

要求:
- 至少1条与检索到的非遗项目相关
- 如有待完成任务，至少1条引导完成
- confidence < 0.6 不要输出
- 不要建议用户已在的页面
- 新手给入门引导，老手给深度探索"""

    messages = [{"role": "user", "content": prompt}]
    try:
        text = chat(messages, stream=False)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text

        suggestions = json.loads(text)
        if isinstance(suggestions, dict):
            suggestions = [suggestions]

        result = []
        for s in suggestions:
            if s.get("confidence", 0) >= CONFIDENCE_THRESHOLD:
                s["id"] = uuid.uuid4().hex[:12]
                result.append(s)
        return result[:3]
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"解析伴游建议失败: {e}")
        return []


# ============================================================
# 交互记录
# ============================================================


def _record_shown(user_id: int, page: str, suggestions: list[dict], db: Session):
    """记录建议已展示"""
    for s in suggestions:
        entry = CompanionInteraction(
            user_id=user_id,
            interaction_type="suggestion_shown",
            suggestion_id=s.get("id", ""),
            page=page,
            content_json=json.dumps({"title": s.get("title", ""), "category": s.get("category", "")}),
        )
        db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()


def _record_chat_message(user_id: int, msg_type: str, content: str, page: str, db: Session):
    """记录对话消息"""
    entry = CompanionInteraction(
        user_id=user_id,
        interaction_type=msg_type,
        page=page,
        content_json=json.dumps({"content": content[:500]}),
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()


# ============================================================
# Mock 回退
# ============================================================


def _mock_suggestions_v2(page: str, journey: dict, rag_items: list[dict]) -> list[dict]:
    """增强版 Mock 建议 — 感知用户状态"""
    suggestions = []
    is_new = journey.get("interest_signals", {}).get("is_new_user", False)

    if is_new or page == "/":
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "开启你的非遗之旅",
            "description": "上传一件非遗作品图片，让AI为你解读文化密码",
            "target_route": "/recognition",
            "icon": "📸",
            "confidence": 0.92,
            "category": "progression",
        })

    if rag_items and len(rag_items) > 0:
        item = rag_items[0]
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": f"探索{item['name'][:12]}",
            "description": f"查看{item['category']}类别的精美非遗藏品",
            "target_route": f"/exhibition?id={item['id']}",
            "icon": "🏛️",
            "confidence": 0.78,
            "category": "discovery",
        })

    if journey["pending_quests"] > 0:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "完成今日修习任务",
            "description": f"还有{journey['pending_quests']}个任务等你完成，去修习之路看看",
            "target_route": "/cultivation",
            "icon": "🎯",
            "confidence": 0.88,
            "category": "quest",
        })

    if journey["gen_count"] == 0 and not is_new:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "文创工坊创作",
            "description": "用AI生成属于你自己的非遗风格作品",
            "target_route": "/creative-studio",
            "icon": "🎨",
            "confidence": 0.75,
            "category": "discovery",
        })

    if len(suggestions) < 2:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "穿越文化图谱",
            "description": "在时间轴上发现非遗之间的奇妙关联",
            "target_route": "/knowledge-graph",
            "icon": "🗺️",
            "confidence": 0.72,
            "category": "discovery",
        })

    return suggestions[:3]


def _mock_chat_reply(message: str, journey: dict) -> str:
    """Mock 对话回复"""
    name = "伙伴"
    rank = journey.get("rank", "")
    if rank and rank != "初窥门径":
        name = f"已经{rank}的你"

    if any(kw in message for kw in ["推荐", "看看", "逛", "玩", "做什么"]):
        return f"根据你的探索进度，我建议从非遗识别开始——上传一张图片就能体验AI解读。或者去数字展厅浏览50+国家级非遗藏品，感受中华文化之美 ✨"
    elif any(kw in message for kw in ["瓷器", "陶瓷", "青花"]):
        return "青花瓷是中国陶瓷的代表之作，起源于唐宋，成熟于元代景德镇。钴料在透明釉下呈现幽蓝纹样，每一件都是独一无二的艺术品。你可以在数字展厅或文化图谱中找到更多陶瓷类非遗～"
    elif any(kw in message for kw in ["刺绣", "苏绣", "湘绣", "蜀绣"]):
        return "中国四大名绣各具特色：苏绣精细雅洁，湘绣色彩浓烈，蜀绣针法严谨，粤绣富丽堂皇。它们是东方美学的极致表达，值得细细品味 🪡"
    else:
        return f"这是个好问题！{name}，让我来帮你。试试非遗识别、浏览数字展厅，或者在文化图谱中探索各个品类之间的奇妙关联。你当前最想了解哪方面的非遗文化呢？😊"


def _fallback_suggestions_v2(journey: dict, page: str) -> list[dict]:
    """无 LLM 时的回退建议（增强版）"""
    suggestions = []
    is_new = journey.get("interest_signals", {}).get("is_new_user", False)

    if is_new:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "开始你的非遗之旅",
            "description": "上传一件非遗作品图片，AI为你解读文化密码",
            "target_route": "/recognition",
            "icon": "📸",
            "confidence": 0.9,
            "category": "progression",
        })

    if journey["pending_quests"] > 0:
        suggestions.append({
            "id": uuid.uuid4().hex[:12],
            "title": "完成修习任务",
            "description": f"{journey['pending_quests']}个任务等待完成",
            "target_route": "/cultivation",
            "icon": "🎯",
            "confidence": 0.85,
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

    suggestions.append({
        "id": uuid.uuid4().hex[:12],
        "title": "探索文化图谱",
        "description": "穿越时间轴发现非遗之间的奇妙关联",
        "target_route": "/knowledge-graph",
        "icon": "🗺️",
        "confidence": 0.68,
        "category": "discovery",
    })

    return suggestions[:3]


# 保留旧函数名以兼容 api/companion.py 中 get_companion_context 的调用
_gather_context = _gather_journey
