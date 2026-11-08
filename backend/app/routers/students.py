from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.student import Student
from ..models.user import User
from ..schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentDetailResponse
from ..auth import get_current_user
from ..services.fee_engine import (
    initialize_student_fees, recalculate_student_balances, quantize_amount
)

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
        "course_branch": student.course_branch,
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
        "overall_balance": overall_balance
    }

@router.get("", response_model=List[StudentResponse])
def get_students(
    search: Optional[str] = Query(None, description="Search by name, code or mobile"),
    category: Optional[str] = None,
    gender: Optional[str] = None,
    academic_year: Optional[str] = None,
    has_dues_only: Optional[bool] = False,
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

    students = query.order_by(Student.full_name.asc()).all()
    results = [build_student_response(s) for s in students]

    if has_dues_only:
        results = [r for r in results if r["overall_balance"] > Decimal("0.00")]

    return results

@router.post("", response_model=StudentResponse)
def create_student(
    student_in: StudentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Student).filter(Student.student_code == student_in.student_code.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student Code / Roll Number already exists")

    student = Student(
        student_code=student_in.student_code.strip().upper(),
        full_name=student_in.full_name.strip(),
        dob=student_in.dob,
        gender=student_in.gender.strip().upper(),
        category=student_in.category.strip().upper(),
        concession_type_id=student_in.concession_type_id,
        mobile_number=student_in.mobile_number.strip() if student_in.mobile_number else None,
        email_address=student_in.email_address.strip() if student_in.email_address else None,
        address=student_in.address,
        academic_year=student_in.academic_year.strip(),
        course_branch=student_in.course_branch,
        current_year=student_in.current_year,
        is_active=True
    )
    db.add(student)
    db.flush()

    # Automatically initialize fee heads and apply waiver rules
    initialize_student_fees(student, db)
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
            "waiver_reason": sfh.waiver_reason
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
    scholarships = [
        {
            "id": sc.id,
            "student_id": sc.student_id,
            "student_name": student.full_name,
            "student_code": student.student_code,
            "fee_head_id": sc.fee_head_id,
            "fee_head_name": sc.fee_head.name if sc.fee_head else None,
            "scholarship_name": sc.scholarship_name,
            "sanction_order_no": sc.sanction_order_no,
            "credit_date": sc.credit_date,
            "amount": sc.amount,
            "remarks": sc.remarks,
            "created_at": sc.created_at
        }
        for sc in student.scholarships
    ]

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
        student.mobile_number = student_in.mobile_number.strip()
    if student_in.email_address is not None:
        student.email_address = student_in.email_address.strip()
    if student_in.address is not None:
        student.address = student_in.address
    if student_in.academic_year is not None:
        student.academic_year = student_in.academic_year.strip()
    if student_in.course_branch is not None:
        student.course_branch = student_in.course_branch
    if student_in.current_year is not None:
        student.current_year = student_in.current_year
    if student_in.is_active is not None:
        student.is_active = student_in.is_active

    if category_or_gender_changed:
        # Re-apply waiver logic and update student fee heads
        initialize_student_fees(student, db)

    db.commit()
    recalculate_student_balances(student.id, db)
    db.refresh(student)
    return build_student_response(student)

