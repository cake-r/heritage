"""知识库扩充 — API 端点

POST   /api/expansion/expand          — 启动扩充 (fire-and-forget)
GET    /api/expansion/status/{task_id} — 查询任务进度
GET    /api/expansion/queue            — 待审核列表
GET    /api/expansion/queue/{id}       — 单项详情
PUT    /api/expansion/queue/{id}       — 编辑待审核项
POST   /api/expansion/queue/{id}/images  — 替换审核项图片
POST   /api/expansion/queue/{id}/approve — 审批通过 → INSERT heritage_items
POST   /api/expansion/queue/{id}/reject  — 拒绝
"""

import json
import logging
import os
import random
import threading
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import IMAGE_DIR
from app.models.database import get_db, SessionLocal
from app.models.user import User
from app.models.exhibition import HeritageItem
from app.models.expansion import ExpansionQueue
from app.schemas.expansion import (
    ExpandRequest,
    ExpandResponse,
    TaskStatusResponse,
    ExpansionQueueItem,
    ExpansionQueueUpdate,
    ReviewAction,
    PaginatedResponse,
    TechniqueItem,
    InheritorItem,
)
from app.services.scraper import (
    search_360_items,
    search_360_images,
    download_image,
    get_existing_names,
    _delay,
    IMAGE_DIR,
)
from app.services.ai.llm import chat

logger = logging.getLogger("expansion_api")
router = APIRouter()

# 19 个非遗品类
CATEGORIES = [
    "刺绣", "陶瓷", "剪纸", "皮影", "木雕",
    "漆器", "织锦", "金属工艺", "年画", "泥塑",
    "玉雕", "竹编", "戏曲", "中医药", "茶文化",
    "书法", "古琴", "武术", "其他",
]

# 内存中的任务状态 (重启后丢失，仅用于进度轮询)
_task_status: dict[str, dict] = {}


def _build_queue_item(q: ExpansionQueue) -> ExpansionQueueItem:
    """将数据库模型转换为响应 Schema"""
    techniques = []
    if q.techniques_json:
        try:
            techniques = [TechniqueItem(**t) for t in json.loads(q.techniques_json)]
        except (json.JSONDecodeError, TypeError):
            pass

    inheritors = []
    if q.inheritors_json:
        try:
            inheritors = [InheritorItem(**t) for t in json.loads(q.inheritors_json)]
        except (json.JSONDecodeError, TypeError):
            pass

    images = []
    if q.images_json:
        try:
            images = json.loads(q.images_json)
        except (json.JSONDecodeError, TypeError):
            pass

    source_urls = []
    if q.source_urls_json:
        try:
            source_urls = json.loads(q.source_urls_json)
        except (json.JSONDecodeError, TypeError):
            pass

    return ExpansionQueueItem(
        id=q.id,
        status=q.status,
        name=q.name,
        category=q.category,
        region=q.region,
        era=q.era,
        description=q.description,
        techniques=techniques,
        inheritors=inheritors,
        images=images,
        cultural_meaning=q.cultural_meaning,
        search_keyword=q.search_keyword,
        source_urls=source_urls,
        created_at=q.created_at,
    )


