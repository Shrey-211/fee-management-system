from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.student import Student
from ..models.user import User
from ..schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentDetailResponse
from ..auth import get_current_user, require_accountant_or_admin
from ..services.fee_engine import (
    initialize_student_fees, recalculate_student_balances, quantize_amount
)
from ..services.audit_service import log_audit


router = APIRouter(prefix="/api/students", tags=["Students"])

def build_student_response(student: Student) -> dict:
    total_fee = sum([quantize_amount(h.base_amount) for h in student.fee_heads], Decimal("0.00"))
    total_waiver = sum([quantize_amount(h.discount_amount) for h in student.fee_heads], Decimal("0.00"))
    net_fee_due = sum([quantize_amount(h.net_due) for h in student.fee_heads], Decimal("0.00"))
    total_fee_paid = sum([quantize_amount(h.paid_amount) for h in student.fee_heads], Decimal("0.00"))
    fee_balance = sum([quantize_amount(h.balance) for h in student.fee_heads], Decimal("0.00"))

    active_fines = [f for f in student.fines if f.status != "WAIVED"]
    total_fines = sum([quantize_amount(f.amount) for f in active_fines], Decimal("0.00"))
    total_fines_paid = sum([quantize_amount(f.paid_amount) for f in active_fines], Decimal("0.00"))
    total_fines_balance = sum([quantize_amount(f.balance) for f in active_fines], Decimal("0.00"))

    overall_balance = quantize_amount(fee_balance + total_fines_balance)

    year_1_dues = sum([
        quantize_amount(h.balance) for h in student.fee_heads
        if getattr(h.fee_head, 'year_of_study', 1) == 1
    ], Decimal("0.00"))

    year_2_dues = sum([
        quantize_amount(h.balance) for h in student.fee_heads
        if getattr(h.fee_head, 'year_of_study', 1) == 2
    ], Decimal("0.00"))

    # Scholarship calculations
    student_scholarships = getattr(student, 'scholarships', []) or []
    scholarship_total = sum([quantize_amount(s.amount) for s in student_scholarships], Decimal("0.00"))
    scholarship_received = sum([
        quantize_amount(getattr(s, 'received_amount', None) or (s.amount if (getattr(s, 'status', None) or '').strip().upper() == "RECEIVED" else Decimal("0.00")))
        for s in student_scholarships
    ], Decimal("0.00"))
    scholarship_pending = quantize_amount(max(Decimal("0.00"), scholarship_total - scholarship_received))

    if scholarship_total > Decimal("0.00"):
        if scholarship_pending <= Decimal("0.00"):
            scholarship_status = "RECEIVED"
        elif scholarship_received > Decimal("0.00"):
            scholarship_status = "PARTIAL"
        else:
            scholarship_status = "NOT_RECEIVED"
    else:
        scholarship_status = "NONE"

    return {
        "id": student.id,
        "student_code": student.student_code,
        "full_name": student.full_name,
        "dob": student.dob,
        "gender": student.gender,
        "category": student.category,
        "mobile_number": student.mobile_number,
        "email_address": student.email_address,
        "address": student.address,
        "academic_year": student.academic_year,
        "course_branch": student.course_branch or "MBA",
        "current_year": student.current_year,
        "concession_type_id": student.concession_type_id,
        "concession_type_name": student.concession_type.name if student.concession_type else None,
        "is_active": student.is_active,
        "created_at": student.created_at,
        "total_fee": total_fee,
        "total_waiver": total_waiver,
        "net_fee_due": net_fee_due,
        "total_fee_paid": total_fee_paid,
        "total_fines": total_fines,
        "total_fines_paid": total_fines_paid,
        "total_fines_balance": total_fines_balance,
        "year_1_dues": year_1_dues,
        "year_2_dues": year_2_dues,
        "overall_balance": overall_balance,
        "scholarship_total": scholarship_total,
        "scholarship_received": scholarship_received,
        "scholarship_pending": scholarship_pending,
        "scholarship_status": scholarship_status
    }

