import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db
from backend.app.models.student import Student
from backend.app.models.fee import StudentFeeHead
from backend.app.models.payment import Payment, PaymentItem
from backend.app.models.fine import Fine
from backend.app.models.audit import AuditLog

client = TestClient(app)

def test_delete_student_cascade_and_permissions():
    # 1. Login as Admin
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # 2. Login as Clerk
    clerk_login = client.post("/api/auth/login", json={"username": "clerk", "password": "clerk123"})
    assert clerk_login.status_code == 200
    clerk_headers = {"Authorization": f"Bearer {clerk_login.json()['access_token']}"}

    # 3. Create a test student
    create_res = client.post("/api/students", json={
        "full_name": "Student To Be Deleted",
        "gender": "MALE",
        "category": "OPEN",
        "academic_year": "2026-2027",
        "mobile_number": "9876543210",
        "current_year": 1
    }, headers=admin_headers)
    assert create_res.status_code == 200
    stu_data = create_res.json()
    student_id = stu_data["id"]

    # 4. Levy a fine on this student
    fine_res = client.post("/api/fines", json={
        "student_id": student_id,
        "event_name": "Late Registration Penalty",
        "amount": 500.00
    }, headers=admin_headers)
    assert fine_res.status_code == 200

    # 5. Record a partial payment
    pay_res = client.post("/api/payments", json={
        "student_id": student_id,
        "payment_date": "2026-11-18",
        "payment_mode": "CASH",
        "physical_receipt_no": "TEST-DEL-REC-001",
        "remarks": "Partial fee payment",
        "items": [
            {"fee_head_id": stu_data["fee_heads"][0]["fee_head_id"] if "fee_heads" in stu_data and stu_data["fee_heads"] else 1, "amount": 5000.00}
        ]
    }, headers=admin_headers)
    assert pay_res.status_code == 200

    # 6. Verify student has balance > 0
    detail = client.get(f"/api/students/{student_id}", headers=admin_headers).json()
    assert float(detail["overall_balance"]) > 0

    # 7. Clerk attempts to delete student -> 403 Forbidden
    clerk_del = client.delete(f"/api/students/{student_id}", headers=clerk_headers)
    assert clerk_del.status_code == 403

    # 8. Admin deletes student -> 200 OK
    admin_del = client.delete(f"/api/students/{student_id}", headers=admin_headers)
    assert admin_del.status_code == 200
    assert admin_del.json()["success"] is True

    # 9. Verify student is 404
    check_res = client.get(f"/api/students/{student_id}", headers=admin_headers)
    assert check_res.status_code == 404

    # 10. Verify cascade deletion in database
    db = next(get_db())
    try:
        assert db.query(Student).filter(Student.id == student_id).first() is None
        assert db.query(StudentFeeHead).filter(StudentFeeHead.student_id == student_id).count() == 0
        assert db.query(Payment).filter(Payment.student_id == student_id).count() == 0
        assert db.query(Fine).filter(Fine.student_id == student_id).count() == 0

        # Verify audit log recorded
        audit = db.query(AuditLog).filter(
            AuditLog.action == "DELETE_STUDENT",
            AuditLog.entity_id == student_id
        ).first()
        assert audit is not None
        assert "Student To Be Deleted" in audit.details
    finally:
        db.close()
