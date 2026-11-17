import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def get_auth_headers():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_year_wise_enrollment_and_heads():
    headers = get_auth_headers()
    unique_suffix = uuid.uuid4().hex[:6]

    # 1. Enroll Year 1 Student
    y1_payload = {
        "full_name": f"Year 1 Student {unique_suffix}",
        "academic_year": "2026-2027",
        "gender": "MALE",
        "category": "OPEN",
        "course_branch": "MBA",
        "current_year": 1,
        "mobile_number": "9876543210"
    }
    y1_res = client.post("/api/students", json=y1_payload, headers=headers)
    assert y1_res.status_code == 200
    y1_data = y1_res.json()
    assert y1_data["current_year"] == 1

    # Check fee heads: Year 1 OPEN total fee is 61,000 (Tuition: 40k, Dev: 15k, Exam: 2k, Other: 1k, Dress: 3k)
    y1_detail = client.get(f"/api/students/{y1_data['id']}", headers=headers).json()
    assert float(y1_detail["net_fee_due"]) == 61000.00
    for h in y1_detail["fee_heads"]:
        assert h["year_of_study"] == 1
        assert h["is_first_year_arrear"] is False

    # 2. Enroll Direct Year 2 Student
    y2_payload = {
        "full_name": f"Year 2 Student {unique_suffix}",
        "academic_year": "2026-2027",
        "gender": "MALE",
        "category": "OPEN",
        "course_branch": "MBA",
        "current_year": 2,
        "mobile_number": "9876543211"
    }
    y2_res = client.post("/api/students", json=y2_payload, headers=headers)
    assert y2_res.status_code == 200
    y2_data = y2_res.json()
    assert y2_data["current_year"] == 2

    # Check fee heads: Year 2 OPEN total fee is 61,000 (Tuition: 40k, Dev: 15k, Dress: 3k, Exam: 2k, Other: 1k - identical to Year 1)
    y2_detail = client.get(f"/api/students/{y2_data['id']}", headers=headers).json()
    assert float(y2_detail["net_fee_due"]) == 61000.00
    for h in y2_detail["fee_heads"]:
        assert h["year_of_study"] == 2

def test_promotion_and_arrears_carry_forward():
    headers = get_auth_headers()
    unique_suffix = uuid.uuid4().hex[:6]

    # 1. Enroll Year 1 Student
    payload = {
        "full_name": f"Promotee Student {unique_suffix}",
        "academic_year": "2026-2027",
        "gender": "MALE",
        "category": "OPEN",
        "course_branch": "MBA",
        "current_year": 1,
        "mobile_number": "9876543212"
    }
    s_res = client.post("/api/students", json=payload, headers=headers)
    assert s_res.status_code == 200
    student = s_res.json()
    s_id = student["id"]

    # 2. Make partial payment in 1st Year (Pay 20,000 out of 61,000)
    detail_before = client.get(f"/api/students/{s_id}", headers=headers).json()
    tuition_head = next(h for h in detail_before["fee_heads"] if "TUITION" in h["code"])

    pay_res = client.post("/api/payments", json={
        "student_id": s_id,
        "physical_receipt_no": f"REC-Y1-{unique_suffix}",
        "payment_date": "2026-11-17",
        "payment_mode": "CASH",
        "remarks": "Partial 1st year payment",
        "items": [
            {"fee_head_id": tuition_head["fee_head_id"], "amount": 20000.00}
        ]
    }, headers=headers)
    assert pay_res.status_code == 200

    detail_after_pay = client.get(f"/api/students/{s_id}", headers=headers).json()
    assert float(detail_after_pay["overall_balance"]) == 41000.00

    # 3. Promote Student to 2nd Year
    promote_res = client.post(f"/api/students/{s_id}/promote", headers=headers)
    assert promote_res.status_code == 200
    promoted_data = promote_res.json()
    assert promoted_data["current_year"] == 2
    assert float(promoted_data["year_1_dues"]) == 41000.00

    # 4. Check detailed fee ledger after promotion
    detail_promoted = client.get(f"/api/students/{s_id}", headers=headers).json()
    assert detail_promoted["current_year"] == 2
    assert float(detail_promoted["year_1_dues"]) == 41000.00

    # Year 1 fee heads should still exist, with unpaid ones marked is_first_year_arrear=True
    y1_heads = [h for h in detail_promoted["fee_heads"] if h["year_of_study"] == 1]
    y2_heads = [h for h in detail_promoted["fee_heads"] if h["year_of_study"] == 2]

    assert len(y1_heads) > 0
    assert len(y2_heads) > 0

    arrears_heads = [h for h in y1_heads if h["is_first_year_arrear"]]
    assert len(arrears_heads) > 0

    # 5. Make a payment clearing 1st year arrears while student is in 2nd year
    y1_tuition = next(h for h in y1_heads if "TUITION" in h["code"])
    rem_tuition = float(y1_tuition["balance"]) # was 40,000 - 20,000 = 20,000
    assert rem_tuition == 20000.00

    pay_arrear_res = client.post("/api/payments", json={
        "student_id": s_id,
        "physical_receipt_no": f"REC-Y2-ARR-{unique_suffix}",
        "payment_date": "2026-11-17",
        "payment_mode": "UPI",
        "remarks": "Clearing 1st year tuition arrears in 2nd year",
        "items": [
            {"fee_head_id": y1_tuition["fee_head_id"], "amount": rem_tuition}
        ]
    }, headers=headers)
    assert pay_arrear_res.status_code == 200

    detail_after_arrear_pay = client.get(f"/api/students/{s_id}", headers=headers).json()
    # 1st year dues should have reduced by 20,000: from 41,000 to 21,000
    assert float(detail_after_arrear_pay["year_1_dues"]) == 21000.00

def test_reports_year_filtering():
    headers = get_auth_headers()

    # Query students list filtered by current_year
    y1_students = client.get("/api/students?current_year=1", headers=headers).json()
    for s in y1_students:
        assert s["current_year"] == 1

    y2_students = client.get("/api/students?current_year=2", headers=headers).json()
    for s in y2_students:
        assert s["current_year"] == 2

    # Query daily collection report with year_of_study filter
    daily_all = client.get("/api/reports/daily", headers=headers).json()
    daily_y1 = client.get("/api/reports/daily?year_of_study=1", headers=headers).json()
    daily_y2 = client.get("/api/reports/daily?year_of_study=2", headers=headers).json()

    assert "items" in daily_all
    assert "items" in daily_y1
    assert "items" in daily_y2
    for itm in daily_y1["items"]:
        assert itm["student_current_year"] == 1
    for itm in daily_y2["items"]:
        assert itm["student_current_year"] == 2
