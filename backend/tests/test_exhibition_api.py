"""展厅API测试"""

import uuid
import pytest
from io import BytesIO
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    db = SessionLocal()
    from app.models.user import User
    from app.models.exhibition import UserUpload
    db.query(UserUpload).delete()
    db.query(User).filter(User.username.like("test_%")).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header(client):
    """注册用户并返回 Authorization header"""
    username = f"test_{uuid.uuid4().hex[:8]}"
    resp = client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# === 展厅藏品列表 ===

def test_get_exhibition_items(client):
    """获取藏品列表 — 默认分页"""
    resp = client.get("/api/exhibition/items")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pages" in data
    assert isinstance(data["items"], list)


def test_get_exhibition_items_with_category_filter(client):
    """按品类筛选"""
    resp = client.get("/api/exhibition/items?category=刺绣")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["category"] == "刺绣"


def test_get_exhibition_items_with_region_filter(client):
    """按地区筛选"""
    resp = client.get("/api/exhibition/items?region=江苏")
    assert resp.status_code == 200


def test_get_exhibition_items_with_era_filter(client):
    """按年代筛选"""
    resp = client.get("/api/exhibition/items?era=唐")
    assert resp.status_code == 200


def test_get_exhibition_items_with_search(client):
    """关键词搜索"""
    resp = client.get("/api/exhibition/items?search=苏绣")
    assert resp.status_code == 200


def test_get_exhibition_items_pagination(client):
    """分页参数"""
    resp = client.get("/api/exhibition/items?page=1&page_size=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert len(data["items"]) <= 5


# === 藏品详情 ===

def test_get_exhibition_item_detail(client):
    """获取藏品详情"""
    # 先获取列表拿到一个真实 id
    resp = client.get("/api/exhibition/items?page_size=1")
    items = resp.json()["items"]
    if items:
        item_id = items[0]["id"]
        resp = client.get(f"/api/exhibition/items/{item_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == item_id
        assert "name" in data
        assert "techniques" in data
        assert "images" in data


def test_get_exhibition_item_not_found(client):
    """藏品不存在"""
    resp = client.get("/api/exhibition/items/99999")
    assert resp.status_code == 404


# === 品类列表 ===

def test_get_categories(client):
    """获取品类列表"""
    resp = client.get("/api/exhibition/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# === 用户上传作品 ===

def test_user_upload_requires_auth(client):
    """上传需要登录"""
    resp = client.post("/api/exhibition/uploads", data={
        "title": "测试",
    })
    assert resp.status_code == 401


def test_user_upload_success(client, auth_header):
    """上传作品成功"""
    # 创建一个假的图片文件
    from PIL import Image
    img = Image.new("RGB", (400, 300), color="red")
    buf = BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)

    resp = client.post(
        "/api/exhibition/uploads",
        files={"images": ("test.jpg", buf, "image/jpeg")},
        data={
            "title": "我的剪纸作品",
            "description": "手工剪纸",
            "category": "剪纸",
        },
        headers=auth_header,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["title"] == "我的剪纸作品"
    assert len(data["images"]) == 1
    assert data["category"] == "剪纸"


def test_user_upload_no_title(client, auth_header):
    """上传作品缺少标题"""
    resp = client.post(
        "/api/exhibition/uploads",
        data={"title": ""},
        headers=auth_header,
    )
    assert resp.status_code == 422  # validation error
