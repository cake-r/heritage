"""虚拟传承人对话API测试"""

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
    from app.models.chat import ChatSession, ChatMessage
    db.query(ChatMessage).delete()
    db.query(ChatSession).delete()
    db.query(User).filter(User.username.like("test_%")).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header(client):
    username = f"test_{uuid.uuid4().hex[:8]}"
    resp = client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# === 角色列表 ===

def test_list_characters(client):
    """获取传承人角色列表"""
    resp = client.get("/api/chat/characters")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    char = data[0]
    assert "id" in char
    assert "name" in char
    assert "expertise" in char
    assert "greeting" in char


# === 会话管理 ===

def test_create_session(client, auth_header):
    """创建对话会话"""
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "paper_cutter"},
        headers=auth_header,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["persona"] == "paper_cutter"
    assert "id" in data
    assert "剪纸" in data["title"]


def test_create_session_invalid_persona(client, auth_header):
    """创建会话 — 无效角色"""
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "nonexistent"},
        headers=auth_header,
    )
    assert resp.status_code == 400


def test_create_session_requires_auth(client):
    """创建会话需要登录"""
    resp = client.post("/api/chat/sessions", json={"persona": "paper_cutter"})
    assert resp.status_code == 401


def test_list_sessions(client, auth_header):
    """获取会话列表"""
    # 创建2个会话
    client.post("/api/chat/sessions", json={"persona": "paper_cutter"}, headers=auth_header)
    client.post("/api/chat/sessions", json={"persona": "embroidery_lady"}, headers=auth_header)

    resp = client.get("/api/chat/sessions", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_get_session_detail(client, auth_header):
    """获取会话详情"""
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "culture_guide"},
        headers=auth_header,
    )
    session_id = resp.json()["id"]

    resp = client.get(f"/api/chat/sessions/{session_id}", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == session_id
    assert data["persona"] == "culture_guide"
    assert "messages" in data


def test_get_session_not_owned(client, auth_header):
    """不能查看别人的会话"""
    # 创建另一个用户
    username2 = f"test_{uuid.uuid4().hex[:8]}"
    resp2 = client.post("/api/auth/register", json={
        "username": username2, "password": "test123456",
    })
    token2 = resp2.json()["access_token"]
    auth2 = {"Authorization": f"Bearer {token2}"}

    resp = client.post("/api/chat/sessions", json={"persona": "paper_cutter"}, headers=auth2)
    session_id = resp.json()["id"]

    # 第一个用户尝试访问
    resp = client.get(f"/api/chat/sessions/{session_id}", headers=auth_header)
    assert resp.status_code == 404


def test_delete_session(client, auth_header):
    """删除会话"""
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "paper_cutter"},
        headers=auth_header,
    )
    session_id = resp.json()["id"]

    resp = client.delete(f"/api/chat/sessions/{session_id}", headers=auth_header)
    assert resp.status_code == 200

    # 确认已删除
    resp = client.get(f"/api/chat/sessions/{session_id}", headers=auth_header)
    assert resp.status_code == 404


# === SSE流式对话 ===

def test_send_message_requires_auth(client):
    """发送消息需要登录"""
    resp = client.post("/api/chat/sessions/1/send", data={"content": "你好"})
    assert resp.status_code == 401


def test_send_message_stream(client, auth_header):
    """SSE流式对话 — 验证返回event-stream"""
    # 创建会话
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "paper_cutter"},
        headers=auth_header,
    )
    session_id = resp.json()["id"]

    # 发送消息 (SSE)
    resp = client.post(
        f"/api/chat/sessions/{session_id}/send",
        data={"content": "剪纸有哪些基本技法？"},
        headers=auth_header,
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")

    # 验证SSE格式
    content = resp.text
    assert "event: message" in content or "event: done" in content or "event: error" in content


def test_send_message_persists(client, auth_header):
    """验证消息被持久化到数据库"""
    # 创建会话
    resp = client.post(
        "/api/chat/sessions",
        json={"persona": "paper_cutter"},
        headers=auth_header,
    )
    session_id = resp.json()["id"]

    # 发送消息
    resp = client.post(
        f"/api/chat/sessions/{session_id}/send",
        data={"content": "你好"},
        headers=auth_header,
    )
    assert resp.status_code == 200

    # 检查数据库中的消息
    db = SessionLocal()
    from app.models.chat import ChatMessage
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).all()
    db.close()

    assert len(messages) >= 1
    # 用户消息
    user_msgs = [m for m in messages if m.role == "user"]
    assert len(user_msgs) >= 1
    assert user_msgs[0].content == "你好"
