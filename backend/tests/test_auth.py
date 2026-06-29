"""鉴权API测试"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    # 清理测试用户
    db = SessionLocal()
    from app.models.user import User
    db.query(User).filter(User.username.like("test_%")).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


def _uid():
    """生成唯一用户名"""
    return f"test_{uuid.uuid4().hex[:8]}"


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_register(client):
    username = _uid()
    resp = client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
        "nickname": "测试用户"
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == username


def test_login(client):
    username = _uid()
    client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
    })
    resp = client.post("/api/auth/login", data={
        "username": username,
        "password": "test123456",
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data


def test_duplicate_register(client):
    username = _uid()
    client.post("/api/auth/register", json={
        "username": username, "password": "test123456",
    })
    resp = client.post("/api/auth/register", json={
        "username": username, "password": "test123456",
    })
    assert resp.status_code == 400


def test_wrong_password(client):
    username = _uid()
    client.post("/api/auth/register", json={
        "username": username, "password": "test123456",
    })
    resp = client.post("/api/auth/login", data={
        "username": username,
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_me(client):
    username = _uid()
    resp = client.post("/api/auth/register", json={
        "username": username, "password": "test123456",
    })
    token = resp.json()["access_token"]

    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == username


def test_me_no_token(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401  # 无token=未认证=401
