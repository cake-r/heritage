"""图片筛选替换工具 API

为审查页面提供 Bing 图片搜索 + 下载替换 + 上传替换能力。
"""

import json
import re
import subprocess
import time
import urllib.parse
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.config import UPLOAD_DIR, IMAGE_DIR

router = APIRouter(prefix="/api/tools", tags=["图片工具"])

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "uploads" / "knowledge"
HERITAGE_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "knowledge" / "heritage_sample.json"

CURL = "curl"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


class ImageResult(BaseModel):
    url: str
    index: int


class SearchResponse(BaseModel):
    query: str
    results: list[ImageResult]


class ReplaceRequest(BaseModel):
    heritage_name: str
    image_url: str


class ReplaceResponse(BaseModel):
    success: bool
    filename: str
    path: str
    size_kb: float


@router.get("/search-images", response_model=SearchResponse)
def search_images(q: str = Query(..., description="搜索关键词")):
    """搜索 Bing 图片，返回候选 URL 列表"""
    query = urllib.parse.quote(f"{q} 非遗 中国传统文化")
    url = f"https://cn.bing.com/images/search?q={query}&first=1&count=20"

    try:
        result = subprocess.run(
            [CURL, "-s", "-L", "--compressed", "--max-time", "15",
             "-H", f"User-Agent: {UA}",
             "-H", "Accept: text/html,application/xhtml+xml",
             "-H", "Accept-Language: zh-CN,zh;q=0.9",
             url],
            capture_output=True, timeout=20
        )
        html = result.stdout.decode("utf-8", errors="ignore")
    except Exception as e:
        raise HTTPException(500, f"搜索失败: {e}")

    # 提取图片 URL
    raw_urls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', html)
    seen = set()
    results = []
    for u in raw_urls:
        u = u.replace("\\u002f", "/")
        if u in seen:
            continue
        if not any(u.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]):
            continue
        seen.add(u)
        results.append(ImageResult(url=u, index=len(results)))
        if len(results) >= 12:
            break

    return SearchResponse(query=q, results=results)


@router.post("/replace-image", response_model=ReplaceResponse)
def replace_image(req: ReplaceRequest):
    """下载图片并替换指定非遗项的图片"""
    safe_name = re.sub(r"[^\w一-鿿]", "_", req.heritage_name)[:50]
    filename = f"{safe_name}_1.jpg"
    save_path = KNOWLEDGE_DIR / filename

    # 下载
    try:
        result = subprocess.run(
            [CURL, "-s", "-L", "-o", str(save_path), "--max-time", "25",
             "-H", f"User-Agent: {UA}",
             "-H", "Referer: https://cn.bing.com/",
             req.image_url],
            capture_output=True, timeout=30
        )
    except Exception as e:
        raise HTTPException(500, f"下载失败: {e}")

    if not save_path.exists() or save_path.stat().st_size < 5000:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(400, "下载失败：图片过小或无效")

    size_kb = save_path.stat().st_size / 1024

    # 更新 JSON
    try:
        with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
            items = json.load(f)

        for item in items:
            if item["name"] == req.heritage_name:
                item["images"] = [f"/static/knowledge/{filename}"]
                break

        with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(500, f"更新JSON失败: {e}")

    # 同步更新数据库
    try:
        from app.models.database import SessionLocal
        from app.models.exhibition import HeritageItem

        db = SessionLocal()
        db_item = db.query(HeritageItem).filter(HeritageItem.name == req.heritage_name).first()
        if db_item:
            db_item.images_json = json.dumps([f"/static/knowledge/{filename}"], ensure_ascii=False)
            db.commit()
        db.close()
    except Exception:
        pass  # DB update is best-effort

    return ReplaceResponse(
        success=True,
        filename=filename,
        path=f"/static/knowledge/{filename}",
        size_kb=round(size_kb, 1),
    )


