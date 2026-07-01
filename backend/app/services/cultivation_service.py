"""修习之路 — 游戏化学习旅程核心服务

包含: XP 计算、段位系统、每日任务生成、每周挑战、技能树进度
"""

import json
import logging
import random
from datetime import date, datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct as sql_distinct

from app.models.cultivation import UserCultivation, UserQuest
from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession, ChatMessage
from app.models.favorite import Favorite
from app.models.restoration import RestorationRecord
from app.models.exhibition import HeritageItem
from app.models.custom_inheritor import CustomInheritor
from app.models.user import User
from app.services.ai.base import mock_mode

logger = logging.getLogger("cultivation_service")

# === 段位配置 ===
RANKS = [
    {"name": "初窥门径", "xp": 0, "icon": "🥉"},
    {"name": "略有小成", "xp": 100, "icon": "🥈"},
    {"name": "融会贯通", "xp": 300, "icon": "🥇"},
    {"name": "炉火纯青", "xp": 800, "icon": "💎"},
    {"name": "一代宗师", "xp": 2000, "icon": "👑"},
]

# === 技能树配置 ===
SKILL_TREES = [
    {"tree_name": "鉴宝", "label": "鉴宝之路", "icon": "🔍", "thresholds": [5, 10, 20, 50, 100]},
    {"tree_name": "创作", "label": "创作之路", "icon": "🎨", "thresholds": [3, 10, 25, 50, 100]},
    {"tree_name": "问道", "label": "问道之路", "icon": "💬", "thresholds": [10, 30, 100, 300, 1000]},
    {"tree_name": "修复", "label": "修复之路", "icon": "🔧", "thresholds": [3, 10, 25, 50, 100]},
    {"tree_name": "博学", "label": "博学之路", "icon": "📚", "thresholds": [50, 150, 500, 1000, 2000]},
    {"tree_name": "行旅", "label": "行旅之路", "icon": "🌏", "thresholds": [3, 8, 15, 25, 34]},
]

# === 每周挑战配置 ===
WEEKLY_CHALLENGES = [
    {
        "theme": "青瓷周",
        "description": "本周聚焦陶瓷类非遗——完成5个陶瓷相关的任务，解锁「青瓷达人」限定印章",
        "category": "陶瓷",
        "tasks_total": 5,
        "reward_stamp_name": "青瓷达人",
        "reward_stamp_icon": "🏺",
    },
    {
        "theme": "丝路周",
        "description": "沿丝绸之路探索西北3省非遗项目——完成5个西北地域相关的任务",
        "region_regex": "陕西|甘肃|青海|宁夏|新疆",
        "tasks_total": 5,
        "reward_stamp_name": "丝路行者",
        "reward_stamp_icon": "🐫",
    },
    {
        "theme": "刺绣周",
        "description": "探索中国四大名绣——完成5个与刺绣相关的任务，解锁「绣艺传人」限定印章",
        "category": "刺绣",
        "tasks_total": 5,
        "reward_stamp_name": "绣艺传人",
        "reward_stamp_icon": "🪡",
    },
    {
        "theme": "木作周",
        "description": "探索木作与纸艺非遗——完成5个相关任务，解锁「巧手工匠」限定印章",
        "category": "剪纸",
        "tasks_total": 5,
        "reward_stamp_name": "巧手工匠",
        "reward_stamp_icon": "✂️",
    },
]


def _load_quest_templates() -> list[dict]:
    """加载任务模板配置"""
    config_path = Path(__file__).parent.parent.parent / "config" / "quests.json"
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


# === XP 计算 ===

