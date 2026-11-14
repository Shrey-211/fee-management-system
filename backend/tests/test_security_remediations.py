import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_security_headers_present():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

def test_clerk_cannot_waive_fines():
    # 1. Login as clerk
    login_res = client.post("/api/auth/login", json={"username": "clerk", "password": "clerk123"})
    assert login_res.status_code == 200
    clerk_token = login_res.json()["access_token"]
    clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

    # 2. Get students
    students = client.get("/api/students", headers=clerk_headers).json()
    student_id = students[0]["id"]

    # 3. Create a fine
    fine_res = client.post("/api/fines", json={
        "student_id": student_id,
        "event_name": "Test Fine For Waiver Check",
        "amount": 100.00
    }, headers=clerk_headers)
    assert fine_res.status_code == 200
    fine_id = fine_res.json()["id"]

    # 4. Clerk attempts to waive fine -> must be 403 Forbidden
    waive_attempt = client.put(f"/api/fines/{fine_id}", json={
        "status": "WAIVED"
    }, headers=clerk_headers)
    assert waive_attempt.status_code == 403
    assert "privileges required" in waive_attempt.json()["detail"].lower()

def test_clerk_cannot_modify_concession_or_category():
    # Login as clerk
    login_res = client.post("/api/auth/login", json={"username": "clerk", "password": "clerk123"})
    assert login_res.status_code == 200
    clerk_token = login_res.json()["access_token"]
    clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

    students = client.get("/api/students", headers=clerk_headers).json()
    student_id = students[0]["id"]
    current_cat = students[0]["category"]
    new_cat = "SC" if current_cat != "SC" else "OPEN"

    # Clerk attempts to alter category to alter fee waiver -> must be 403 Forbidden
    hack_res = client.put(f"/api/students/{student_id}", json={
        "category": new_cat
    }, headers=clerk_headers)
    assert hack_res.status_code == 403
    assert "privileges required" in hack_res.json()["detail"].lower()

def test_backup_path_traversal_blocked():
    # Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Path traversal attempts
    bad_res1 = client.get("/api/settings/backups/download/../../data/fees.db", headers=admin_headers)
    assert bad_res1.status_code in [400, 404]

    bad_res2 = client.get("/api/settings/backups/download/not_a_db_file.txt", headers=admin_headers)
    assert bad_res2.status_code in [400, 404]

def test_audit_log_recording_and_endpoint():
    # Login as admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Query audit logs
    audit_res = client.get("/api/settings/audit-logs?limit=50", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    # Confirm actions exist
    actions = [l["action"] for l in logs]
    assert any("LOGIN" in a or "PAYMENT" in a or "STUDENT" in a or "FINE" in a for a in actions)

