import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_student_academic_year_and_scholarship_lifecycle():
    # 1. Login as Admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Enroll a student WITHOUT providing student_code / roll number, specifying academic_year="25-26"
    student_payload = {
        "full_name": "Rohan Deshmukh",
        "gender": "MALE",
        "category": "SC",  # 100% waiver on Tuition & Dev -> should auto-generate scholarship claims
        "academic_year": "25-26",
        "mobile_number": "9998887771"
    }
    create_res = client.post("/api/students", json=student_payload, headers=headers)
    assert create_res.status_code == 200
    student = create_res.json()
    student_id = student["id"]

    # Verify auto-generated code and defaults
    assert student["student_code"].startswith("MBA-25-26-")
    assert student["course_branch"] == "MBA"
    assert student["academic_year"] == "25-26"
    assert Decimal(str(student["scholarship_total"])) > Decimal("0.00")
    assert Decimal(str(student["scholarship_pending"])) == Decimal(str(student["scholarship_total"]))
    assert Decimal(str(student["scholarship_received"])) == Decimal("0.00")

    # 3. Verify scholarship list shows these claims as NOT_RECEIVED
    sc_res = client.get(f"/api/scholarships?student_id={student_id}", headers=headers)
    assert sc_res.status_code == 200
    scholarships = sc_res.json()
    assert len(scholarships) >= 1
    for sc in scholarships:
        assert sc["status"] == "NOT_RECEIVED"
        assert sc["credit_date"] is None
        assert "Not Received" in (sc["remarks"] or "")
        assert sc["academic_year"] == "25-26"

    # Filter scholarships by status=NOT_RECEIVED
    pending_res = client.get("/api/scholarships?status=NOT_RECEIVED", headers=headers)
    assert pending_res.status_code == 200
    assert any(s["id"] == scholarships[0]["id"] for s in pending_res.json())

    # 4. Mark one scholarship claim as RECEIVED (Govt money received)
    target_sc = scholarships[0]
    mark_req = {
        "sanction_order_no": "MAHA-DBT-2026-9999",
        "credit_date": "2026-11-14",
        "remarks": "DBT Grant sanctioned and credited"
    }
    mark_res = client.put(f"/api/scholarships/{target_sc['id']}/mark-received", json=mark_req, headers=headers)
    assert mark_res.status_code == 200
    updated_sc = mark_res.json()
    assert updated_sc["status"] == "RECEIVED"
    assert updated_sc["sanction_order_no"] == "MAHA-DBT-2026-9999"
    assert updated_sc["credit_date"] == "2026-11-14"

    # 5. Check student details reflecting updated received scholarship
    detail_res = client.get(f"/api/students/{student_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert Decimal(str(detail["scholarship_received"])) == Decimal(str(target_sc["amount"]))

    # 6. Mark back to pending
    reset_res = client.put(f"/api/scholarships/{target_sc['id']}/mark-pending", headers=headers)
    assert reset_res.status_code == 200
    reset_sc = reset_res.json()
    assert reset_sc["status"] == "NOT_RECEIVED"
    assert reset_sc["credit_date"] is None

