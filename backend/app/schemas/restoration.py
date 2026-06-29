"""文物修复相关 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel


class DamageAnalysis(BaseModel):
    """Step 1 输出: 损伤分析"""
    category: str
    damage_types: list[str]
    severity: str
    description: str


class RestorationPromptResult(BaseModel):
    """Step 2 输出: 修复方案"""
    prompt: str


class ImageRestorationResult(BaseModel):
    """Step 3 输出: 图像修复"""
    images: list[str]
    seed: int


class VerificationDimensions(BaseModel):
    """Step 4 评估维度"""
    detail_fidelity: int = 0       # 细节保真度
    style_consistency: int = 0     # 风格一致性
    restoration_completeness: int = 0  # 损伤修复完整度


class VerificationReport(BaseModel):
    """Step 4 输出: 修复验证"""
    overall_score: int
    dimensions: VerificationDimensions
    verdict: str
    artifacts: list[str] = []


class PipelineStep(BaseModel):
    """管道步骤"""
    step: int
    name: str
    model: str
    status: str  # completed / failed
    result: dict | None = None


class RestorationResponse(BaseModel):
    """POST /upload 响应"""
    id: int
    original_image_url: str
    restored_image_url: str | None = None
    pipeline_steps: list[PipelineStep]
    created_at: datetime

    model_config = {"from_attributes": True}


class RestorationListItem(BaseModel):
    """GET /history 列表项"""
    id: int
    original_image_url: str
    restored_image_url: str | None = None
    damage_category: str | None = None
    verification_score: int | None = None
    pipeline_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
