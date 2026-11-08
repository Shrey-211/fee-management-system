import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models import (
    User, Student, FeeHead, StudentFeeHead, 
    Payment, PaymentItem, Fine, ScholarshipCredit
)
from backend.app.services.fee_engine import (
    calculate_fee_waiver, initialize_student_fees, 
    recalculate_student_balances, quantize_amount
)
from backend.app.services.payment_service import record_payment
from backend.app.services.fine_service import apply_fine, update_fine_status
from backend.app.services.report_service import (
    generate_daily_collection_report, export_daily_collection_excel, export_outstanding_dues_excel
)
from backend.app.services.backup_service import perform_sqlite_backup, list_backups
from backend.app.auth import verify_password, get_password_hash, create_access_token
from backend.app.schemas.payment import PaymentCreate, PaymentItemCreate
from backend.app.schemas.fine import FineCreate, FineUpdate

# Test database in memory
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    
    # Seed fee heads
    heads = [
        FeeHead(name="Tuition Fee", code="TUITION", base_amount=Decimal("40000.00"), allows_waiver=True),
        FeeHead(name="Development Fee", code="DEVELOPMENT", base_amount=Decimal("15000.00"), allows_waiver=True),
        FeeHead(name="Dress Code Fee", code="DRESS_CODE", base_amount=Decimal("3000.00"), allows_waiver=False),
        FeeHead(name="Exam Fee", code="EXAM", base_amount=Decimal("2000.00"), allows_waiver=False),
        FeeHead(name="Other Charges", code="OTHER", base_amount=Decimal("1000.00"), allows_waiver=False),
    ]
    session.add_all(heads)

    # Seed Admin User
    admin = User(
        username="admin_test",
        password_hash=get_password_hash("adminpass"),
        full_name="Admin Test",
        role="admin",
        is_active=True
    )
    clerk = User(
        username="clerk_test",
        password_hash=get_password_hash("clerkpass"),
        full_name="Clerk Test",
        role="clerk",
        is_active=True
    )
    session.add_all([admin, clerk])
    session.commit()

    yield session

    session.close()
    Base.metadata.drop_all(bind=test_engine)


def test_fee_waiver_rules_and_precedence(db):
    """Verifies that all category and gender waiver rules and precedence match PRD requirements."""
    tuition = db.query(FeeHead).filter(FeeHead.code == "TUITION").first()
    dev = db.query(FeeHead).filter(FeeHead.code == "DEVELOPMENT").first()
    dress = db.query(FeeHead).filter(FeeHead.code == "DRESS_CODE").first()

    # 1. Open Male: Full tuition, full dev, full dress
    pct, amt, reason = calculate_fee_waiver(tuition, "MALE", "OPEN")
    assert pct == Decimal("0.00") and amt == Decimal("0.00")

    pct, amt, reason = calculate_fee_waiver(dev, "MALE", "OPEN")
    assert pct == Decimal("0.00") and amt == Decimal("0.00")

    # 2. Open Female: 100% Tuition waiver, 0% Dev waiver
    pct, amt, reason = calculate_fee_waiver(tuition, "FEMALE", "OPEN")
    assert pct == Decimal("100.00") and amt == Decimal("40000.00")
    assert "Girl" in reason

    pct, amt, reason = calculate_fee_waiver(dev, "FEMALE", "OPEN")
    assert pct == Decimal("0.00") and amt == Decimal("0.00")

    # 3. EBC Male: 50% Tuition discount, 0% Dev waiver
    pct, amt, reason = calculate_fee_waiver(tuition, "MALE", "EBC")
    assert pct == Decimal("50.00") and amt == Decimal("20000.00")
    assert "EBC" in reason

    # 4. SC / ST Student (Male or Female): 100% Tuition & 100% Dev waiver
    pct, amt, reason = calculate_fee_waiver(tuition, "MALE", "SC")
    assert pct == Decimal("100.00") and amt == Decimal("40000.00")
    assert "SC" in reason

    pct, amt, reason = calculate_fee_waiver(dev, "MALE", "SC")
    assert pct == Decimal("100.00") and amt == Decimal("15000.00")

    pct, amt, reason = calculate_fee_waiver(tuition, "FEMALE", "ST")
    assert pct == Decimal("100.00") and amt == Decimal("40000.00")

    pct, amt, reason = calculate_fee_waiver(dev, "FEMALE", "ST")
    assert pct == Decimal("100.00") and amt == Decimal("15000.00")

    # 5. Overlapping Waiver Precedence: EBC Female
    # Tuition is 100% waived by Girl rule (takes precedence over 50% EBC discount)
    pct, amt, reason = calculate_fee_waiver(tuition, "FEMALE", "EBC")
    assert pct == Decimal("100.00") and amt == Decimal("40000.00")

    # 6. Compulsory fee heads (Dress code, Exam, Other) are NEVER waived
    for gen in ["MALE", "FEMALE"]:
        for cat in ["OPEN", "EBC", "SC", "ST"]:
            pct, amt, _ = calculate_fee_waiver(dress, gen, cat)
            assert pct == Decimal("0.00")
            assert amt == Decimal("0.00")