def _structure_with_llm(raw_info: dict, preferences: dict | None = None) -> dict | None:
    """使用 DeepSeek 将搜索到的原始信息结构化为 HeritageItem 格式

    Args:
        raw_info: 搜索结果原始信息 {keyword, name, snippet}
        preferences: 用户偏好 {regions, eras, keywords}，用于指导 LLM 输出
    """
    pref_note = ""
    if preferences:
        parts = []
        if preferences.get("regions"):
            parts.append(f"- 用户偏好地域: {', '.join(preferences['regions'])}，请优先返回该地域的非遗项目")
        if preferences.get("eras"):
            parts.append(f"- 用户偏好年代: {', '.join(preferences['eras'])}，请优先返回该年代起源的项目")
        if preferences.get("keywords"):
            parts.append(f"- 用户关注关键词: {', '.join(preferences['keywords'])}，请围绕该主题展开")
        if parts:
            pref_note = "\n用户偏好指引:\n" + "\n".join(parts) + "\n"

    prompt = f"""你是中国非物质文化遗产研究专家。请根据以下搜索结果，为这项非遗项目补全结构化信息。
请务必详尽深入地填写工艺技法和传承人信息，这是本次任务的核心关注点。

搜索关键词: {raw_info.get('keyword', '')}
搜索摘要: {raw_info.get('snippet', '')}
候选名称: {raw_info.get('name', '')}
{pref_note}
请严格按 JSON 格式返回（不要加```json标记，直接返回纯JSON）:
{{
  "name": "非遗项目准确全称",
  "category": "所属品类(必须从以下19个中选择最匹配的一个: {', '.join(CATEGORIES)})",
  "region": "发源地/主要流传地区(省市格式, 如'江苏苏州')",
  "era": "起源朝代或时期(如'宋代'、'明代'、'春秋战国')",
  "description": "150-250字的简介，包含历史背景和艺术特色",
  "techniques": [
    {{
      "name": "核心技法名称",
      "desc": "技法详细说明(40-80字)，包含工艺步骤、使用工具、技术难点、与其他技法的区别"
    }}
  ],
  "inheritors": [
    {{
      "name": "代表性传承人姓名",
      "title": "称号(如'国家级非遗传承人'、'省级工艺美术大师')",
      "desc": "传承人详细介绍(50-100字)，包含师承关系、代表作品、获奖情况、对传承发展的贡献"
    }}
  ],
  "cultural_meaning": "80-150字的文化寓意说明"
}}

要求:
1. 所有信息必须真实准确，不要编造；如搜索结果信息不足，基于专业知识库充分补充
2. 技法信息和传承人信息请尽可能详尽，不要简单堆砌名称，要有实质性内容
3. techniques 至少3个，每个技法的 desc 必须详细（40-80字），说明工艺特征和技术价值
4. inheritors 至少2个，每位传承人的 desc 必须详实（50-100字），包含师承渊源和代表成就
5. 确保 category 严格匹配上述19个品类之一
6. 技法和传承人是本次扩充的核心内容，请投入最多精力确保质量"""

    messages = [{"role": "user", "content": prompt}]
    try:
        text = chat(messages)
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"LLM structured JSON parse error: {e}")
        return None
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        return None


