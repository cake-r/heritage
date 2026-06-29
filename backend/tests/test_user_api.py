"""用户中心API测试"""

import uuid
import pytest
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
    from app.models.favorite import Favorite
    from app.models.generation import GeneratedWork
    from app.models.recognition import RecognitionRecord
    from app.models.chat import ChatSession
    db.query(Favorite).delete()
    db.query(UserUpload).delete()
    db.query(GeneratedWork).delete()
    db.query(RecognitionRecord).delete()
    db.query(ChatSession).delete()
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


# === 个人资料 ===

def test_get_profile_requires_auth(client):
    """未登录不能获取资料"""
    resp = client.get("/api/user/profile")
    assert resp.status_code == 401


def test_get_profile(client, auth_header):
    """获取个人资料"""
    resp = client.get("/api/user/profile", headers=auth_header)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    assert "username" in data
    assert "nickname" in data


def test_update_profile(client, auth_header):
    """更新个人资料"""
    resp = client.put(
        "/api/user/profile",
        json={"nickname": "新昵称"},
        headers=auth_header,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["nickname"] == "新昵称"

    # 验证持久化
    resp2 = client.get("/api/user/profile", headers=auth_header)
    assert resp2.json()["nickname"] == "新昵称"


# === 收藏 ===

def test_add_favorite_requires_auth(client):
    """收藏需要登录"""
    resp = client.post("/api/user/favorites", json={
        "item_type": "heritage",
        "item_id": 1,
    })
    assert resp.status_code == 401


def test_add_favorite(client, auth_header):
    """添加收藏"""
    resp = client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["message"] == "已收藏"


def test_add_duplicate_favorite(client, auth_header):
    """重复收藏"""
    client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth_header,
    )
    resp = client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth_header,
    )
    assert resp.status_code == 400  # 重复收藏


def test_list_favorites(client, auth_header):
    """获取收藏列表"""
    # 添加收藏
    client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth_header,
    )
    resp = client.get("/api/user/favorites", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    item = data[0]
    assert "item_type" in item
    assert "title" in item
    assert "image_url" in item


def test_delete_favorite(client, auth_header):
    """取消收藏"""
    # 先添加
    client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth_header,
    )
    # 获取收藏ID
    favs = client.get("/api/user/favorites", headers=auth_header).json()
    fav_id = favs[0]["id"]

    # 删除
    resp = client.delete(f"/api/user/favorites/{fav_id}", headers=auth_header)
    assert resp.status_code == 200

    # 确认已删除
    favs2 = client.get("/api/user/favorites", headers=auth_header).json()
    assert len(favs2) == 0


def test_delete_other_user_favorite(client, auth_header):
    """不能删除别人的收藏"""
    # 创建另一个用户并收藏
    username2 = f"test_{uuid.uuid4().hex[:8]}"
    resp2 = client.post("/api/auth/register", json={
        "username": username2, "password": "test123456",
    })
    token2 = resp2.json()["access_token"]
    auth2 = {"Authorization": f"Bearer {token2}"}

    client.post(
        "/api/user/favorites",
        json={"item_type": "heritage", "item_id": 1},
        headers=auth2,
    )
    favs2 = client.get("/api/user/favorites", headers=auth2).json()
    fav2_id = favs2[0]["id"]

    # 用第一个用户尝试删除
    resp = client.delete(f"/api/user/favorites/{fav2_id}", headers=auth_header)
    assert resp.status_code == 404  # 找不到(因为不属于当前用户)


def test_favorite_invalid_type(client, auth_header):
    """非法收藏类型"""
    resp = client.post(
        "/api/user/favorites",
        json={"item_type": "invalid", "item_id": 1},
        headers=auth_header,
    )
    assert resp.status_code == 422


# === 统计 ===

def test_get_statistics(client, auth_header):
    """获取统计数据"""
    resp = client.get("/api/user/statistics", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "recognition_count" in data
    assert "generation_count" in data
    assert "chat_count" in data
    assert "favorite_count" in data
    assert "upload_count" in data