def test_residual_balance_precision_edge_case(db):
    """
    Edge case: Tests exact arithmetic when a student pays ₹59,999 of ₹60,000.
    Ensures ₹1.00 residual due is preserved without floating-point artifacts.
    """
    student = Student(
        student_code="STU-EDGE-01",
        full_name="Edge Tester",
        gender="MALE",
        category="OPEN",
        academic_year="2026-2027"
    )
    db.add(student)
    db.commit()

    initialize_student_fees(student, db)
    tuition_head = db.query(StudentFeeHead).join(FeeHead).filter(
        StudentFeeHead.student_id == student.id,
        FeeHead.code == "TUITION"
    ).first()
    
    # Manually set base to 60,000 for this test
    tuition_head.base_amount = Decimal("60000.00")
    tuition_head.net_due = Decimal("60000.00")
    tuition_head.balance = Decimal("60000.00")
    db.commit()

    # Pay 59,999.00
    pay_in = PaymentCreate(
        student_id=student.id,
        physical_receipt_no="RCP-MANUAL-001",
        payment_mode="CASH",
        items=[
            PaymentItemCreate(
                fee_head_id=tuition_head.fee_head_id,
                amount=Decimal("59999.00")
            )
        ]
    )
    payment = record_payment(db, pay_in)
    assert payment.total_amount == Decimal("59999.00")

    # Check student tuition head balance
    db.refresh(tuition_head)
    assert tuition_head.paid_amount == Decimal("59999.00")
    assert tuition_head.balance == Decimal("1.00") # Exactly ₹1.00!


def test_event_fine_and_partial_payment(db):
    """Verifies levying event fines (Krishna Utsav, etc.) and partial payments."""
    student = Student(
        student_code="STU-FINE-01",
        full_name="Fine Tester",
        gender="MALE",
        category="OPEN",
        academic_year="2026-2027"
    )
    db.add(student)
    db.commit()

    # Apply Krishna Utsav fine of ₹500
    fine = apply_fine(db, FineCreate(
        student_id=student.id,
        event_name="Krishna Utsav Absence",
        amount=Decimal("500.00"),
        remarks="Did not attend event"
    ))
    assert fine.status == "UNPAID"
    assert fine.balance == Decimal("500.00")

    # Pay ₹200 towards the fine
    pay = record_payment(db, PaymentCreate(
        student_id=student.id,
        physical_receipt_no="RCP-FINE-01",
        payment_mode="CASH",
        items=[PaymentItemCreate(fine_id=fine.id, amount=Decimal("200.00"))]
    ))

    db.refresh(fine)
    assert fine.paid_amount == Decimal("200.00")
    assert fine.balance == Decimal("300.00")
    assert fine.status == "PARTIALLY_PAID"

    # Pay remaining ₹300
    pay2 = record_payment(db, PaymentCreate(
        student_id=student.id,
        physical_receipt_no="RCP-FINE-02",
        payment_mode="CASH",
        items=[PaymentItemCreate(fine_id=fine.id, amount=Decimal("300.00"))]
    ))
    db.refresh(fine)
    assert fine.balance == Decimal("0.00")
    assert fine.status == "PAID"


def test_authentication_and_password_security(db):
    """Tests password hashing security (bcrypt) and authentication token verification."""
    admin = db.query(User).filter(User.username == "admin_test").first()
    assert verify_password("adminpass", admin.password_hash) is True
    assert verify_password("wrongpass", admin.password_hash) is False

    # Token creation
    token = create_access_token({"sub": admin.username, "role": admin.role})
    assert isinstance(token, str)
    assert len(token) > 20


def test_excel_export_offline(db):
    """Verifies Excel reports can be generated without errors or external network dependencies."""
    student = Student(
        student_code="STU-EXP-01",
        full_name="Export Tester",
        gender="FEMALE",
        category="OPEN",
        academic_year="2026-2027"
    )
    db.add(student)
    db.commit()
    initialize_student_fees(student, db)

    # Generate Excel streams
    stream1 = export_daily_collection_excel(db, date.today(), date.today())
    assert stream1.getvalue() is not None
    assert len(stream1.getvalue()) > 1000  # Valid Excel file bytes

    stream2 = export_outstanding_dues_excel(db, "2026-2027")
    assert stream2.getvalue() is not None
    assert len(stream2.getvalue()) > 1000
