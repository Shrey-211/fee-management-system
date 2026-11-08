import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_and_frontend_serving():
    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["mode"] == "offline-local"

    # 2. Frontend index.html serving
    spa_res = client.get("/")
    assert spa_res.status_code == 200
    assert "<!doctype html>" in spa_res.text.lower()


def test_login_and_security_measures():
    # Invalid password
    bad_login = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert bad_login.status_code == 401

    # Valid admin login
    good_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert good_login.status_code == 200
    auth_data = good_login.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["role"] == "admin"
    token = auth_data["access_token"]

    # Verify protected route with token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "admin"

    # Verify unauthorized access blocked
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401


def test_full_workflow_student_payment_fines():
    # 1. Login as Clerk
    login_res = client.post("/api/auth/login", json={"username": "clerk", "password": "clerk123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get students
    students_res = client.get("/api/students", headers=headers)
    assert students_res.status_code == 200
    students = students_res.json()
    assert len(students) >= 6

    # 3. Create a new student (EBC Male)
    unique_code = f"STU-E2E-{uuid.uuid4().hex[:6].upper()}"
    new_student_payload = {
        "student_code": unique_code,
        "full_name": "Integration Test Student",
        "gender": "MALE",
        "category": "EBC",
        "academic_year": "2026-2027",
        "course_branch": "B.Tech Computer Science"
    }
    s_create_res = client.post("/api/students", json=new_student_payload, headers=headers)
    assert s_create_res.status_code == 200
    created_student = s_create_res.json()
    student_id = created_student["id"]

    # Verify EBC waiver was applied: 50% on Tuition (₹20,000 net), Full Development (₹15,000), Dress (₹3,000), Exam (₹2,000), Other (₹1,000) = ₹41,000 net due
    assert Decimal(str(created_student["net_fee_due"])) == Decimal("41000.00")

    # 4. Fetch detail
    detail_res = client.get(f"/api/students/{student_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert len(detail["fee_heads"]) == 5

    # Find Tuition fee head ID
    tuition_sfh = next(h for h in detail["fee_heads"] if "TUITION" in h["code"])
    assert Decimal(str(tuition_sfh["discount_amount"])) == Decimal("20000.00")

    # 5. Apply event fine (Send-off party absence)
    fine_res = client.post("/api/fines", json={
        "student_id": student_id,
        "event_name": "Send-off Party Absence",
        "amount": 350.00,
        "remarks": "Absence fine"
    }, headers=headers)
    assert fine_res.status_code == 200

    # 6. Record fee payment with manual receipt booklet number
    payment_payload = {
        "student_id": student_id,
        "physical_receipt_no": "MANUAL-BOOK-99/101",
        "payment_mode": "CASH",
        "items": [
            {"fee_head_id": tuition_sfh["fee_head_id"], "amount": 20000.00}
        ]
    }
    pay_res = client.post("/api/payments", json=payment_payload, headers=headers)
    assert pay_res.status_code == 200
    payment_data = pay_res.json()
    assert payment_data["physical_receipt_no"] == "MANUAL-BOOK-99/101"
    assert Decimal(str(payment_data["total_amount"])) == Decimal("20000.00")

    # 7. Download Daily Report Excel
    excel_res = client.get("/api/reports/daily/excel", headers=headers)
    assert excel_res.status_code == 200
    assert "spreadsheetml" in excel_res.headers["content-type"]
    assert len(excel_res.content) > 1000

    # 8. Download Outstanding Excel
    out_excel_res = client.get("/api/reports/outstanding/excel", headers=headers)
    assert out_excel_res.status_code == 200
    assert "spreadsheetml" in out_excel_res.headers["content-type"]
    assert len(out_excel_res.content) > 1000