def compute_xp(user_id: int, db: Session) -> int:
    """从所有数据源聚合用户总 XP"""
    xp = 0

    # 鉴宝: recognition × 10
    rec_count = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).count()
    xp += rec_count * 10

    # 创作: generation × 15
    gen_count = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).count()
    xp += gen_count * 15

    # 问道: chat messages × 1
    msg_count = db.query(ChatMessage).join(ChatSession).filter(
        ChatSession.user_id == user_id,
        ChatMessage.role == "user",
    ).count()
    xp += msg_count * 1

    # 修复: restoration × 20
    rest_count = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == user_id
    ).count()
    xp += rest_count * 20

    # 博学: favorites × 5
    fav_count = db.query(Favorite).filter(
        Favorite.user_id == user_id
    ).count()
    xp += fav_count * 5

    # 行旅: 从收藏的 heritage items 获取地域数 × 25
    heritage_favs = db.query(Favorite).filter(
        Favorite.user_id == user_id,
        Favorite.item_type == "heritage",
    ).all()
    heritage_ids = [f.item_id for f in heritage_favs]
    if heritage_ids:
        distinct_regions = db.query(sql_distinct(HeritageItem.region)).filter(
            HeritageItem.id.in_(heritage_ids),
            HeritageItem.region.isnot(None),
        ).count()
        xp += distinct_regions * 25

    return xp


def determine_rank(xp: int) -> tuple[str, int, int]:
    """
    根据 XP 确定段位

    Returns:
        (rank_name, rank_index, xp_to_next)
    """
    rank_idx = 0
    for i, r in enumerate(RANKS):
        if xp >= r["xp"]:
            rank_idx = i
    next_xp = RANKS[rank_idx + 1]["xp"] if rank_idx < len(RANKS) - 1 else None
    xp_to_next = (next_xp - xp) if next_xp else 0
    return RANKS[rank_idx]["name"], rank_idx, max(0, xp_to_next)


# === 技能树进度 ===

def get_skill_tree_progress(user_id: int, db: Session) -> list[dict]:
    """计算6条技能树的进度"""
    results = []

    for tree in SKILL_TREES:
        tree_name = tree["tree_name"]
        thresholds = tree["thresholds"]

        current = _get_tree_current(user_id, tree_name, db)
        level = 1
        for i, th in enumerate(thresholds):
            if current >= th:
                level = i + 2  # 1-indexed, +1 for next level

        next_threshold = thresholds[min(level - 1, len(thresholds) - 1)]
        percentage = min(100, round((current / thresholds[-1]) * 100, 1))

        results.append({
            "tree_name": tree_name,
            "label": tree["label"],
            "icon": tree["icon"],
            "level": min(level, 5),
            "current": current,
            "threshold": next_threshold,
            "percentage": percentage,
        })

    return results


def _get_tree_current(user_id: int, tree_name: str, db: Session) -> int:
    """获取单条技能树的当前数值"""
    if tree_name == "鉴宝":
        return db.query(RecognitionRecord).filter(
            RecognitionRecord.user_id == user_id
        ).count()
    elif tree_name == "创作":
        return db.query(GeneratedWork).filter(
            GeneratedWork.user_id == user_id
        ).count()
    elif tree_name == "问道":
        return db.query(ChatMessage).join(ChatSession).filter(
            ChatSession.user_id == user_id,
            ChatMessage.role == "user",
        ).count()
    elif tree_name == "修复":
        return db.query(RestorationRecord).filter(
            RestorationRecord.user_id == user_id
        ).count()
    elif tree_name == "博学":
        # 浏览 = 收藏数 + 识别数
        return db.query(Favorite).filter(Favorite.user_id == user_id).count() + \
               db.query(RecognitionRecord).filter(RecognitionRecord.user_id == user_id).count()
    elif tree_name == "行旅":
        # 跨地域数
        heritage_favs = db.query(Favorite).filter(
            Favorite.user_id == user_id, Favorite.item_type == "heritage"
        ).all()
        heritage_ids = [f.item_id for f in heritage_favs]
        if heritage_ids:
            return db.query(sql_distinct(HeritageItem.region)).filter(
                HeritageItem.id.in_(heritage_ids), HeritageItem.region.isnot(None)
            ).count()
        return 0
    return 0


# === 每日任务 ===

def get_or_create_daily_quests(user_id: int, db: Session) -> list[dict]:
    """获取今日任务，若不存在则生成"""
    today = date.today()

    # 检查今日是否已有任务
    existing = db.query(UserQuest).filter(
        UserQuest.user_id == user_id,
        UserQuest.date == today,
    ).all()

    if existing:
        return [_quest_to_dict(q) for q in existing]

    # 生成新任务
    return _generate_quests(user_id, today, db)


