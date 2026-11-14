import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.config import settings
from backend.app.services.update_service import _clean_version, check_for_updates, get_download_progress
from packaging import version as semver

client = TestClient(app)

def test_clean_version():
    assert _clean_version("v1.2.3") == "1.2.3"
    assert _clean_version("V2.0.0") == "2.0.0"
    assert _clean_version("1.0.0") == "1.0.0"

def test_semver_comparison():
    assert semver.parse("1.1.0") > semver.parse("1.0.0")
    assert semver.parse("1.0.1") > semver.parse("1.0.0")
    assert not (semver.parse("1.0.0") > semver.parse("1.0.0"))

def test_check_updates_offline_safe():
    res = check_for_updates(force=True)
    assert "update_available" in res
    assert "current_version" in res
    assert res["current_version"] == settings.VERSION

def test_get_progress_initial():
    progress = get_download_progress()
    assert progress["status"] in ["idle", "downloading", "ready", "error"]
    assert "progress_percent" in progress

def test_update_endpoints_auth():
    # Public unauthenticated request to check update should be 401
    resp = client.get("/api/system/update/check")
    assert resp.status_code == 401

    # Login as admin to get token (JSON body)
    login_resp = client.post("/api/auth/login", json={"username": "admin", "password": "adminpassword123"})
    if login_resp.status_code != 200:
        # fallback default admin credentials
        login_resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Authenticated check
    check_resp = client.get("/api/system/update/check", headers=headers)
    assert check_resp.status_code == 200
    data = check_resp.json()
    assert "update_available" in data
    assert data["current_version"] == settings.VERSION

    # Authenticated progress
    prog_resp = client.get("/api/system/update/progress", headers=headers)
    assert prog_resp.status_code == 200
    assert "status" in prog_resp.json()
