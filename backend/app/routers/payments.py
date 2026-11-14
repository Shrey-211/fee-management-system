from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.payment import Payment
from ..models.user import User
from ..schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse
from ..auth import get_current_user, require_accountant_or_admin
from ..services.payment_service import record_payment, update_payment, delete_payment

router = APIRouter(prefix="/api/payments", tags=["Payments"])

def serialize_payment(p: Payment) -> dict:
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
    return {
        "id": p.id,
        "internal_receipt_no": p.internal_receipt_no,
        "physical_receipt_no": p.physical_receipt_no,
        "student_id": p.student_id,
        "student_name": p.student.full_name if p.student else "Unknown",
        "student_code": p.student.student_code if p.student else "N/A",
        "student_category": p.student.category if p.student else None,
        "student_course": p.student.course_branch if p.student else None,
        "student_academic_year": p.student.academic_year if p.student else None,
        "payment_date": p.payment_date,
        "entry_date": p.entry_date,
        "payment_mode": p.payment_mode,
        "total_amount": p.total_amount,
        "remarks": p.remarks,
        "created_at": p.created_at,
        "items": items
    }

@router.get("", response_model=List[PaymentResponse])
def get_payments(
    student_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    payment_mode: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Payment)
    if student_id:
        query = query.filter(Payment.student_id == student_id)
    if start_date:
        query = query.filter(Payment.payment_date >= start_date)
    if end_date:
        query = query.filter(Payment.payment_date <= end_date)
    if payment_mode:
        query = query.filter(Payment.payment_mode == payment_mode.upper().strip())

    payments = query.order_by(Payment.payment_date.desc(), Payment.id.desc()).all()
    return [serialize_payment(p) for p in payments]

@router.post("", response_model=PaymentResponse)
def create_payment(
    payment_in: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    payment = record_payment(db, payment_in, current_user=current_user)
    return serialize_payment(payment)

@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    p = db.query(Payment).filter(Payment.id == payment_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payment receipt not found")
    return serialize_payment(p)

@router.put("/{payment_id}", response_model=PaymentResponse)
def edit_payment(
    payment_id: int,
    payment_in: PaymentUpdate,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    payment = update_payment(db, payment_id, payment_in, current_user=current_user)
    return serialize_payment(payment)

@router.delete("/{payment_id}")
def remove_payment(
    payment_id: int,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    return delete_payment(db, payment_id, current_user=current_user)
