"""人机协同修复工作台 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel, Field


# ============================================================
# Damage Region (bbox)
# ============================================================

class DamageRegion(BaseModel):
    """单个损伤区域的包围盒"""
    x: int = Field(..., description="左上角 X 坐标 (像素)")
    y: int = Field(..., description="左上角 Y 坐标 (像素)")
    width: int = Field(..., description="区域宽度 (像素)")
    height: int = Field(..., description="区域高度 (像素)")
    description: str = Field("", description="该区域损伤描述")
    severity: str = Field("轻度", description="该区域损伤程度: 轻度/中度/重度")


# ============================================================
# Damage Detect
# ============================================================

class DamageDetectResponse(BaseModel):
    """POST /damage-detect 响应 — AI 损伤预检"""
    category: str = Field(..., description="文物类别")
    damage_types: list[str] = Field(default_factory=list, description="损伤类型列表")
    severity: str = Field("轻度", description="整体损伤程度")
    description: str = Field("", description="详细损伤分析文本")
    damage_regions: list[DamageRegion] = Field(default_factory=list, description="损伤区域包围盒列表")
    image_url: str = Field("", description="上传后图片的访问 URL")


# ============================================================
# Local Inpaint
# ============================================================

class LocalInpaintRequest(BaseModel):
    """POST /local-inpaint 请求 — 局部修复"""
    image_path: str = Field(..., description="原图路径 (服务器本地路径或 /static/ 相对路径)")
    x: int = Field(..., description="裁剪区域 X 坐标")
    y: int = Field(..., description="裁剪区域 Y 坐标")
    width: int = Field(..., description="裁剪区域宽度")
    height: int = Field(..., description="裁剪区域高度")
    tool_type: str = Field("stain_brush", description="工具类型: stain_brush / color_palette")
    prompt_hint: str | None = Field(None, description="用户对修复的额外描述提示")
    feather_radius: int = Field(10, description="边缘羽化半径 (像素, 用于 seamlessClone)")


class LocalInpaintResponse(BaseModel):
    """POST /local-inpaint 响应"""
    restored_image_url: str = Field(..., description="完整修复后图片 URL")
    crop_restored_url: str = Field(..., description="裁剪区域单独修复结果 URL")
    region: DamageRegion = Field(..., description="实际修复区域信息")


# ============================================================
# Restoration Archive
# ============================================================

class ArchiveOperation(BaseModel):
    """单次修复操作记录"""
    tool: str = Field(..., description="工具: stain_brush / pattern_library / color_palette / line_pen")
    params: dict = Field(default_factory=dict, description="操作参数 (坐标、纹样ID等)")
    before_url: str = Field("", description="操作前截图")
    after_url: str = Field("", description="操作后截图")
    timestamp: str = Field("", description="ISO 时间戳")


class ArchiveRequest(BaseModel):
    """POST /archive 请求 — 保存修复档案"""
    original_image_path: str = Field(..., description="原始图片路径")
    damage_report_json: str | None = Field(None, description="AI 损伤检测结果 JSON")
    operations: list[ArchiveOperation] = Field(default_factory=list, description="修复操作序列")
    ai_assist_ratio: float = Field(0.0, ge=0.0, le=1.0, description="AI 辅助占比")
    final_image_path: str = Field("", description="最终修复图路径")
    verification_json: str | None = Field(None, description="AI 验收打分 JSON")


class ArchiveResponse(BaseModel):
    """GET /archive/{id} 响应"""
    id: int
    user_id: int
    original_image_url: str
    damage_report: dict | None = None
    operations: list[ArchiveOperation] = Field(default_factory=list)
    ai_assist_ratio: float = 0.0
    final_image_url: str | None = None
    verification: dict | None = None
    export_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ArchiveListItem(BaseModel):
    """档案列表项"""
    id: int
    original_image_url: str
    final_image_url: str | None = None
    ai_assist_ratio: float = 0.0
    export_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