def _generate_quests(user_id: int, today: date, db: Session) -> list[dict]:
    """生成每日3个任务"""
    templates = _load_quest_templates()

    # 获取用户兴趣画像用于个性化选择
    from app.models.recommendation import UserInterestProfile
    profile = db.query(UserInterestProfile).filter(
        UserInterestProfile.user_id == user_id
    ).first()

    # Mock 模式或简单情况: 随机选 3 个不同模块的任务
    selected = []
    used_modules = set()

    # 优先选择与用户兴趣相关的任务
    if profile:
        cat_weights = json.loads(profile.category_weights_json or "{}")
        top_categories = sorted(cat_weights.items(), key=lambda x: -x[1])[:3]
        for cat, _ in top_categories:
            matching = [t for t in templates
                        if cat in t.get("tags", []) and t["id"] not in [s["id"] for s in selected]]
            if matching:
                # 从匹配模板中选择一个未使用模块的
                unused_matching = [t for t in matching if t["module"] not in used_modules]
                if unused_matching:
                    picked = random.choice(unused_matching)
                    selected.append(picked)
                    used_modules.add(picked["module"])
            if len(selected) >= 3:
                break

    # 补充剩余任务（确保3个不同模块）
    if len(selected) < 3:
        available = [t for t in templates
                     if t["module"] not in used_modules
                     and t["id"] not in [s["id"] for s in selected]]
        random.shuffle(available)
        for t in available:
            if len(selected) >= 3:
                break
            selected.append(t)
            used_modules.add(t["module"])

    # 兜底: 从所有模板中随机选
    if len(selected) < 3:
        remaining = [t for t in templates if t["id"] not in [s["id"] for s in selected]]
        random.shuffle(remaining)
        selected.extend(remaining[:3 - len(selected)])

    # 填充 {category}/{character}/{region} 占位符
    quests = []
    for t in selected[:3]:
        title = t["title"]
        desc = t.get("description_template", t["title"])

        tags = t.get("tags", [])
        if "{category}" in title and tags:
            fill = random.choice(tags)
            title = title.replace("{category}", fill)
            desc = desc.replace("{category}", fill)
        if "{character}" in title and tags:
            fill = random.choice(tags)
            title = title.replace("{character}", fill)
            desc = desc.replace("{character}", fill)
        if "{region}" in title and tags:
            fill = random.choice(tags)
            title = title.replace("{region}", fill)
            desc = desc.replace("{region}", fill)

        # 存入数据库
        quest = UserQuest(
            user_id=user_id,
            quest_template_id=t["id"],
            title=title,
            description=desc,
            module=t["module"],
            skill_tree=t["skill_tree"],
            xp_reward=t["xp_reward"],
            status="pending",
            condition_type=t.get("condition_type", ""),
            condition_threshold=float(t.get("condition_threshold", 1)),
            condition_progress=0.0,
            date=today,
        )
        db.add(quest)
        quests.append(quest)

    db.commit()

    # 刷新获取 ID
    for q in quests:
        db.refresh(q)

    return [_quest_to_dict(q) for q in quests]


def _quest_to_dict(q: UserQuest) -> dict:
    return {
        "id": q.id,
        "quest_template_id": q.quest_template_id,
        "title": q.title,
        "description": q.description,
        "module": q.module,
        "skill_tree": q.skill_tree,
        "xp_reward": q.xp_reward,
        "status": q.status,
        "icon": "📋",
        "condition_type": q.condition_type or "",
        "condition_threshold": float(q.condition_threshold or 1),
        "condition_progress": float(q.condition_progress or 0),
    }


# === 任务完成 ===

