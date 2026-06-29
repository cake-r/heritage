"""修习之路 — 游戏化学习旅程核心服务

包含: XP 计算、段位系统、每日任务生成、每周挑战、技能树进度
"""

import json
import logging
import random
import threading
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
    }


# === 任务完成 ===

def complete_quest(user_id: int, quest_id: int, db: Session) -> dict:
    """完成每日任务"""
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

    quest.status = "completed"
    quest.completed_at = datetime.utcnow()

    # 奖励 XP
    cultivation = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()

    if not cultivation:
        cultivation = UserCultivation(user_id=user_id, xp=0)
        db.add(cultivation)

    cultivation.xp += quest.xp_reward
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
        "xp_gained": quest.xp_reward,
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
    }


# === XP 奖励 (fire-and-forget) ===

def award_xp(user_id: int, skill_tree: str, amount: int, db_session: Session = None):
    """Fire-and-forget XP 奖励 — 在独立线程中运行"""
    from app.models.database import SessionLocal

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

    threading.Thread(target=_award, daemon=True).start()