@router.post("/upload-replace", response_model=ReplaceResponse)
def upload_replace(
    file: UploadFile = File(...),
    name: str = Form(...),
):
    """上传本地图片替换指定非遗项的图片"""
    # 校验文件
    if not file.filename:
        raise HTTPException(400, "未选择文件")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(400, f"不支持的格式: {ext}，仅支持 jpg/png/webp")

    # 校验大小
    content = file.file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "文件不能超过 10MB")
    if len(content) < 2000:
        raise HTTPException(400, "图片太小")

    # 校验是否为有效图片
    if content[:3] != b"\xff\xd8\xff" and content[:4] != b"\x89PNG" and content[:4] != b"RIFF":
        raise HTTPException(400, "不是有效的图片文件")

    # 保存
    safe_name = re.sub(r"[^\w一-鿿]", "_", name)[:50]
    filename = f"{safe_name}_1.jpg"
    save_path = KNOWLEDGE_DIR / filename
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # 如果是 PNG/WebP，统一转存 (文件名保留 .jpg，实际内容按原格式)
    # 简单方案：保留原始扩展名
    orig_ext = ext if ext in (".jpg", ".jpeg") else ".jpg"
    filename = f"{safe_name}_1{orig_ext}"
    save_path = KNOWLEDGE_DIR / filename

    save_path.write_bytes(content)
    size_kb = len(content) / 1024
    url_path = f"/static/knowledge/{filename}"

    # 更新 JSON
    try:
        with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            if item["name"] == name:
                item["images"] = [url_path]
                break
        with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(500, f"更新JSON失败: {e}")

    # 更新数据库
    try:
        from app.models.database import SessionLocal
        from app.models.exhibition import HeritageItem
        db = SessionLocal()
        db_item = db.query(HeritageItem).filter(HeritageItem.name == name).first()
        if db_item:
            db_item.images_json = json.dumps([url_path], ensure_ascii=False)
            db.commit()
        db.close()
    except Exception:
        pass

    return ReplaceResponse(
        success=True,
        filename=filename,
        path=url_path,
        size_kb=round(size_kb, 1),
    )


@router.post("/replace-image")
async def replace_db_image(
    file: UploadFile = File(...),
    item_id: int = Form(...),
):
    """上传本地图片替换指定非遗项图片 (直接操作 DB)"""
    import json as _json

    # 校验文件
    if not file.filename:
        raise HTTPException(400, "未选择文件")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(400, f"不支持的格式: {ext}，仅支持 jpg/png/webp")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "文件不能超过 10MB")
    if len(content) < 2000:
        raise HTTPException(400, "图片太小")

    # 校验有效图片
    if not (content[:3] == b"\xff\xd8\xff" or content[:4] == b"\x89PNG" or content[:4] == b"RIFF" or content[:3] == b"GIF"):
        raise HTTPException(400, "不是有效的图片文件")

    # 保存到 IMAGE_DIR
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"replaced_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
    save_path = IMAGE_DIR / filename
    save_path.write_bytes(content)
    size_kb = len(content) / 1024
    url_path = f"images/{filename}"

    # 更新 DB
    from app.models.database import SessionLocal
    from app.models.exhibition import HeritageItem
    db = SessionLocal()
    try:
        item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
        if not item:
            raise HTTPException(404, f"未找到 ID={item_id} 的项目")

        # 追加新图片到 images_json
        existing = _json.loads(item.images_json or "[]")
        existing.append(url_path)
        item.images_json = _json.dumps(existing, ensure_ascii=False)
        db.commit()

        return {
            "success": True,
            "filename": filename,
            "path": f"/static/{url_path}",
            "size_kb": round(size_kb, 1),
            "total_images": len(existing),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"数据库更新失败: {e}")
    finally:
        db.close()


@router.post("/clear-images")
def clear_images(item_id: int = Form(...)):
    """清除指定非遗项的所有图片"""
    import json as _json
    from app.models.database import SessionLocal
    from app.models.exhibition import HeritageItem

    db = SessionLocal()
    try:
        item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
        if not item:
            raise HTTPException(404, f"未找到 ID={item_id} 的项目")
        item.images_json = _json.dumps([], ensure_ascii=False)
        db.commit()
        return {"success": True, "message": f"已清空「{item.name}」的图片"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"操作失败: {e}")
    finally:
        db.close()


@router.post("/replace-image-reset")
async def replace_db_image_reset(
    file: UploadFile = File(...),
    item_id: int = Form(...),
):
    """上传本地图片替换指定非遗项图片 (清除旧图，只保留新图)"""
    import json as _json

    if not file.filename:
        raise HTTPException(400, "未选择文件")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(400, f"不支持的格式: {ext}")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "文件不能超过 10MB")
    if len(content) < 2000:
        raise HTTPException(400, "图片太小")

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"replaced_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
    save_path = IMAGE_DIR / filename
    save_path.write_bytes(content)
    size_kb = len(content) / 1024
    url_path = f"images/{filename}"

    from app.models.database import SessionLocal
    from app.models.exhibition import HeritageItem
    db = SessionLocal()
    try:
        item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
        if not item:
            raise HTTPException(404, f"未找到 ID={item_id} 的项目")

        # 替换为仅新图
        item.images_json = _json.dumps([url_path], ensure_ascii=False)
        db.commit()

        return {
            "success": True,
            "filename": filename,
            "path": f"/static/{url_path}",
            "size_kb": round(size_kb, 1),
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"数据库更新失败: {e}")
    finally:
        db.close()
