"""数字文博护照 API"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.passport import PassportStamp
from app.api.deps import get_current_user
from app.schemas.passport import (
    PassportStatus, EarnedStamp, StampEarnResponse,
    TimelineMilestone, RegionProgress, PassportExport,
)
from app.services.passport_service import (
    load_stamps_config,
    get_stamp_config,
    compute_all_earned_stamps,
    check_and_earn_stamps,
    build_timeline,
    get_user_regions,
)

logger = logging.getLogger("passport_api")
router = APIRouter()


@router.get("/status", response_model=PassportStatus)
def get_passport_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取护照概览：总/已获得印章数、稀有度分布、完成度、最近印章"""
    # 全面计算（包括读操作类印章）
    all_earned = compute_all_earned_stamps(current_user.id, db, compute_read_stamps=True)
    all_configs = load_stamps_config()

    total = len(all_configs)
    earned_count = len(all_earned)

    # 稀有度计数
    rarity_counts = {"common": 0, "rare": 0, "epic": 0}
    for s in all_earned:
        rarity = s.get("rarity", "common")
        if rarity in rarity_counts:
            rarity_counts[rarity] += 1

    # 最近获得的 5 枚
    last_5 = sorted(all_earned, key=lambda s: s.get("earned_at", ""), reverse=True)[:5]

    return PassportStatus(
        total_stamps=total,
        earned_count=earned_count,
        common_count=rarity_counts["common"],
        rare_count=rarity_counts["rare"],
        epic_count=rarity_counts["epic"],
        completion_percentage=round(earned_count / total * 100, 1) if total > 0 else 0.0,
        last_earned=[
            EarnedStamp(
                type=s["type"],
                module=s["module"],
                name=s["name"],
                description=s["description"],
                icon=s["icon"],
                rarity=s["rarity"],
                earned_at=s["earned_at"],
                progress=s.get("progress", 1),
            )
            for s in last_5
        ],
    )


@router.get("/stamps", response_model=list[EarnedStamp])
def list_earned_stamps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取所有已获得印章（含未获得的完整列表）"""
    all_earned = compute_all_earned_stamps(current_user.id, db, compute_read_stamps=True)

    return [
        EarnedStamp(
            type=s["type"],
            module=s["module"],
            name=s["name"],
            description=s["description"],
            icon=s["icon"],
            rarity=s["rarity"],
            earned_at=s["earned_at"],
            progress=s.get("progress", 1),
        )
        for s in all_earned
    ]


@router.post("/earn", response_model=StampEarnResponse)
def trigger_earn_stamp(
    stamp_type: str = "",
    module: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    手动触发印章获取（调试用）。
    仅在 mock mode 下可用。
    """
    from app.config import MOCK_MODE
    if not MOCK_MODE:
        return StampEarnResponse(earned=False)

    if not stamp_type or not module:
        return StampEarnResponse(earned=False)

    config = get_stamp_config(stamp_type)
    if not config:
        return StampEarnResponse(earned=False)

    newly_earned = check_and_earn_stamps(
        current_user.id, module, {"user_total_count": 1}, db
    )

    if newly_earned:
        s = newly_earned[0]
        return StampEarnResponse(
            earned=True,
            stamp=EarnedStamp(
                type=s["type"],
                module=s["module"],
                name=s["name"],
                description=s["description"],
                icon=s["icon"],
                rarity=s["rarity"],
                earned_at=s.get("earned_at", ""),
                progress=1,
            ),
            is_new=True,
        )

    return StampEarnResponse(earned=False)


# ── Passport 2.0 新增端点 ──

@router.get("/timeline", response_model=list[TimelineMilestone])
def get_timeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户探索时间轴：核心里程碑（首次识别/修复/创作/修习/首枚印章）"""
    milestones = build_timeline(current_user.id, db)
    return [
        TimelineMilestone(
            type=m["type"],
            title=m["title"],
            description=m["description"],
            date=m["date"],
            icon=m["icon"],
            module=m["module"],
        )
        for m in milestones
    ]


@router.get("/regions", response_model=list[RegionProgress])
def get_regions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户已探索的地域列表"""
    regions = get_user_regions(current_user.id, db)
    return [
        RegionProgress(
            region_code=r["region_code"],
            region_name=r["region_name"],
            unlocked_at=r["unlocked_at"],
            item_count=r.get("item_count", 0),
        )
        for r in regions
    ]


@router.get("/export", response_model=PassportExport)
def export_passport(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """导出完整护照数据（含印章、时间轴、地域进度）"""
    all_earned = compute_all_earned_stamps(current_user.id, db, compute_read_stamps=True)
    all_configs = load_stamps_config()
    timeline = build_timeline(current_user.id, db)
    regions = get_user_regions(current_user.id, db)

    total = len(all_configs)
    earned_count = len(all_earned)

    return PassportExport(
        user_name=current_user.nickname or current_user.username,
        total_stamps=total,
        earned_count=earned_count,
        completion_percentage=round(earned_count / total * 100, 1) if total > 0 else 0.0,
        stamps=[
            EarnedStamp(
                type=s["type"],
                module=s["module"],
                name=s["name"],
                description=s["description"],
                icon=s["icon"],
                rarity=s["rarity"],
                earned_at=s.get("earned_at", datetime.utcnow()),
                progress=s.get("progress", 1),
            )
            for s in all_earned
        ],
        timeline=[
            TimelineMilestone(
                type=m["type"],
                title=m["title"],
                description=m["description"],
                date=m["date"],
                icon=m["icon"],
                module=m["module"],
            )
            for m in timeline
        ],
        regions=[
            RegionProgress(
                region_code=r["region_code"],
                region_name=r["region_name"],
                unlocked_at=r["unlocked_at"],
                item_count=r.get("item_count", 0),
            )
            for r in regions
        ],
        exported_at=datetime.utcnow(),
    )


@router.get("/config")
def get_passport_config(
    current_user: User = Depends(get_current_user),
):
    """返回 stamps.json 完整配置（供前端动态渲染）"""
    return {"stamps": load_stamps_config()}


@router.post("/regions/track")
def track_region_visit(
    region_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录用户对某个省份的探索（由知识图谱/展厅页面触发）"""
    from app.services.passport_service import track_region
    is_new = track_region(current_user.id, region_code, db)
    return {"region_code": region_code, "is_new": is_new}