@router.get("", response_model=List[StudentResponse])
def get_students(
    search: Optional[str] = Query(None, description="Search by name, code or mobile"),
    category: Optional[str] = None,
    gender: Optional[str] = None,
    academic_year: Optional[str] = None,
    current_year: Optional[int] = Query(None, description="Filter by year: 1 (1st Year), 2 (2nd Year), 3 (Passed Out)"),
    has_dues_only: Optional[bool] = False,
    scholarship_status: Optional[str] = Query(None, description="RECEIVED, PARTIAL, NOT_RECEIVED, HAS_SCHOLARSHIP, NONE"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Student).filter(Student.is_active == True)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(
            Student.student_code.ilike(s),
            Student.full_name.ilike(s),
            Student.mobile_number.ilike(s)
        ))
    if category:
        query = query.filter(Student.category == category.upper().strip())
    if gender:
        query = query.filter(Student.gender == gender.upper().strip())
    if academic_year:
        query = query.filter(Student.academic_year == academic_year.strip())
    if current_year is not None:
        query = query.filter(Student.current_year == current_year)

    students = query.order_by(Student.full_name.asc()).all()
    results = [build_student_response(s) for s in students]

    if has_dues_only:
        results = [r for r in results if r["overall_balance"] > Decimal("0.00")]

    if scholarship_status:
        st = scholarship_status.strip().upper()
        if st == "RECEIVED":
            results = [r for r in results if r["scholarship_status"] == "RECEIVED"]
        elif st == "PARTIAL":
            results = [r for r in results if r["scholarship_status"] == "PARTIAL"]
        elif st == "NOT_RECEIVED":
            results = [r for r in results if r["scholarship_status"] == "NOT_RECEIVED"]
        elif st == "HAS_SCHOLARSHIP":
            results = [r for r in results if r["scholarship_status"] != "NONE"]
        elif st == "NONE":
            results = [r for r in results if r["scholarship_status"] == "NONE"]

    return results

