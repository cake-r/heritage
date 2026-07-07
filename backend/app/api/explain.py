"""XAI 可解释 API — 推理路径可视化（诚实版决策树）

核心理念：不做假推理决策树，诚实标注为「结果分解」。
Qwen-VL 是一次性调用返回所有信息，不存在真实推理步骤。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.models.database import get_db
from app.models.user import User
from app.models.recognition import RecognitionRecord
from app.models.restoration import RestorationRecord
from app.schemas.xai import TraceResponse
from app.services.agent.xai import build_recognition_trace, build_restoration_trace
from app.utils.exceptions import AppException

logger = logging.getLogger("explain_api")

router = APIRouter(prefix="/api/explain", tags=["XAI 可解释"])


@router.get("/recognition/{record_id}/trace", response_model=TraceResponse)
def get_recognition_trace(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取识别记录的结果分解树

    将 Qwen-VL 一次性输出的多维度结果拆解为树形结构：
      品类判定 → 置信度判定 → 特征识别 → 纹样检测 → 文化解读 → 视觉描述

    每个节点标注来源类型（computed/model-output/retrieved/rule-based）。
    """
    record = db.query(RecognitionRecord).filter(
        RecognitionRecord.id == record_id,
        RecognitionRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise AppException("识别记录不存在", code=404)

    return build_recognition_trace(record)


@router.get("/restoration/{record_id}/trace", response_model=TraceResponse)
def get_restoration_trace(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取修复记录的结果分解树

    按流水线步骤拆解：
      Step 1 损伤分析 → Step 2 修复方案 → Step 3 图像修复 → Step 4 修复验证

    每个节点标注来源类型和置信度。
    """
    record = db.query(RestorationRecord).filter(
        RestorationRecord.id == record_id,
        RestorationRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise AppException("识别记录不存在", code=404)

    return build_restoration_trace(record)
