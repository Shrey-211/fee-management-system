import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_dynamic_fee_concession_types_and_waiver_rules():
    # 1. Login as Admin
    login_res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Fetch Fee Heads
    heads_res = client.get("/api/fees/heads", headers=headers)
    assert heads_res.status_code == 200
    fee_heads = heads_res.json()
    tuition_head = next(h for h in fee_heads if "TUITION" in h["code"])
    dev_head = next(h for h in fee_heads if "DEVELOPMENT" in h["code"])

    # 3. Fetch existing Concession Types (seeded)
    types_res = client.get("/api/fees/types", headers=headers)
    assert types_res.status_code == 200
    types = types_res.json()
    assert len(types) >= 6
    ebc_type = next((t for t in types if t["code"] == "EBC"), None)
    assert ebc_type is not None

    # 4. Create a new custom fee type: SPORTS_QUOTA with 100% Tuition waiver & 50% Dev waiver
    sports_type_payload = {
        "name": "Sports Champion Quota",
        "code": f"SPORTS_{uuid.uuid4().hex[:4].upper()}",
        "type_group": "CUSTOM",
        "academic_year": "2026-2027",
        "description": "National/State level sports medalists",
        "is_active": True,
        "rules": [
            {
                "fee_head_id": tuition_head["id"],
                "waiver_percent": "100.00",
                "waiver_amount": "0.00",
                "reason": "100% Sports Merit Concession"
            },
            {
                "fee_head_id": dev_head["id"],
                "waiver_percent": "50.00",
                "waiver_amount": "0.00",
                "reason": "50% Sports Development Concession"
            }
        ]
    }
    create_type_res = client.post("/api/fees/types", json=sports_type_payload, headers=headers)
    assert create_type_res.status_code == 200
    created_type = create_type_res.json()
    sports_type_id = created_type["id"]
    assert len(created_type["rules"]) == 2

    # 5. Create a male Open student assigned to SPORTS_QUOTA
    unique_code = f"STU-SPORTS-{uuid.uuid4().hex[:4].upper()}"
    student_payload = {
        "student_code": unique_code,
        "full_name": "Sports Star Student",
        "gender": "MALE",
        "category": "OPEN",
        "concession_type_id": sports_type_id,
        "academic_year": "2026-2027",
        "course_branch": "B.Tech Mechanical"
    }
    s_create_res = client.post("/api/students", json=student_payload, headers=headers)
    assert s_create_res.status_code == 200
    created_student = s_create_res.json()

    # Tuition: ₹40,000 -> 100% waived = ₹0 net
    # Development: ₹15,000 -> 50% waived (₹7,500 disc) = ₹7,500 net
    # Dress: ₹3,000 net, Exam: ₹2,000 net, Other: ₹1,000 net
    # Net due = 0 + 7500 + 3000 + 2000 + 1000 = ₹13,500.00
    assert Decimal(str(created_student["net_fee_due"])) == Decimal("13500.00")
    assert Decimal(str(created_student["total_waiver"])) == Decimal("47500.00")

    # 6. Test bulk re-apply rules
    reapply_res = client.post("/api/fees/reapply-rules", headers=headers)
    assert reapply_res.status_code == 200
    assert reapply_res.json()["status"] == "success"
    assert reapply_res.json()["students_recalculated"] >= 1

    # 7. Clean up test student and test custom fee type to keep database pristine
    from backend.app.database import SessionLocal
    from backend.app.models.student import Student
    from backend.app.models.fee import StudentFeeHead
    clean_session = SessionLocal()
    clean_session.query(StudentFeeHead).filter(StudentFeeHead.student_id == created_student["id"]).delete()
    clean_session.query(Student).filter(Student.id == created_student["id"]).delete()
    clean_session.commit()
    clean_session.close()

    del_type_res = client.delete(f"/api/fees/types/{sports_type_id}", headers=headers)
    assert del_type_res.status_code == 200