def _expand_task(task_id: str, count: int, categories: list[str] | None, preferences: dict | None = None):
    """后台任务: 搜索 + 结构化 + 写入 expansion_queue

    Args:
        task_id: 任务ID
        count: 目标扩充数量
        categories: 指定品类列表
        preferences: 用户偏好 {regions, eras, keywords}，用于引导搜索方向
    """
    db = SessionLocal()
    try:
        existing_names = get_existing_names()
        # 同时排除已在 expansion_queue 中的名称
        queue_names = {q.name.lower().strip() for q in db.query(ExpansionQueue.name).all()}
        existing_names |= queue_names

        search_categories = categories or CATEGORIES.copy()
        random.shuffle(search_categories)

        # 构建偏好信息
        pref_keywords = preferences.get("keywords", []) if preferences else []
        pref_regions = preferences.get("regions", []) if preferences else []
        pref_eras = preferences.get("eras", []) if preferences else []

        # 构建搜索关键词列表
        search_queries = []

        # 策略1: 用户提供了自定义关键词 → 精确搜索
        if pref_keywords:
            for kw in pref_keywords:
                search_queries.append(f"{kw} 非物质文化遗产 中国传统技艺")
                # 如果有地域偏好，组合搜索
                for region in pref_regions[:2]:  # 限制组合数量
                    search_queries.append(f"{kw} {region} 非物质文化遗产")
        # 策略2: 品类+地域组合搜索
        elif pref_regions:
            for cat in search_categories[:10]:
                for region in pref_regions[:3]:
                    search_queries.append(f"{cat} {region} 非物质文化遗产")
        # 策略3: 品类+年代组合搜索
        elif pref_eras:
            for cat in search_categories[:10]:
                for era in pref_eras[:3]:
                    search_queries.append(f"{cat} {era} 非物质文化遗产")
        # 策略4: 纯品类搜索（现有行为，兜底）
        else:
            search_queries = [f"{cat} 非物质文化遗产 中国传统技艺" for cat in search_categories]

        random.shuffle(search_queries)

        found = 0
        query_idx = 0

        while found < count and query_idx < len(search_queries):
            keyword = search_queries[query_idx]
            query_idx += 1

            # 提取品类名（用于进度显示）
            display_category = "自定义搜索"
            for cat in CATEGORIES:
                if cat in keyword:
                    display_category = cat
                    break
            if not pref_keywords and any(r in keyword for r in (pref_regions or [])):
                display_category = keyword.split(" ")[0] if " " in keyword else display_category

            _task_status[task_id] = {
                "status": "running",
                "total": count,
                "completed": found,
                "items_found": found,
                "current_category": display_category,
            }

            logger.info(f"[{task_id}] 搜索: {keyword[:60]}... ({found+1}/{count})")

            _delay(1.0, 2.0)
            search_results = search_360_items(keyword, count=5)

            if not search_results:
                continue

            import re as _re
            for result in search_results:
                if found >= count:
                    break

                name = _re.sub(r"<[^>]+>", "", result.get("title", ""))
                name = _re.sub(r"[（(].*?[）)]", "", name)
                name = name.strip()

                if len(name) < 2 or len(name) > 50:
                    continue
                if name.lower() in existing_names:
                    continue

                # LLM 结构化
                raw_info = {
                    "keyword": keyword,
                    "name": result.get("title", ""),
                    "snippet": result.get("snippet", ""),
                }
                # 传入偏好信息，引导 LLM 输出
                llm_prefs = {}
                if pref_regions:
                    llm_prefs["regions"] = pref_regions
                if pref_eras:
                    llm_prefs["eras"] = pref_eras
                if pref_keywords:
                    llm_prefs["keywords"] = pref_keywords
                structured = _structure_with_llm(raw_info, llm_prefs if llm_prefs else None)

                if not structured or not structured.get("name"):
                    continue

                # 验证品类
                cat = structured.get("category", display_category if display_category != "自定义搜索" else "其他")
                if cat not in CATEGORIES:
                    for c in CATEGORIES:
                        if c in cat or cat in c:
                            cat = c
                            break
                    else:
                        cat = "其他"

                # 去重（LLM 返回的名字可能与搜索结果不同）
                final_name = structured.get("name", name)
                if final_name.lower().strip() in existing_names:
                    continue

                # 搜索图片
                _delay(1.0, 2.0)
                img_urls = search_360_images(final_name, count=3)

                # 下载图片
                saved_images = []
                for i, img_url in enumerate(img_urls):
                    safe = _re.sub(r"[^\w一-鿿]", "_", final_name)[:30]
                    filename = f"expansion_{safe}_{i+1}_{uuid.uuid4().hex[:6]}.jpg"
                    save_path = IMAGE_DIR / filename

                    _delay(0.5, 1.0)
                    if download_image(img_url, save_path):
                        saved_images.append(f"/static/images/{filename}")

                # 写入 expansion_queue
                q = ExpansionQueue(
                    status="pending",
                    name=final_name,
                    category=cat,
                    region=structured.get("region", ""),
                    era=structured.get("era", ""),
                    description=structured.get("description", ""),
                    techniques_json=json.dumps(structured.get("techniques", []), ensure_ascii=False),
                    inheritors_json=json.dumps(structured.get("inheritors", []), ensure_ascii=False),
                    images_json=json.dumps(saved_images, ensure_ascii=False),
                    cultural_meaning=structured.get("cultural_meaning", ""),
                    search_keyword=keyword,
                    source_urls_json=json.dumps([result.get("url", "")] if result.get("url") else [], ensure_ascii=False),
                )
                db.add(q)
                db.commit()

                existing_names.add(final_name.lower().strip())
                found += 1
                _task_status[task_id] = {
                    "status": "running",
                    "total": count,
                    "completed": found,
                    "items_found": found,
                }
                logger.info(f"[{task_id}] 找到: {final_name} ({cat}) [{found}/{count}]")

        # 完成
        _task_status[task_id] = {
            "status": "completed",
            "total": count,
            "completed": found,
            "items_found": found,
        }
        logger.info(f"[{task_id}] 任务完成: {found}/{count}")

    except Exception as e:
        logger.error(f"[{task_id}] 任务失败: {e}")
        db.rollback()
        _task_status[task_id] = {
            "status": "failed",
            "total": count,
            "completed": _task_status.get(task_id, {}).get("completed", 0),
            "items_found": _task_status.get(task_id, {}).get("items_found", 0),
            "error": str(e),
        }
    finally:
        db.close()


# === API Endpoints ===

@router.post("/expand", response_model=ExpandResponse)
def start_expansion(
    req: ExpandRequest,
    current_user: User = Depends(get_current_user),
):
    """启动知识库扩充任务 (后台异步执行)

    支持偏好输入：
    - categories: 品类偏好
    - regions: 地域偏好
    - eras: 年代偏好
    - keywords: 自定义搜索关键词
    所有偏好均为可选，不填则自动随机扩充
    """
    # 检查是否有正在运行的任务
    for tid, status in _task_status.items():
        if status.get("status") == "running":
            return ExpandResponse(
                task_id=tid,
                message="已有扩充任务正在进行中",
            )

    task_id = uuid.uuid4().hex[:12]
    _task_status[task_id] = {"status": "running", "total": req.count, "completed": 0, "items_found": 0}

    # 构建偏好 dict
    preferences = {}
    if req.regions:
        preferences["regions"] = req.regions
    if req.eras:
        preferences["eras"] = req.eras
    if req.keywords:
        preferences["keywords"] = req.keywords

    # 后台线程执行
    thread = threading.Thread(
        target=_expand_task,
        args=(task_id, req.count, req.categories, preferences if preferences else None),
        daemon=True,
    )
    thread.start()

    return ExpandResponse(
        task_id=task_id,
        message=f"扩充任务已启动，目标 {req.count} 个项目",
    )


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
def get_task_status(task_id: str):
    """查询扩充任务进度"""
    status = _task_status.get(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="任务不存在")
    return TaskStatusResponse(
        task_id=task_id,
        status=status.get("status", "unknown"),
        total=status.get("total", 0),
        completed=status.get("completed", 0),
        items_found=status.get("items_found", 0),
        error=status.get("error"),
    )


