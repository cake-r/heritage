"""模块① 识别讲解API测试"""

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
    # 清理测试数据
    db = SessionLocal()
    from app.models.user import User
    from app.models.recognition import RecognitionRecord
    db.query(RecognitionRecord).delete()
    db.query(User).filter(User.username.like("rec_%")).delete()
    db.commit()
    db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_header(client):
    """注册用户并返回Authorization header"""
    username = f"rec_{uuid.uuid4().hex[:8]}"
    client.post("/api/auth/register", json={
        "username": username,
        "password": "test123456",
    })
    resp = client.post("/api/auth/login", data={
        "username": username,
        "password": "test123456",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_test_image():
    """创建一个有效的测试图片 (1x1 PNG)"""
    from PIL import Image
    img = Image.new("RGB", (300, 300), color="red")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_upload_recognition(client, auth_header):
    """测试上传识别流程"""
    img = create_test_image()
    resp = client.post(
        "/api/recognition/upload",
        files={"file": ("test.png", img, "image/png")},
        headers=auth_header,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "category" in data
    assert "confidence" in data
    assert "explanation" in data
    assert "history" in data["explanation"]
    assert "features" in data
    assert "related" in data


def test_upload_no_auth(client):
    """未登录上传应失败"""
    img = create_test_image()
    resp = client.post(
        "/api/recognition/upload",
        files={"file": ("test.png", img, "image/png")},
    )
    assert resp.status_code in [401, 403]


def test_history(client, auth_header):
    """测试识别历史"""
    # 先上传一条
    img = create_test_image()
    client.post(
        "/api/recognition/upload",
        files={"file": ("hist_test.png", img, "image/png")},
        headers=auth_header,
    )

    resp = client.get("/api/recognition/history?page=1&page_size=10", headers=auth_header)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


def test_detail(client, auth_header):
    """测试识别详情"""
    img = create_test_image()
    upload_resp = client.post(
        "/api/recognition/upload",
        files={"file": ("detail_test.png", img, "image/png")},
        headers=auth_header,
    )
    record_id = upload_resp.json()["id"]

    resp = client.get(f"/api/recognition/{record_id}", headers=auth_header)
    assert resp.status_code == 200
    assert resp.json()["id"] == record_id


def test_detail_not_found(client, auth_header):
    """不存在的记录"""
    resp = client.get("/api/recognition/99999", headers=auth_header)
    assert resp.status_code == 404


def test_invalid_file_type(client, auth_header):
    """上传非图片文件应拒绝"""
    resp = client.post(
        "/api/recognition/upload",
        files={"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")},
        headers=auth_header,
    )
    assert resp.status_code == 400