def complete_quest(user_id: int, quest_id: int, db: Session) -> dict:
    """完成每日任务（手动完成，仅限不可追踪的任务）"""
    quest = db.query(UserQuest).filter(
        UserQuest.id == quest_id,
        UserQuest.user_id == user_id,
        UserQuest.date == date.today(),
    ).first()

    if not quest:
        raise ValueError("任务不存在或已过期")

    if quest.status == "completed":
        raise ValueError("任务已完成")
    if quest.status == "claimed":
        raise ValueError("奖励已领取")

    # 防作弊：可追踪任务必须条件达成（MOCK_MODE 跳过）
    if quest.condition_type and quest.condition_type.strip():
        if not mock_mode():
            is_met, progress = verify_quest_condition(user_id, quest, db)
            quest.condition_progress = progress
            if not is_met:
                raise ValueError("条件尚未达成，请先完成相关操作后再来领取")

    quest.status = "completed"
    quest.completed_at = datetime.utcnow()

    # 奖励 XP
    cultivation = _get_or_create_cultivation(user_id, db)

    # 连胜加成
    streak_days = cultivation.streak_days or 0
    bonus_pct = 0
    if streak_days >= 7:
        bonus_pct = 0.25
    elif streak_days >= 3:
        bonus_pct = 0.10
    bonus_xp = int(quest.xp_reward * bonus_pct)
    total_xp = quest.xp_reward + bonus_xp

    cultivation.xp += total_xp
    old_rank = cultivation.rank
    new_rank, new_rank_idx, xp_to_next = determine_rank(cultivation.xp)
    cultivation.rank = new_rank
    cultivation.skill_tree_json = json.dumps(
        get_skill_tree_progress(user_id, db), ensure_ascii=False
    )
    cultivation.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(quest)

    result = {
        "xp_gained": total_xp,
        "total_xp": cultivation.xp,
        "new_rank": new_rank if new_rank != old_rank else None,
        "new_rank_index": new_rank_idx if new_rank != old_rank else None,
        "stamp_earned": None,
    }

    # 如果升段，触发印章
    if new_rank != old_rank:
        result["stamp_earned"] = {
            "type": f"rank_{new_rank_idx}",
            "name": new_rank,
            "icon": RANKS[new_rank_idx]["icon"],
            "module": "cultivation",
        }

    return result


# === 每周挑战 ===

def get_weekly_challenge(user_id: int, db: Session) -> dict:
    """获取当前周的挑战"""
    today = date.today()
    iso_week = today.isocalendar()
    week_label = f"{iso_week[0]}-W{iso_week[1]:02d}"

    # 用周数选择主题（4周一轮）
    challenge_idx = iso_week[1] % len(WEEKLY_CHALLENGES)
    challenge = WEEKLY_CHALLENGES[challenge_idx]

    # 计算本周已完成的相关任务数
    # 简化: 检查本周的已完成任务中，模块是否匹配
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_end = week_start + timedelta(days=6)

    # 对于主题周，统计相关任务完成情况
    completed_tasks = 0
    completed_quests = db.query(UserQuest).filter(
        UserQuest.user_id == user_id,
        UserQuest.status == "completed",
        UserQuest.date >= week_start,
        UserQuest.date <= week_end,
    ).all()

    # 简单计数 — 这个值始终能被完成2-3个日常任务满足
    completed_tasks = min(len(completed_quests), challenge["tasks_total"])

    # 周日为过期日
    expires_at = week_end.isoformat()

    return {
        "week_label": week_label,
        "theme": challenge["theme"],
        "description": challenge["description"],
        "tasks_completed": completed_tasks,
        "tasks_total": challenge["tasks_total"],
        "reward_stamp_name": challenge["reward_stamp_name"],
        "reward_stamp_icon": challenge["reward_stamp_icon"],
        "expires_at": expires_at,
    }


# === 综合状态 ===

def get_cultivation_status(user_id: int, db: Session) -> dict:
    """获取用户修习综合状态"""
    cultivation = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()

    if not cultivation:
        cultivation = UserCultivation(user_id=user_id, xp=0)
        db.add(cultivation)
        db.commit()

    # 更新连胜（如果今天还没记录）
    if cultivation.last_active_date != date.today():
        update_streak(user_id, db)

    # Recalculate XP and rank (use the higher of stored vs computed)
    total_xp = compute_xp(user_id, db)
    # Use max of stored and computed — stored could be higher from fire-and-forget awards
    total_xp = max(total_xp, cultivation.xp)
    rank_name, rank_idx, xp_to_next = determine_rank(total_xp)

    # 更新 DB 中的 XP 和段位
    if cultivation.xp != total_xp or cultivation.rank != rank_name:
        cultivation.xp = total_xp
        cultivation.rank = rank_name
        cultivation.updated_at = datetime.utcnow()
        db.commit()

    skill_trees = get_skill_tree_progress(user_id, db)

    return {
        "xp": total_xp,
        "rank": rank_name,
        "rank_index": rank_idx,
        "xp_to_next": xp_to_next,
        "skill_trees": skill_trees,
        "streak_days": cultivation.streak_days or 0,
        "longest_streak": cultivation.longest_streak or 0,
        "last_active_date": cultivation.last_active_date.isoformat() if cultivation.last_active_date else None,
        "streak_bonus_active": (cultivation.streak_days or 0) >= 3,
    }


