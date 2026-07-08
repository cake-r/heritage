"""模块③扩展 自定义传承人 CRUD API"""

import json
import uuid
import logging
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.user import User
from app.models.custom_inheritor import CustomInheritor
from app.schemas.inheritor import (
    CustomInheritorCreate, CustomInheritorUpdate, CustomInheritorResponse,
    GeneratePersonaRequest, GeneratePersonaResponse,
    CategoryInfo, ToolCapabilityPreview, InheritorStats,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.api.deps import get_current_user, get_optional_user
from app.utils.exceptions import AppException, NotFoundException
from app.config import IMAGE_DIR, ALLOWED_IMAGE_FORMATS

logger = logging.getLogger("inheritor_api")
router = APIRouter(prefix="/api/inheritors", tags=["自定义传承人"])

# === 19种非遗品类目录 ===

CATALOG: list[CategoryInfo] = [
    CategoryInfo(id="suxiu", name="苏绣", icon="🧵", description="苏州刺绣，中国四大名绣之首，以精细雅洁著称"),
    CategoryInfo(id="xiangxiu", name="湘绣", icon="🧵", description="湖南刺绣，以丝绒线绣制，色彩鲜明"),
    CategoryInfo(id="shuxiu", name="蜀绣", icon="🧵", description="四川刺绣，针法丰富，以软缎和彩丝为主要原料"),
    CategoryInfo(id="yuexiu", name="粤绣", icon="🧵", description="广东刺绣，以金银线垫绣为特色，构图饱满"),
    CategoryInfo(id="jianzhi", name="剪纸", icon="✂️", description="中国最普及的民间艺术之一，以剪刀或刻刀在纸上剪刻花纹"),
    CategoryInfo(id="piying", name="皮影", icon="🎭", description="中国最古老的戏剧形式之一，用兽皮或纸板做成人物剪影"),
    CategoryInfo(id="nianhua", name="年画", icon="🖼️", description="中国民间过年时张贴的画，寄托祈福迎祥的愿望"),
    CategoryInfo(id="lanbuhua", name="蓝印花布", icon="👕", description="中国传统的印染工艺品，以蓝白相间的图案为特色"),
    CategoryInfo(id="tangsancai", name="唐三彩", icon="🏺", description="唐代彩色釉陶器的总称，以黄、褐、绿三色为主"),
    CategoryInfo(id="qinghua", name="青花瓷", icon="🏺", description="中国瓷器主流品种，以钴料在瓷胎上绘画后施釉高温烧成"),
    CategoryInfo(id="zisha", name="紫砂陶", icon="🫖", description="江苏宜兴特产，以紫砂泥制成的陶器，尤以茶壶闻名"),
    CategoryInfo(id="jingju", name="京剧脸谱", icon="🎭", description="京剧演员面部化妆的图案化造型艺术"),
    CategoryInfo(id="dunhuang", name="敦煌壁画", icon="🏛️", description="敦煌莫高窟内的佛教壁画艺术，世界文化遗产"),
    CategoryInfo(id="miaoyin", name="苗银", icon="💍", description="苗族银饰锻制技艺，国家级非物质文化遗产"),
    CategoryInfo(id="jingtailan", name="景泰蓝", icon="🏺", description="中国特有的金属工艺品，铜胎掐丝珐琅"),
    CategoryInfo(id="muban", name="木版年画", icon="🖼️", description="以木版刻制印刷的年画，以杨柳青、桃花坞等为代表"),
    CategoryInfo(id="shufa", name="书法", icon="✒️", description="中国汉字书写的传统艺术"),
    CategoryInfo(id="zhuanke", name="篆刻", icon="🔖", description="以篆书入印的印章艺术"),
    CategoryInfo(id="dongyang", name="东阳木雕", icon="🪵", description="浙江东阳的传统木雕工艺，中国四大木雕之一"),
]

MAX_CUSTOM_INHERITORS = 10


# === 辅助函数 ===

def _build_response(inheritor: CustomInheritor, truncate_persona: bool = False) -> CustomInheritorResponse:
    """将 ORM 模型转换为响应对象"""
    persona = inheritor.persona
    if truncate_persona and len(persona) > 100:
        persona = persona[:100] + "..."

    return CustomInheritorResponse(
        id=inheritor.id,
        user_id=inheritor.user_id,
        name=inheritor.name,
        category=inheritor.category,
        avatar_url=inheritor.avatar_url or "",
        persona=persona,
        greeting=inheritor.greeting,
        tools=json.loads(inheritor.tools_json) if inheritor.tools_json else [],
        domain_prompts=json.loads(inheritor.domain_prompts_json) if inheritor.domain_prompts_json else {},
        style=inheritor.style or "",
        expertise=json.loads(inheritor.expertise) if inheritor.expertise else [],
        is_public=bool(inheritor.is_public),
        created_at=inheritor.created_at,
    )


def get_inheritor_context(persona_id: str, db: Session) -> dict | None:
    """获取传承人完整上下文（供chat API使用）

    支持的 persona_id 格式:
    - "paper_cutter" 等预设角色 → 从 characters.json 加载
    - "custom:123" → 从 custom_inheritors 表加载
    """
    if persona_id.startswith("custom:"):
        try:
            inheritor_id = int(persona_id.split(":", 1)[1])
        except (ValueError, IndexError):
            return None
        inheritor = db.query(CustomInheritor).filter(CustomInheritor.id == inheritor_id).first()
        if not inheritor:
            return None
        return {
            "id": f"custom:{inheritor.id}",
            "name": inheritor.name,
            "avatar": inheritor.avatar_url,
            "system_prompt": inheritor.persona,
            "style": inheritor.style,
            "expertise": json.loads(inheritor.expertise) if inheritor.expertise else [],
            "greeting": inheritor.greeting,
            "tools": json.loads(inheritor.tools_json) if inheritor.tools_json else [],
            "domain_prompts": json.loads(inheritor.domain_prompts_json) if inheritor.domain_prompts_json else {},
            "quick_questions": [],
            "is_custom": True,
        }
    else:
        # 从 characters.json 加载预设角色
        from app.api.chat import CHARACTERS
        char = CHARACTERS.get(persona_id)
        if not char:
            return None
        return {
            **char,
            "is_custom": False,
        }


# === 品类目录 ===

@router.get("/catalog", response_model=list[CategoryInfo])
def get_catalog():
    """获取19种非遗品类目录"""
    return CATALOG


# === AI人设生成 ===

@router.post("/generate-persona", response_model=GeneratePersonaResponse)
def generate_persona(
    req: GeneratePersonaRequest,
    current_user: User = Depends(get_current_user),
):
    """LLM 根据用户输入生成完整的传承人人设"""
    from app.services.ai.llm import chat as llm_chat
    from app.services.ai.base import mock_mode

    category_name = req.category
    catalog_entry = next((c for c in CATALOG if c.id == req.category or c.name == req.category), None)
    if catalog_entry:
        category_name = catalog_entry.name

    if mock_mode():
        # Mock: 模板填充
        tool_desc_map = {
            "inspect": f"分析{category_name}作品的工艺技法，给出鉴赏意见",
            "create": f"根据用户描述生成{category_name}相关的创作内容",
            "connect": f"从知识图谱中寻找{category_name}与其他非遗品类的文化关联",
            "teach": f"为初学者设计{category_name}入门课程",
        }
        tool_descriptions = "\n".join([f"- {tid}: {tool_desc_map.get(tid, tid)}" for tid in req.selected_tools])

        return GeneratePersonaResponse(
            persona=f"你是一位{category_name}传承人，名叫{req.name}。{req.personality}。{req.bio}。\n\n"
                    f"你精通以下领域：{'、'.join(req.expertise) if req.expertise else category_name}。\n"
                    f"你具备以下能力：{'、'.join(req.selected_tools)}。",
            greeting=f"你好！我是{req.name}，一位{category_name}传承人。{req.bio}。有什么想了解的吗？",
            quick_questions=[
                f"{category_name}最核心的技法是什么？",
                f"初学者如何入门{category_name}？",
                f"你能帮我看看这件{category_name}作品怎么样？",
            ],
            style=req.personality if req.personality else f"说话专业而不失亲切，热爱{category_name}",
            suggested_avatar_prompt=f"A traditional Chinese craftsman specializing in {category_name}, "
                                  f"elderly wise master, warm expression, traditional attire, "
                                  f"studio background with tools of the trade, Chinese ink painting style, "
                                  f"soft lighting, elegant composition",
        )

    # Real mode: 调用 LLM
    prompt = f"""你是一位非遗文化专家，请根据以下信息为一位AI非遗传承人生成完整的人设：

【名称】{req.name}
【品类】{category_name}
【性格】{req.personality if req.personality else "专业、亲切、热爱非遗"}
【简介】{req.bio}
【专长】{'、'.join(req.expertise) if req.expertise else category_name}
【能力工具】{'、'.join(req.selected_tools)}

请以严格的JSON格式返回（不要包含markdown代码块标记）：
{{
    "persona": "完整的system_prompt（500-800字），用中文写，包含角色定位、知识领域、说话风格、行为准则",
    "greeting": "一句亲切的问候语（30字以内），体现角色性格",
    "quick_questions": ["问题1", "问题2", "问题3"],
    "style": "一句话描述说话风格（20字以内）",
    "suggested_avatar_prompt": "英文，用于AI生成头像的prompt，描述一位中国传统手工艺人肖像（50-100 words）"
}}

要求：
1. persona 要具体、有深度，体现出该品类的专业性
2. greeting 要自然，符合角色性格
3. quick_questions 要能引导用户深入了解该非遗品类
4. suggested_avatar_prompt 生成英文prompt，适合AI图像生成"""

    try:
        result = llm_chat([{"role": "user", "content": prompt}])
        # 清理可能的 markdown 代码块
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[1]
            if result.endswith("```"):
                result = result[:-3]
        data = json.loads(result)
        return GeneratePersonaResponse(
            persona=data.get("persona", ""),
            greeting=data.get("greeting", ""),
            quick_questions=data.get("quick_questions", [])[:3],
            style=data.get("style", ""),
            suggested_avatar_prompt=data.get("suggested_avatar_prompt", ""),
        )
    except Exception as e:
        logger.error(f"AI人设生成失败: {e}")
        raise AppException(f"人设生成失败: {e}")


# === CRUD ===

@router.post("", response_model=CustomInheritorResponse)
def create_inheritor(
    req: CustomInheritorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建自定义传承人（最多10个）"""
    count = db.query(CustomInheritor).filter(
        CustomInheritor.user_id == current_user.id
    ).count()
    if count >= MAX_CUSTOM_INHERITORS:
        raise AppException(f"最多创建{MAX_CUSTOM_INHERITORS}个自定义传承人")

    inheritor = CustomInheritor(
        user_id=current_user.id,
        name=req.name,
        category=req.category,
        avatar_url=req.avatar_url or "",
        persona=req.persona,
        greeting=req.greeting,
        tools_json=json.dumps(req.tools, ensure_ascii=False),
        domain_prompts_json=json.dumps(req.domain_prompts, ensure_ascii=False),
        style=req.style,
        expertise=json.dumps(req.expertise, ensure_ascii=False),
    )
    db.add(inheritor)
    db.commit()
    db.refresh(inheritor)

    return _build_response(inheritor)


@router.get("", response_model=list[CustomInheritorResponse])
def list_my_inheritors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的自定义传承人列表"""
    inheritors = db.query(CustomInheritor).filter(
        CustomInheritor.user_id == current_user.id
    ).order_by(desc(CustomInheritor.created_at)).all()

    return [_build_response(i, truncate_persona=True) for i in inheritors]


@router.get("/stats", response_model=InheritorStats)
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户自定义传承人统计"""
    total = db.query(CustomInheritor).filter(
        CustomInheritor.user_id == current_user.id
    ).count()
    return InheritorStats(
        total=total,
        limit=MAX_CUSTOM_INHERITORS,
        remaining=max(0, MAX_CUSTOM_INHERITORS - total),
    )


@router.get("/public", response_model=PaginatedResponse[CustomInheritorResponse])
def list_public_inheritors(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """浏览公开的自定义传承人"""
    total = db.query(CustomInheritor).filter(CustomInheritor.is_public == 1).count()

    inheritors = db.query(CustomInheritor).filter(
        CustomInheritor.is_public == 1
    ).order_by(desc(CustomInheritor.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [_build_response(i, truncate_persona=True) for i in inheritors]
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, pages=total_pages)


@router.get("/{inheritor_id}", response_model=CustomInheritorResponse)
def get_inheritor_detail(
    inheritor_id: int,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """获取传承人详情（所有者或公开可见）"""
    inheritor = db.query(CustomInheritor).filter(CustomInheritor.id == inheritor_id).first()
    if not inheritor:
        raise NotFoundException("传承人不存在")

    # 允许所有者或公开传承人
    if not inheritor.is_public and (not current_user or inheritor.user_id != current_user.id):
        raise NotFoundException("传承人不存在")

    return _build_response(inheritor)


@router.put("/{inheritor_id}", response_model=CustomInheritorResponse)
def update_inheritor(
    inheritor_id: int,
    req: CustomInheritorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """编辑自定义传承人（仅所有者）"""
    inheritor = db.query(CustomInheritor).filter(
        CustomInheritor.id == inheritor_id,
        CustomInheritor.user_id == current_user.id,
    ).first()
    if not inheritor:
        raise NotFoundException("传承人不存在")

    # 部分更新
    if req.name is not None:
        inheritor.name = req.name
    if req.persona is not None:
        inheritor.persona = req.persona
    if req.greeting is not None:
        inheritor.greeting = req.greeting
    if req.tools is not None:
        inheritor.tools_json = json.dumps(req.tools, ensure_ascii=False)
    if req.domain_prompts is not None:
        inheritor.domain_prompts_json = json.dumps(req.domain_prompts, ensure_ascii=False)
    if req.style is not None:
        inheritor.style = req.style
    if req.expertise is not None:
        inheritor.expertise = json.dumps(req.expertise, ensure_ascii=False)
    if req.is_public is not None:
        inheritor.is_public = 1 if req.is_public else 0
    if req.avatar_url is not None:
        inheritor.avatar_url = req.avatar_url

    db.commit()
    db.refresh(inheritor)
    return _build_response(inheritor)


@router.delete("/{inheritor_id}", response_model=MessageResponse)
def delete_inheritor(
    inheritor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除自定义传承人（仅所有者）"""
    inheritor = db.query(CustomInheritor).filter(
        CustomInheritor.id == inheritor_id,
        CustomInheritor.user_id == current_user.id,
    ).first()
    if not inheritor:
        raise NotFoundException("传承人不存在")

    db.delete(inheritor)
    db.commit()
    return MessageResponse(message="已删除")


# === AI头像生成 ===

@router.post("/{inheritor_id}/avatar")
def generate_avatar(
    inheritor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """为自定义传承人生成AI头像"""
    inheritor = db.query(CustomInheritor).filter(
        CustomInheritor.id == inheritor_id,
        CustomInheritor.user_id == current_user.id,
    ).first()
    if not inheritor:
        raise NotFoundException("传承人不存在")

    from app.services.ai.image_gen import text_to_image
    from app.services.ai.base import mock_mode

    # 构建头像prompt
    category_name = inheritor.category
    catalog_entry = next((c for c in CATALOG if c.id == inheritor.category or c.name == inheritor.category), None)
    if catalog_entry:
        category_name = catalog_entry.name

    if mock_mode():
        avatar_url = "/static/images/placeholder.png"
    else:
        avatar_prompt = (
            f"A traditional Chinese craftsman specializing in {category_name}, "
            f"elderly master with wisdom and warmth, traditional Chinese attire, "
            f"serene studio setting with tools of the trade, "
            f"Chinese ink painting aesthetic, soft natural lighting, "
            f"portrait style, elegant and dignified, vertical composition"
        )
        result = text_to_image(prompt=avatar_prompt, count=1)
        avatar_url = result["images"][0] if result.get("images") else "/static/images/placeholder.png"

    inheritor.avatar_url = avatar_url
    db.commit()

    return {"avatar_url": avatar_url}