@router.post("", response_model=StudentResponse)
def create_student(
    student_in: StudentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    academic_year = (student_in.academic_year or settings.DEFAULT_ACADEMIC_YEAR).strip()
    clean_ay = academic_year.replace("/", "-")
    course_branch = (student_in.course_branch or "MBA").strip()
    course_prefix = course_branch.upper().replace(" ", "")[:4] or "MBA"

    # Handle roll number / student code: auto-generate if empty or whitespace
    if not student_in.student_code or not student_in.student_code.strip():
        # Generate format: {COURSE}-{AY}-{0001}
        count = db.query(Student).filter(Student.academic_year == academic_year).count() + 1
        generated_code = f"{course_prefix}-{clean_ay}-{count:04d}"
        while db.query(Student).filter(Student.student_code == generated_code).first():
            count += 1
            generated_code = f"{course_prefix}-{clean_ay}-{count:04d}"
        student_code = generated_code
    else:
        student_code = student_in.student_code.strip().upper()
        existing = db.query(Student).filter(Student.student_code == student_code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Student Code / Roll Number already exists")

    if student_in.mobile_number is not None and not student_in.mobile_number.strip():
        raise HTTPException(status_code=400, detail="Mobile / Phone number cannot be blank.")

    student = Student(
        student_code=student_code,
        full_name=student_in.full_name.strip(),
        dob=student_in.dob,
        gender=student_in.gender.strip().upper(),
        category=student_in.category.strip().upper(),
        concession_type_id=student_in.concession_type_id,
        mobile_number=student_in.mobile_number.strip() if student_in.mobile_number else None,
        email_address=student_in.email_address.strip() if student_in.email_address else None,
        address=student_in.address,
        academic_year=academic_year,
        course_branch=course_branch,
        current_year=student_in.current_year or 1,
        is_active=True
    )
    db.add(student)
    db.flush()

    # Automatically initialize fee heads and apply waiver rules
    initialize_student_fees(student, db)

    log_audit(
        db,
        action="CREATE_STUDENT",
        entity_name="students",
        entity_id=student.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_code": student.student_code,
            "full_name": student.full_name,
            "category": student.category,
            "gender": student.gender,
            "academic_year": student.academic_year
        }
    )

    db.commit()
    db.refresh(student)
    return build_student_response(student)

@router.get("/{student_id}", response_model=StudentDetailResponse)
def get_student_detail(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    base_resp = build_student_response(student)

    # Fee heads
    fee_heads = [
        {
            "id": sfh.id,
            "fee_head_id": sfh.fee_head_id,
            "name": sfh.fee_head.name if sfh.fee_head else "Unknown",
            "code": sfh.fee_head.code if sfh.fee_head else "N/A",
            "base_amount": sfh.base_amount,
            "discount_percent": sfh.discount_percent,
            "discount_amount": sfh.discount_amount,
            "net_due": sfh.net_due,
            "paid_amount": sfh.paid_amount,
            "balance": sfh.balance,
            "waiver_reason": sfh.waiver_reason,
            "year_of_study": getattr(sfh.fee_head, 'year_of_study', 1) if sfh.fee_head else 1,
            "is_first_year_arrear": bool(
                (student.current_year or 1) >= 2 and
                sfh.fee_head and getattr(sfh.fee_head, 'year_of_study', 1) == 1 and
                quantize_amount(sfh.balance) > Decimal("0.00")
            )
        }
        for sfh in student.fee_heads
    ]

    # Payments
    payments = []
    for p in sorted(student.payments, key=lambda x: x.payment_date, reverse=True):
        items = [
            {
                "id": itm.id,
                "fee_head_id": itm.fee_head_id,
                "fee_head_name": itm.fee_head.name if itm.fee_head else None,
                "fine_id": itm.fine_id,
                "fine_event_name": itm.fine.event_name if itm.fine else None,
                "amount": itm.amount
            }
            for itm in p.items
        ]
        payments.append({
            "id": p.id,
            "internal_receipt_no": p.internal_receipt_no,
            "physical_receipt_no": p.physical_receipt_no,
            "student_id": p.student_id,
            "student_name": student.full_name,
            "student_code": student.student_code,
            "student_category": student.category,
            "student_course": student.course_branch,
            "student_academic_year": student.academic_year,
            "payment_date": p.payment_date,
            "entry_date": p.entry_date,
            "payment_mode": p.payment_mode,
            "total_amount": p.total_amount,
            "remarks": p.remarks,
            "created_at": p.created_at,
            "items": items
        })

    # Fines
    fines = [
        {
            "id": f.id,
            "student_id": f.student_id,
            "student_name": student.full_name,
            "student_code": student.student_code,
            "event_name": f.event_name,
            "amount": f.amount,
            "fine_date": f.fine_date,
            "status": f.status,
            "paid_amount": f.paid_amount,
            "balance": f.balance,
            "remarks": f.remarks,
            "created_at": f.created_at
        }
        for f in student.fines
    ]

    # Scholarships
    scholarships = []
    for sc in student.scholarships:
        amt = quantize_amount(sc.amount)
        rec = quantize_amount(getattr(sc, 'received_amount', None) or (amt if getattr(sc, 'status', None) == 'RECEIVED' else Decimal("0.00")))
        rem = quantize_amount(max(Decimal("0.00"), amt - rec))
        if rec <= Decimal("0.00"):
            st = "NOT_RECEIVED"
        elif rec >= amt:
            st = "RECEIVED"
        else:
            st = "PARTIALLY_RECEIVED"

        disb_list = [
            {
                "id": d.id,
                "scholarship_id": d.scholarship_id,
                "amount": quantize_amount(d.amount),
                "disbursement_date": d.disbursement_date,
                "sanction_order_no": d.sanction_order_no,
                "remarks": d.remarks,
                "created_at": d.created_at
            }
            for d in (getattr(sc, 'disbursements', []) or [])
        ]

        scholarships.append({
            "id": sc.id,
            "student_id": sc.student_id,
            "student_name": student.full_name,
            "student_code": student.student_code,
            "student_category": student.category,
            "academic_year": student.academic_year,
            "fee_head_id": sc.fee_head_id,
            "fee_head_name": sc.fee_head.name if sc.fee_head else "General Tuition/Dev",
            "scholarship_name": sc.scholarship_name,
            "sanction_order_no": sc.sanction_order_no,
            "credit_date": sc.credit_date,
            "amount": amt,
            "received_amount": rec,
            "remaining_amount": rem,
            "status": st,
            "remarks": sc.remarks or ("Not Received" if st == "NOT_RECEIVED" else (f"Partially Received (₹{rec})" if st == "PARTIALLY_RECEIVED" else "Received")),
            "created_at": sc.created_at,
            "disbursements": disb_list
        })

    base_resp.update({
        "fee_heads": fee_heads,
        "payments": payments,
        "fines": fines,
        "scholarships": scholarships
    })
    return base_resp

@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    student_in: StudentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    category_or_gender_changed = False

    # Check permission if altering concession type, category, or gender which impact fees
    changing_waiver_factors = (
        (student_in.category is not None and student_in.category.strip().upper() != student.category) or
        (student_in.gender is not None and student_in.gender.strip().upper() != student.gender) or
        (student_in.concession_type_id is not None and student_in.concession_type_id != student.concession_type_id)
    )
    if changing_waiver_factors and current_user.role.lower() not in ["admin", "accountant"]:
        raise HTTPException(
            status_code=403,
            detail="Accountant or Admin privileges required to alter student category, gender, or concession quota"
        )

    if student_in.student_code is not None:
        student.student_code = student_in.student_code.strip().upper()
    if student_in.full_name is not None:
        student.full_name = student_in.full_name.strip()
    if student_in.dob is not None:
        student.dob = student_in.dob
    if student_in.gender is not None and student_in.gender.strip().upper() != student.gender:
        student.gender = student_in.gender.strip().upper()
        category_or_gender_changed = True
    if student_in.category is not None and student_in.category.strip().upper() != student.category:
        student.category = student_in.category.strip().upper()
        category_or_gender_changed = True
    if student_in.concession_type_id is not None and student_in.concession_type_id != student.concession_type_id:
        student.concession_type_id = student_in.concession_type_id if student_in.concession_type_id != 0 else None
        category_or_gender_changed = True
    if student_in.mobile_number is not None:
        if not student_in.mobile_number.strip():
            raise HTTPException(status_code=400, detail="Mobile / Phone number cannot be blank.")
        student.mobile_number = student_in.mobile_number.strip()
    if student_in.email_address is not None:
        student.email_address = student_in.email_address.strip()
    if student_in.address is not None:
        student.address = student_in.address
    academic_year_changed = False
    if student_in.academic_year is not None and student_in.academic_year.strip() != student.academic_year:
        student.academic_year = student_in.academic_year.strip()
        academic_year_changed = True
    if student_in.course_branch is not None:
        student.course_branch = student_in.course_branch
    if student_in.current_year is not None:
        student.current_year = student_in.current_year
    if student_in.is_active is not None:
        student.is_active = student_in.is_active

    if category_or_gender_changed or academic_year_changed:
        # Re-apply waiver logic and update student fee heads
        initialize_student_fees(student, db)

    log_audit(
        db,
        action="UPDATE_STUDENT",
        entity_name="students",
        entity_id=student.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_code": student.student_code,
            "category_or_gender_changed": category_or_gender_changed
        }
    )

    db.commit()
    recalculate_student_balances(student.id, db)
    db.refresh(student)
    return build_student_response(student)


@router.post("/{student_id}/promote", response_model=StudentDetailResponse)
def promote_student(
    student_id: int,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    cur_year = student.current_year or 1
    if cur_year == 1:
        student.current_year = 2
        # Assign 2nd Year Fee Heads while keeping 1st Year heads and unpaid balances
        initialize_student_fees(student, db)
        log_audit(
            db,
            action="PROMOTE_STUDENT",
            entity_name="students",
            entity_id=student.id,
            user_id=current_user.id,
            details={
                "student_code": student.student_code,
                "from_year": 1,
                "to_year": 2
            }
        )
    elif cur_year == 2:
        student.current_year = 3  # 3 = Passed Out
        log_audit(
            db,
            action="GRADUATE_STUDENT",
            entity_name="students",
            entity_id=student.id,
            user_id=current_user.id,
            details={
                "student_code": student.student_code,
                "from_year": 2,
                "status": "PASSED_OUT"
            }
        )
    db.commit()
    recalculate_student_balances(student.id, db)
    return get_student_detail(student.id, current_user=current_user, db=db)