# === XP 奖励 (fire-and-forget) ===

def award_xp(user_id: int, skill_tree: str, amount: int, db_session: Session = None):
    """串行写入队列 XP 奖励 — 避免多线程竞争 SQLite 写锁"""
    from app.models.database import SessionLocal
    from app.utils.write_queue import enqueue_write

    def _award():
        db = SessionLocal()
        try:
            cultivation = db.query(UserCultivation).filter(
                UserCultivation.user_id == user_id
            ).first()
            if not cultivation:
                cultivation = UserCultivation(user_id=user_id, xp=0)
                db.add(cultivation)

            cultivation.xp += amount
            cultivation.rank = determine_rank(cultivation.xp)[0]
            cultivation.skill_tree_json = json.dumps(
                get_skill_tree_progress(user_id, db), ensure_ascii=False
            )
            cultivation.updated_at = datetime.utcnow()
            db.commit()

            logger.debug(f"用户 {user_id} 获得 {amount} XP ({skill_tree})")
        except Exception as e:
            db.rollback()
            logger.warning(f"XP 奖励失败 (user={user_id}, tree={skill_tree}): {e}")
        finally:
            db.close()

    enqueue_write(_award, name="xp_award")


# === 连胜追踪 ===


def update_streak(user_id: int, db: Session) -> dict:
    """更新用户连续活跃天数，返回连胜状态"""
    cultivation = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()

    if not cultivation:
        cultivation = UserCultivation(user_id=user_id, xp=0)
        db.add(cultivation)

    today = date.today()
    last = cultivation.last_active_date

    if last is None:
        # 首次活跃
        cultivation.streak_days = 1
    elif last == today:
        # 今日已记录
        pass
    elif last == today - timedelta(days=1):
        # 连续签到
        cultivation.streak_days += 1
    else:
        # 断签
        cultivation.streak_days = 1

    cultivation.last_active_date = today
    cultivation.longest_streak = max((cultivation.longest_streak or 0), cultivation.streak_days)
    cultivation.updated_at = datetime.utcnow()
    db.commit()

    return {
        "streak_days": cultivation.streak_days,
        "longest_streak": cultivation.longest_streak,
        "last_active_date": today.isoformat(),
        "streak_bonus_active": cultivation.streak_days >= 3,
    }


# === 条件校验引擎 ===


def _get_or_create_cultivation(user_id: int, db: Session) -> UserCultivation:
    """获取或创建用户的修习记录"""
    cultivation = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()
    if not cultivation:
        cultivation = UserCultivation(user_id=user_id, xp=0)
        db.add(cultivation)
        db.flush()
    return cultivation


