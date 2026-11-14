import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_payment_edit_and_delete_lifecycle_with_ledger_recalculation():
    # 1. Login as Admin
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Login as Clerk
    clerk_login = client.post("/api/auth/login", json={"username": "clerk", "password": "clerk123"})
    assert clerk_login.status_code == 200
    clerk_token = clerk_login.json()["access_token"]
    clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

    # 2. Enroll a test student (OPEN category so full fee applies)
    student_payload = {
        "full_name": "Test Payment Lifecycle Student",
        "academic_year": "25-26",
        "gender": "MALE",
        "category": "OPEN"
    }
    s_res = client.post("/api/students", json=student_payload, headers=admin_headers)
    assert s_res.status_code == 200
    student = s_res.json()
    student_id = student["id"]

    # Get student fee heads
    detail_res = client.get(f"/api/students/{student_id}", headers=admin_headers)
    assert detail_res.status_code == 200
    student_detail = detail_res.json()
    tuition_head = next(h for h in student_detail["fee_heads"] if "TUITION" in h["name"].upper())
    initial_net_due = Decimal(str(tuition_head["net_due"]))
    assert Decimal(str(student_detail["total_fee_paid"])) == Decimal("0.00")

    # 3. Record an initial payment of ₹10,000 towards Tuition
    pay_payload = {
        "student_id": student_id,
        "physical_receipt_no": "MAN-REC-001",
        "payment_date": "2026-11-14",
        "payment_mode": "CASH",
        "remarks": "Initial installment",
        "items": [
            {
                "fee_head_id": tuition_head["fee_head_id"],
                "amount": 10000.00
            }
        ]
    }
    pay_res = client.post("/api/payments", json=pay_payload, headers=admin_headers)
    assert pay_res.status_code == 200
    created_payment = pay_res.json()
    payment_id = created_payment["id"]
    assert Decimal(str(created_payment["total_amount"])) == Decimal("10000.00")

    # Verify student ledger dues reduced by 10,000
    after_pay = client.get(f"/api/students/{student_id}", headers=admin_headers).json()
    assert Decimal(str(after_pay["total_fee_paid"])) == Decimal("10000.00")

    # 4. RBAC Check: Clerk cannot edit or delete payment
    clerk_edit = client.put(f"/api/payments/{payment_id}", json={"payment_mode": "UPI"}, headers=clerk_headers)
    assert clerk_edit.status_code == 403

    clerk_del = client.delete(f"/api/payments/{payment_id}", headers=clerk_headers)
    assert clerk_del.status_code == 403

    # 5. Edit Payment: Admin updates receipt #, mode to UPI, and amount to ₹15,000
    update_payload = {
        "physical_receipt_no": "MAN-REC-001-MOD",
        "payment_date": "2026-11-14",
        "payment_mode": "UPI",
        "remarks": "Corrected receipt to UPI ₹15,000",
        "items": [
            {
                "fee_head_id": tuition_head["fee_head_id"],
                "amount": 15000.00
            }
        ]
    }
    edit_res = client.put(f"/api/payments/{payment_id}", json=update_payload, headers=admin_headers)
    assert edit_res.status_code == 200
    updated_payment = edit_res.json()
    assert updated_payment["physical_receipt_no"] == "MAN-REC-001-MOD"
    assert updated_payment["payment_mode"] == "UPI"
    assert Decimal(str(updated_payment["total_amount"])) == Decimal("15000.00")

    # Verify student ledger immediately recalculated to reflect 15,000
    after_edit = client.get(f"/api/students/{student_id}", headers=admin_headers).json()
    assert Decimal(str(after_edit["total_fee_paid"])) == Decimal("15000.00")

    # 6. Delete Payment: Admin deletes this payment receipt
    del_res = client.delete(f"/api/payments/{payment_id}", headers=admin_headers)
    assert del_res.status_code == 200

    # Verify payment is no longer in payments list
    get_del = client.get(f"/api/payments/{payment_id}", headers=admin_headers)
    assert get_del.status_code == 404

    # Verify student ledger has completely restored original dues (paid is back to 0)
    after_del = client.get(f"/api/students/{student_id}", headers=admin_headers).json()
    assert Decimal(str(after_del["total_fee_paid"])) == Decimal("0.00")

    # 7. Verify Audit Log recorded UPDATE_PAYMENT and DELETE_PAYMENT
    audit_res = client.get("/api/settings/audit-logs", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    actions = [l["action"] for l in logs]
    assert "UPDATE_PAYMENT" in actions
    assert "DELETE_PAYMENT" in actions