@router.get("/queue", response_model=PaginatedResponse)
def get_expansion_queue(
    status: str = Query(default="pending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取待审核列表"""
    q = db.query(ExpansionQueue).filter(ExpansionQueue.status == status)
    total = q.count()
    items = q.order_by(ExpansionQueue.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return PaginatedResponse(
        items=[_build_queue_item(item) for item in items],
        total=total,
        page=page,
        pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/queue/{item_id}", response_model=ExpansionQueueItem)
def get_queue_item(item_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取单个待审核项详情"""
    item = db.query(ExpansionQueue).filter(ExpansionQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _build_queue_item(item)


@router.put("/queue/{item_id}", response_model=ExpansionQueueItem)
def update_queue_item(
    item_id: int,
    data: ExpansionQueueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """编辑待审核项 (审批前修改)"""
    item = db.query(ExpansionQueue).filter(ExpansionQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="项目不存在")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="只能编辑待审核的项目")

    update_data = data.model_dump(exclude_unset=True)
    if "techniques" in update_data and update_data["techniques"] is not None:
        item.techniques_json = json.dumps(
            [t.model_dump() if hasattr(t, 'model_dump') else t for t in update_data.pop("techniques")],
            ensure_ascii=False,
        )
    if "inheritors" in update_data and update_data["inheritors"] is not None:
        item.inheritors_json = json.dumps(
            [t.model_dump() if hasattr(t, 'model_dump') else t for t in update_data.pop("inheritors")],
            ensure_ascii=False,
        )

    for key, val in update_data.items():
        if hasattr(item, key):
            setattr(item, key, val)

    db.commit()
    db.refresh(item)
    return _build_queue_item(item)


@router.post("/queue/{item_id}/approve")
def approve_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """审批通过 → 插入 heritage_items 表 (自动同步到知识图谱和展览馆)"""
    item = db.query(ExpansionQueue).filter(ExpansionQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="项目不存在")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="该项目已处理")

    # 插入 heritage_items
    heritage = HeritageItem(
        name=item.name,
        category=item.category,
        region=item.region,
        era=item.era,
        description=item.description,
        techniques_json=item.techniques_json,
        inheritors_json=item.inheritors_json,
        images_json=item.images_json,
        cultural_meaning=item.cultural_meaning,
    )
    db.add(heritage)

    # 更新队列状态
    item.status = "approved"
    item.reviewed_by = current_user.id
    item.reviewed_at = datetime.utcnow()

    db.commit()
    return {"message": f"已上架: {item.name}", "heritage_id": heritage.id}


@router.post("/queue/{item_id}/reject")
def reject_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """拒绝 — 标记为 rejected，不插入 heritage_items"""
    item = db.query(ExpansionQueue).filter(ExpansionQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="项目不存在")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="该项目已处理")

    item.status = "rejected"
    item.reviewed_by = current_user.id
    item.reviewed_at = datetime.utcnow()
    db.commit()

    return {"message": f"已拒绝: {item.name}"}


@router.post("/queue/{item_id}/images")
async def upload_queue_images(
    item_id: int,
    images: list[UploadFile] = File(..., max_length=5),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """替换审核项的图片 — 上传新图片替换所有现有图片"""
    item = db.query(ExpansionQueue).filter(ExpansionQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="项目不存在")
    if item.status != "pending":
        raise HTTPException(status_code=400, detail="只能编辑待审核的项目")

    saved = []
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for img in images:
        # 验证格式
        ext = os.path.splitext(img.filename or "")[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            continue
        # 保存
        filename = f"expansion_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = IMAGE_DIR / filename
        content = await img.read()
        if len(content) < 1000:
            continue
        filepath.write_bytes(content)
        saved.append(f"/static/images/{filename}")

    if saved:
        item.images_json = json.dumps(saved, ensure_ascii=False)
        db.commit()

    return {"images": saved, "message": f"已更新 {len(saved)} 张图片"}