def verify_quest_condition(user_id: int, quest: UserQuest, db: Session) -> tuple:
    """
    校验任务条件是否达成。返回 (is_met: bool, progress: float)
    对于不可追踪的条件类型，始终返回 (False, 0.0)
    """
    ct = quest.condition_type
    threshold = quest.condition_threshold or 1

    if not ct:
        return (False, 0.0)

    today = date.today()

    try:
        # --- 识别相关 ---
        if ct == "recognition_count":
            count = db.query(RecognitionRecord).filter(
                RecognitionRecord.user_id == user_id,
                func.date(RecognitionRecord.created_at) == today,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "distinct_categories":
            count = db.query(func.count(func.distinct(RecognitionRecord.category))).filter(
                RecognitionRecord.user_id == user_id,
            ).scalar() or 0
            return (count >= threshold, float(count))

        elif ct == "high_confidence":
            max_conf = db.query(func.max(RecognitionRecord.confidence)).filter(
                RecognitionRecord.user_id == user_id,
            ).scalar() or 0.0
            return (max_conf >= threshold, float(max_conf))

        # --- 创作相关 ---
        elif ct == "generation_count":
            count = db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id,
                func.date(GeneratedWork.created_at) == today,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "img2img_count":
            count = db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id,
                GeneratedWork.mode == "img2img",
            ).count()
            return (count >= threshold, float(count))

        elif ct == "publish_work":
            count = db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id,
                GeneratedWork.is_public == True,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "batch_generation":
            max_images = db.query(func.max(
                func.length(GeneratedWork.images_json)
            )).filter(
                GeneratedWork.user_id == user_id,
            ).scalar() or 0
            # images_json is a JSON array string; rough count by comma
            count = db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "negative_prompt":
            count = db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id,
                GeneratedWork.negative_prompt.isnot(None),
                GeneratedWork.negative_prompt != "",
                func.date(GeneratedWork.created_at) == today,
            ).count()
            return (count >= threshold, float(count))

        # --- 对话相关 ---
        elif ct == "chat_rounds":
            count = db.query(ChatMessage).join(ChatSession).filter(
                ChatSession.user_id == user_id,
                ChatMessage.role == "user",
                func.date(ChatMessage.created_at) == today,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "new_session":
            count = db.query(ChatSession).filter(
                ChatSession.user_id == user_id,
                func.date(ChatSession.created_at) == today,
            ).count()
            return (count >= threshold, float(count))

        elif ct in ("tool_inspect", "tool_connect", "tool_create"):
            tool_prefix = f"/{ct.replace('tool_', '')}"
            count = db.query(ChatMessage).join(ChatSession).filter(
                ChatSession.user_id == user_id,
                ChatMessage.role == "user",
                ChatMessage.content.like(f"{tool_prefix}%"),
            ).count()
            return (count >= threshold, float(count))

        # --- 修复相关 ---
        elif ct == "restoration_count":
            count = db.query(RestorationRecord).filter(
                RestorationRecord.user_id == user_id,
            ).count()
            return (count >= threshold, float(count))

        # --- 收藏/浏览相关 ---
        elif ct == "favorite_count":
            count = db.query(Favorite).filter(
                Favorite.user_id == user_id,
            ).count()
            return (count >= threshold, float(count))

        elif ct == "region_explore":
            # 浏览某地域的非遗
            heritage_favs = db.query(Favorite.item_id).filter(
                Favorite.user_id == user_id,
                Favorite.item_type == "heritage",
            ).subquery()
            count = db.query(func.count(func.distinct(HeritageItem.region))).filter(
                HeritageItem.id.in_(heritage_favs),
                HeritageItem.region.isnot(None),
            ).scalar() or 0
            return (count >= threshold, float(count))

        elif ct == "distinct_regions":
            heritage_favs = db.query(Favorite.item_id).filter(
                Favorite.user_id == user_id,
                Favorite.item_type == "heritage",
            ).subquery()
            count = db.query(func.count(func.distinct(HeritageItem.region))).filter(
                HeritageItem.id.in_(heritage_favs),
                HeritageItem.region.isnot(None),
            ).scalar() or 0
            return (count >= threshold, float(count))

        # --- 自定义传承人 ---
        elif ct == "create_inheritor":
            count = db.query(CustomInheritor).filter(
                CustomInheritor.user_id == user_id,
            ).count()
            return (count >= threshold, float(count))

        # --- 不可追踪 ---
        else:
            # voice_playback, heatmap_view, graph_explore, technique_view,
            # sunburst_drill, timeline_view, choropleth_view, verification_view
            return (False, 0.0)

    except Exception:
        logger.exception(f"条件校验异常 user={user_id} quest={quest.id} type={ct}")
        return (False, 0.0)


# === 自动结算 ===


def check_and_auto_complete_quests(user_id: int, db: Session) -> dict:
    """
    检查所有 pending 的可追踪任务，自动完成已达成条件的。
    返回已完成列表 + 进度更新列表。
    """
    today = date.today()

    pending = db.query(UserQuest).filter(
        UserQuest.user_id == user_id,
        UserQuest.date == today,
        UserQuest.status == "pending",
        UserQuest.condition_type.isnot(None),
        UserQuest.condition_type != "",
    ).all()

    cultivation = _get_or_create_cultivation(user_id, db)
    streak_days = cultivation.streak_days or 0
    old_rank = cultivation.rank

    quests_completed = []
    quests_updated = []
    total_xp_gained = 0

    for quest in pending:
        is_met, progress = verify_quest_condition(user_id, quest, db)

        # 更新进度（无论是否达成）
        if progress != (quest.condition_progress or 0):
            quest.condition_progress = progress
            quests_updated.append({
                "id": quest.id,
                "condition_progress": progress,
                "condition_threshold": quest.condition_threshold or 1,
                "status": "pending",
            })

        if not is_met:
            continue

        # 条件达成 → 自动完成
        quest.status = "completed"
        quest.completed_at = datetime.utcnow()
        quest.condition_progress = progress

        # 连胜 XP 加成
        bonus_pct = 0
        if streak_days >= 7:
            bonus_pct = 0.25
        elif streak_days >= 3:
            bonus_pct = 0.10

        xp_amount = quest.xp_reward
        bonus_xp = int(xp_amount * bonus_pct)
        total_xp = xp_amount + bonus_xp

        cultivation.xp += total_xp
        total_xp_gained += total_xp

        quests_completed.append({
            "quest_id": quest.id,
            "title": quest.title,
            "xp_gained": total_xp,
            "skill_tree": quest.skill_tree,
            "icon": "📋",
        })

    # 更新段位
    new_rank, new_rank_idx, _ = determine_rank(cultivation.xp)
    cultivation.rank = new_rank
    cultivation.updated_at = datetime.utcnow()

    db.commit()

    return {
        "quests_completed": quests_completed,
        "total_xp_gained": total_xp_gained,
        "new_rank": new_rank if new_rank != old_rank else None,
        "quests_updated": quests_updated,
    }


# === XP 重算补偿 ===

def recalculate_xp(user_id: int, db: Session) -> dict:
    """
    根据用户全部行为记录重新计算应有的 XP + 段位 + 技能树。
    用于补偿修复因 fire-and-forget 失败导致的 XP 不一致。
    幂等操作 — 多次调用结果一致。
    """
    cultivation = _get_or_create_cultivation(user_id, db)

    # 基础 XP：每个已完成任务 + 手动完成任务的 XP 总和
    completed_xp = db.query(func.coalesce(func.sum(UserQuest.xp_reward), 0)).filter(
        UserQuest.user_id == user_id,
        UserQuest.status.in_(["completed", "claimed"]),
    ).scalar() or 0

    # 连胜加成：为每个 >= 3 连续天完成的任务加额外 XP
    # 简化：直接取连胜加成百分比应用
    streak_days = cultivation.streak_days or 0
    bonus_pct = 0.25 if streak_days >= 7 else (0.10 if streak_days >= 3 else 0)
    bonus_xp = int(completed_xp * bonus_pct)

    # 行为基础 XP (识别/创作/聊天/修复等核心操作)
    recognition_count = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id,
    ).count()
    generation_count = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id,
    ).count()
    restoration_count = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == user_id,
    ).count()
    chat_count = db.query(ChatSession).filter(
        ChatSession.user_id == user_id,
    ).count()
    favorite_count = db.query(Favorite).filter(
        Favorite.user_id == user_id,
    ).count()

    action_xp = (
        recognition_count * 5 +
        generation_count * 10 +
        restoration_count * 15 +
        chat_count * 3 +
        favorite_count * 2
    )

    total_xp = completed_xp + bonus_xp + action_xp
    old_xp = cultivation.xp or 0

    # 更新
    cultivation.xp = total_xp
    new_rank, new_rank_idx, xp_to_next = determine_rank(total_xp)
    old_rank = cultivation.rank
    cultivation.rank = new_rank
    cultivation.skill_tree_json = json.dumps(
        get_skill_tree_progress(user_id, db), ensure_ascii=False
    )
    cultivation.updated_at = datetime.utcnow()
    db.commit()

    return {
        "old_xp": old_xp,
        "new_xp": total_xp,
        "xp_diff": total_xp - old_xp,
        "breakdown": {
            "completed_quests_xp": completed_xp,
            "streak_bonus_xp": bonus_xp,
            "action_xp": action_xp,
        },
        "old_rank": old_rank,
        "new_rank": new_rank,
        "rank_changed": old_rank != new_rank,
    }
