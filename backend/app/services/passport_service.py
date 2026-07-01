"""数字文博护照 - 印章获取业务逻辑"""
import json
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.passport import PassportStamp
from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession, ChatMessage
from app.models.exhibition import HeritageItem
from app.models.favorite import Favorite
from app.models.restoration import RestorationRecord

logger = logging.getLogger("passport_service")

# 模块级缓存 stamps.json 配置
_STAMPS_CONFIG: list[dict] | None = None


def load_stamps_config() -> list[dict]:
    """加载印章配置（模块级缓存）"""
    global _STAMPS_CONFIG
    if _STAMPS_CONFIG is not None:
        return _STAMPS_CONFIG
    config_path = Path(__file__).parent.parent.parent / "config" / "stamps.json"
    with open(config_path, "r", encoding="utf-8") as f:
        _STAMPS_CONFIG = json.load(f)
    return _STAMPS_CONFIG


def get_stamp_config(stamp_type: str) -> dict | None:
    """获取单个印章配置"""
    for s in load_stamps_config():
        if s["type"] == stamp_type:
            return s
    return None


def get_all_stamp_types() -> list[str]:
    """获取所有印章类型标识"""
    return [s["type"] for s in load_stamps_config()]


# === 印章获取规则 ===

def _check_recognition_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查识别模块的可获取印章"""
    earned = []
    category = context.get("category", "")
    confidence = context.get("confidence", 0.0)
    user_total = context.get("user_total_count", 0)

    if user_total >= 1:
        earned.append("first_recognition")

    # 品类探索者: 识别过 5 种不同品类
    distinct_categories = db.query(RecognitionRecord.category).filter(
        RecognitionRecord.user_id == user_id
    ).distinct().count()
    if distinct_categories >= 5:
        earned.append("category_explorer")

    # 鉴宝大师: 单次置信度 >= 0.95
    if confidence >= 0.95:
        earned.append("master_observer")

    return earned


def _check_generation_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查生成模块的可获取印章"""
    earned = []
    user_total = context.get("user_total_count", 0)

    if user_total >= 1:
        earned.append("first_creation")

    # 风格收藏家: 使用过 5 种以上不同风格
    distinct_styles = db.query(GeneratedWork.base_style).filter(
        GeneratedWork.user_id == user_id
    ).distinct().count()
    if distinct_styles >= 5:
        earned.append("style_collector")

    # 多产创作者: 累计 >= 20 件
    if user_total >= 20:
        earned.append("prolific_creator")

    return earned


def _check_workshop_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查工坊模块的可获取印章"""
    earned = []
    session_count = context.get("session_count", 0)
    message_count = context.get("message_count", 0)
    tools_used = context.get("tools_used", [])

    if session_count >= 1:
        earned.append("first_dialogue")

    # 工具大师: 使用过全部 4 种工具
    if len(set(tools_used)) >= 4:
        earned.append("tool_master")

    # 深谈知己: 累计 >= 100 条消息
    if message_count >= 100:
        earned.append("deep_conversationalist")

    return earned


def _check_exhibition_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查展览模块的可获取印章（读操作类，在 GET /status 时计算）"""
    earned = []

    categories_visited = context.get("categories_visited", 0)
    visit_count = context.get("visit_count", 0)
    favorite_count = context.get("favorite_count", 0)

    if visit_count >= 1 or categories_visited >= 1:
        earned.append("first_visit")

    if categories_visited >= 8:
        earned.append("category_collector")

    if favorite_count >= 30:
        earned.append("century_witness")

    return earned


