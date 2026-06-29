"""模块② 文创生成API测试"""

import os
import io
import uuid
import pytest
from fastapi.testclient import TestClient

os.environ["MOCK_MODE"] = "true"

from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    db = SessionLocal()
    from app.models.user import User
    from app.models.generation import GeneratedWork
    db.query(GeneratedWork).delete()
    db.query(User).filter(User.username.like("gen_%")).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header(client):
    username = f"gen_{uuid.uuid4().hex[:8]}"
    client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
    })
    resp = client.post("/api/auth/login", data={
        "username": username,
        "password": "test123456",
    })
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_text_to_image(client, auth_header):
    resp = client.post("/api/generation/text-to-image", json={
        "base_style": "苏绣",
        "elements": ["祥云纹", "青花配色"],
        "intensity": 0.7,
        "count": 2,
    }, headers=auth_header)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "images" in data
    assert len(data["images"]) == 2
    assert "seed" in data
    assert data["params"]["base_style"] == "苏绣"


def test_text_to_image_no_auth(client):
    resp = client.post("/api/generation/text-to-image", json={
        "base_style": "苏绣",
    })
    assert resp.status_code in [401, 403]


def test_history(client, auth_header):
    # 先创建一条
    client.post("/api/generation/text-to-image", json={
        "base_style": "剪纸", "count": 2,
    }, headers=auth_header)

    resp = client.get("/api/generation/history?page=1&page_size=12", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


def test_gallery(client, auth_header):
    # 创建并发布
    cresp = client.post("/api/generation/text-to-image", json={
        "base_style": "年画", "count": 1,
    }, headers=auth_header)
    work_id = cresp.json()["id"]
    client.post(f"/api/generation/{work_id}/publish", json={"is_public": True}, headers=auth_header)

    resp = client.get("/api/generation/gallery")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1


def test_publish(client, auth_header):
    cresp = client.post("/api/generation/text-to-image", json={
        "base_style": "敦煌", "count": 1,
    }, headers=auth_header)
    work_id = cresp.json()["id"]

    resp = client.post(f"/api/generation/{work_id}/publish", json={"is_public": True}, headers=auth_header)
    assert resp.status_code == 200


def test_delete(client, auth_header):
    cresp = client.post("/api/generation/text-to-image", json={
        "base_style": "苗银", "count": 1,
    }, headers=auth_header)
    work_id = cresp.json()["id"]

    resp = client.delete(f"/api/generation/{work_id}", headers=auth_header)
    assert resp.status_code == 200

    # 确认已删
    resp2 = client.delete(f"/api/generation/{work_id}", headers=auth_header)
    assert resp2.status_code == 404


def test_invalid_intensity(client, auth_header):
    resp = client.post("/api/generation/text-to-image", json={
        "base_style": "苏绣",
        "intensity": 1.5,  # 超范围
    }, headers=auth_header)
    assert resp.status_code == 422
