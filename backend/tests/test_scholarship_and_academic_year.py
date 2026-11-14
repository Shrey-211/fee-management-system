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

    # 5. Check student details reflecting updated received scholarship and status consistency
    detail_res = client.get(f"/api/students/{student_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert Decimal(str(detail["scholarship_received"])) == Decimal(str(target_sc["amount"]))
    assert detail["scholarship_status"] in ["PARTIAL", "RECEIVED"]

    # Filter student directory by partial / received
    if detail["scholarship_status"] == "PARTIAL":
        p_res = client.get("/api/students?scholarship_status=PARTIAL", headers=headers)
        assert p_res.status_code == 200
        assert any(st["id"] == student_id for st in p_res.json())

    # 6. Mark back to pending
    reset_res = client.put(f"/api/scholarships/{target_sc['id']}/mark-pending", headers=headers)
    assert reset_res.status_code == 200
    reset_sc = reset_res.json()
    assert reset_sc["status"] == "NOT_RECEIVED"
    assert reset_sc["credit_date"] is None

    # Check student is NOT_RECEIVED again
    detail_after = client.get(f"/api/students/{student_id}", headers=headers).json()
    assert detail_after["scholarship_status"] == "NOT_RECEIVED"


def test_partial_installment_disbursements_lifecycle():
    # 1. Login as Admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Student with SC category (Tuition: ₹40,000, Dev: ₹15,000)
    student_payload = {
        "full_name": "Pooja Jadhav",
        "gender": "FEMALE",
        "category": "SC",
        "academic_year": "25-26"
    }
    create_res = client.post("/api/students", json=student_payload, headers=headers)
    assert create_res.status_code == 200
    student_id = create_res.json()["id"]

    sc_res = client.get(f"/api/scholarships?student_id={student_id}", headers=headers)
    scholarships = sc_res.json()
    assert len(scholarships) >= 1
    tuition_sc = [s for s in scholarships if "Tuition" in (s["fee_head_name"] or "") or s["amount"] == 40000.0][0]
    total_claim = Decimal(str(tuition_sc["amount"]))

    # 3. First installment: Receive ₹15,000 partial step
    step1_req = {
        "amount": 15000.0,
        "sanction_order_no": "MAHA-TERM1-001",
        "credit_date": "2026-11-14",
        "remarks": "Term 1 installment credited"
    }
    step1_res = client.put(f"/api/scholarships/{tuition_sc['id']}/mark-received", json=step1_req, headers=headers)
    assert step1_res.status_code == 200
    sc_data = step1_res.json()
    assert sc_data["status"] == "PARTIALLY_RECEIVED"
    assert Decimal(str(sc_data["received_amount"])) == Decimal("15000.00")
    assert Decimal(str(sc_data["remaining_amount"])) == total_claim - Decimal("15000.00")
    assert len(sc_data["disbursements"]) == 1
    assert Decimal(str(sc_data["disbursements"][0]["amount"])) == Decimal("15000.00")
    disb_1 = sc_data["disbursements"][0]
    disb_1_id = disb_1["id"]
    disb_1_payment_id = disb_1.get("payment_id")
    assert disb_1_payment_id is not None
    assert disb_1.get("receipt_no") is not None

    # Verify Payment receipt exists with mode GOVT_SCHOLARSHIP
    pmt_res = client.get(f"/api/payments?payment_mode=GOVT_SCHOLARSHIP", headers=headers)
    assert pmt_res.status_code == 200
    pmts = pmt_res.json()
    assert any(p["id"] == disb_1_payment_id for p in pmts)

    # 4. Verify Student Profile & Directory reflect partial step
    student_detail = client.get(f"/api/students/{student_id}", headers=headers).json()
    assert Decimal(str(student_detail["scholarship_received"])) >= Decimal("15000.00")
    assert student_detail["scholarship_status"] == "PARTIAL"

    # 5. Overpayment guard: attempt to disburse more than remaining
    bad_req = {
        "amount": float(total_claim),
        "sanction_order_no": "TOO_MUCH"
    }
    bad_res = client.put(f"/api/scholarships/{tuition_sc['id']}/mark-received", json=bad_req, headers=headers)
    assert bad_res.status_code == 400

    # 6. Second installment: Receive the exact remaining amount
    remaining_due = float(total_claim - Decimal("15000.00"))
    step2_req = {
        "amount": remaining_due,
        "sanction_order_no": "MAHA-TERM2-002",
        "credit_date": "2026-11-14",
        "remarks": "Term 2 final installment"
    }
    step2_res = client.put(f"/api/scholarships/{tuition_sc['id']}/mark-received", json=step2_req, headers=headers)
    assert step2_res.status_code == 200
    sc_data2 = step2_res.json()
    assert sc_data2["status"] == "RECEIVED"
    assert Decimal(str(sc_data2["received_amount"])) == total_claim
    assert Decimal(str(sc_data2["remaining_amount"])) == Decimal("0.00")
    assert len(sc_data2["disbursements"]) == 2

    # 7. Delete an installment: test deletion of disbursement step
    del_res = client.delete(f"/api/scholarships/{tuition_sc['id']}/disbursements/{disb_1_id}", headers=headers)
    assert del_res.status_code == 200
    after_del = del_res.json()
    assert Decimal(str(after_del["received_amount"])) == total_claim - Decimal("15000.00")
    assert after_del["status"] == "PARTIALLY_RECEIVED"
    assert len(after_del["disbursements"]) == 1

    # Verify associated payment receipt was automatically cleaned up
    pmt_after_res = client.get(f"/api/payments?payment_mode=GOVT_SCHOLARSHIP", headers=headers)
    assert pmt_after_res.status_code == 200
    assert not any(p["id"] == disb_1_payment_id for p in pmt_after_res.json())