def _check_knowledge_graph_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查知识图谱模块的可获取印章（读操作类）"""
    earned = []
    techniques = context.get("techniques_explored", 0)
    regions = context.get("regions_explored", 0)

    if techniques >= 1 or regions >= 1:
        earned.append("graph_explorer")

    if regions >= 5:
        earned.append("region_explorer")

    if techniques >= 10:
        earned.append("technique_scholar")

    return earned


def _check_restoration_stamps(user_id: int, context: dict, db: Session) -> list[str]:
    """检查修复模块的可获取印章"""
    earned = []
    score = context.get("score", 0)
    restoration_count = context.get("restoration_count", 0)

    if restoration_count >= 1:
        earned.append("first_restoration")

    if restoration_count >= 5:
        earned.append("master_restorer")

    if score >= 90:
        earned.append("perfectionist")

    return earned


# 模块 -> 检查函数 映射
_MODULE_CHECKERS = {
    "recognition": _check_recognition_stamps,
    "generation": _check_generation_stamps,
    "workshop": _check_workshop_stamps,
    "exhibition": _check_exhibition_stamps,
    "knowledge_graph": _check_knowledge_graph_stamps,
    "restoration": _check_restoration_stamps,
}


# === 印章计算引擎 ===

def _get_all_check_contexts(user_id: int, db: Session) -> dict[str, dict]:
    """构建所有模块的检查上下文（用于 GET /status 时全面计算）"""
    return {
        "recognition": {
            "category": "",
            "confidence": 0.0,
            "user_total_count": db.query(RecognitionRecord).filter(
                RecognitionRecord.user_id == user_id
            ).count(),
        },
        "generation": {
            "user_total_count": db.query(GeneratedWork).filter(
                GeneratedWork.user_id == user_id
            ).count(),
        },
        "workshop": {
            "session_count": db.query(ChatSession).filter(
                ChatSession.user_id == user_id
            ).count(),
            "message_count": db.query(ChatMessage).join(ChatSession).filter(
                ChatSession.user_id == user_id
            ).count(),
            "tools_used": [],  # tools_used requires parsing messages; simplified here
        },
        "exhibition": {
            # 用户收藏的不同非遗品类数（仅限 heritage 类型藏品）
            "categories_visited": db.query(HeritageItem.category)
            .join(Favorite, Favorite.item_id == HeritageItem.id)
            .filter(
                Favorite.user_id == user_id,
                Favorite.item_type == "heritage",
            ).distinct().count(),
            # 用户是否有任何展览相关活动（收藏数 > 0 即视为已访问）
            "visit_count": db.query(Favorite).filter(
                Favorite.user_id == user_id
            ).count(),
            "favorite_count": db.query(Favorite).filter(
                Favorite.user_id == user_id
            ).count(),
        },
        "knowledge_graph": {
            "techniques_explored": 0,   # approximated; accumulates via triggers
            "regions_explored": 0,       # approximated; accumulates via triggers
        },
        "restoration": {
            "score": 0,
            "restoration_count": db.query(RestorationRecord).filter(
                RestorationRecord.user_id == user_id
            ).count(),
        },
    }


def check_and_earn_stamps(user_id: int, module: str, context: dict, db: Session) -> list[dict]:
    """
    检查并获取指定模块的印章。

    Args:
        user_id: 用户 ID
        module: 模块标识 (recognition/generation/workshop/exhibition/knowledge_graph/restoration)
        context: 模块相关的上下文数据，用于判断印章条件
        db: 数据库会话

    Returns:
        新获得的印章列表（包含 config 元数据）
    """
    checker = _MODULE_CHECKERS.get(module)
    if not checker:
        logger.warning(f"未知模块 '{module}'，跳过印章检查")
        return []

    earned_types = checker(user_id, context, db)
    newly_earned = []

    for stamp_type in earned_types:
        # 检查是否已获得
        existing = db.query(PassportStamp).filter(
            PassportStamp.user_id == user_id,
            PassportStamp.stamp_type == stamp_type,
        ).first()

        if existing:
            # 已获得，递增 progress
            existing.progress += 1
            db.commit()
        else:
            # 新获得
            config = get_stamp_config(stamp_type)
            stamp = PassportStamp(
                user_id=user_id,
                stamp_type=stamp_type,
                module=module,
                progress=1,
                earned_at=datetime.utcnow(),
            )
            db.add(stamp)
            db.commit()
            if config:
                newly_earned.append(config)

    return newly_earned


def compute_all_earned_stamps(user_id: int, db: Session, compute_read_stamps: bool = True) -> list[dict]:
    """
    全面计算用户的所有印章（包括读操作类印章）。
    在 GET /passport/status 时调用，确保统计是最新的。
    """
    all_configs = load_stamps_config()
    contexts = _get_all_check_contexts(user_id, db)

    all_earned_types = set()

    for module_name, checker in _MODULE_CHECKERS.items():
        ctx = contexts.get(module_name, {})
        try:
            earned_types = checker(user_id, ctx, db)
            all_earned_types.update(earned_types)
        except Exception as e:
            logger.warning(f"计算 {module_name} 印章时出错: {e}")

    # 确保所有 earned types 在 DB 中有记录
    for stamp_type in all_earned_types:
        existing = db.query(PassportStamp).filter(
            PassportStamp.user_id == user_id,
            PassportStamp.stamp_type == stamp_type,
        ).first()
        if not existing:
            config = get_stamp_config(stamp_type)
            if config:
                stamp = PassportStamp(
                    user_id=user_id,
                    stamp_type=stamp_type,
                    module=config["module"],
                    progress=1,
                    earned_at=datetime.utcnow(),
                )
                db.add(stamp)
        # 注意：不在此处递增 progress。
        # progress 只在 check_and_earn_stamps() 中当用户再次达成同一印章条件时才递增。
        # compute_all_earned_stamps 是只读计算，不应修改数据。

    db.commit()

    # 构建返回结果
    result = []
    db_stamps = db.query(PassportStamp).filter(
        PassportStamp.user_id == user_id
    ).order_by(PassportStamp.earned_at.desc()).all()

    for s in db_stamps:
        config = get_stamp_config(s.stamp_type)
        if config:
            result.append({
                **config,
                "earned_at": s.earned_at,
                "progress": s.progress,
            })

    return result


def recalculate_stamps(user_id: int, db: Session) -> dict:
    """
    补偿接口：根据用户所有行为记录重新计算并补发遗漏印章。
    幂等 — 已存在的印章不会重复创建。
    返回 {newly_earned: int, total: int}
    """
    all_configs = load_stamps_config()
    contexts = _get_all_check_contexts(user_id, db)

    newly_earned = 0
    for module_name, checker in _MODULE_CHECKERS.items():
        ctx = contexts.get(module_name, {})
        try:
            earned_types = checker(user_id, ctx, db)
            for stamp_type in earned_types:
                existing = db.query(PassportStamp).filter(
                    PassportStamp.user_id == user_id,
                    PassportStamp.stamp_type == stamp_type,
                ).first()
                if not existing:
                    config = get_stamp_config(stamp_type)
                    if config:
                        stamp = PassportStamp(
                            user_id=user_id,
                            stamp_type=stamp_type,
                            module=config["module"],
                            progress=1,
                            earned_at=datetime.utcnow(),
                        )
                        db.add(stamp)
                        newly_earned += 1
        except Exception as e:
            logger.warning(f"重算 {module_name} 印章时出错: {e}")

    db.commit()

    total = db.query(PassportStamp).filter(
        PassportStamp.user_id == user_id
    ).count()

    return {"newly_earned": newly_earned, "total": total}
