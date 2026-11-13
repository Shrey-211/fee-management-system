from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status
from ..models.payment import Payment, PaymentItem
from ..models.student import Student
from ..models.fee import StudentFeeHead
from ..models.fine import Fine
from ..models.user import User
from ..schemas.payment import PaymentCreate
from .fee_engine import quantize_amount, recalculate_student_balances

def generate_internal_receipt_no(db: Session, academic_year: str = "2026") -> str:
    current_year_prefix = academic_year.split("-")[0] if "-" in academic_year else academic_year
    prefix = f"RCP-{current_year_prefix}-"
    last_payment = db.query(Payment).filter(Payment.internal_receipt_no.like(f"{prefix}%")).order_by(Payment.id.desc()).first()
    
    if last_payment and last_payment.internal_receipt_no:
        try:
            last_seq = int(last_payment.internal_receipt_no.replace(prefix, ""))
            next_seq = last_seq + 1
        except ValueError:
            next_seq = 1
    else:
        next_seq = 1
        
    return f"{prefix}{next_seq:05d}"


def record_payment(
    db: Session,
    payment_in: PaymentCreate,
    current_user: Optional[User] = None
) -> Payment:
    student = db.query(Student).filter(Student.id == payment_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not payment_in.items:
        raise HTTPException(status_code=400, detail="At least one payment item must be specified")

    # Compute total amount from items
    total_amount = sum([quantize_amount(item.amount) for item in payment_in.items], Decimal("0.00"))
    if total_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Total payment amount must be greater than zero")

    # Clean dates
    pay_date = payment_in.payment_date or date.today()
    ent_date = payment_in.entry_date or date.today()
    mode = payment_in.payment_mode.upper().strip()

    internal_receipt = generate_internal_receipt_no(db, student.academic_year)
    phys_receipt = (payment_in.physical_receipt_no or "").strip()

    payment = Payment(
        internal_receipt_no=internal_receipt,
        physical_receipt_no=phys_receipt,
        student_id=student.id,
        payment_date=pay_date,
        entry_date=ent_date,
        payment_mode=mode,
        total_amount=total_amount,
        recorded_by_id=current_user.id if current_user else None,
        remarks=payment_in.remarks
    )
    db.add(payment)
    db.flush()

    # Add items
    for item_in in payment_in.items:
        amount = quantize_amount(item_in.amount)
        if amount <= Decimal("0.00"):
            continue
            
        if item_in.fee_head_id:
            # Check fee head belongs to student
            sfh = db.query(StudentFeeHead).filter(
                StudentFeeHead.student_id == student.id,
                StudentFeeHead.fee_head_id == item_in.fee_head_id
            ).first()
            if not sfh:
                raise HTTPException(status_code=400, detail=f"Fee head ID {item_in.fee_head_id} not assigned to student")

        if item_in.fine_id:
            fine = db.query(Fine).filter(Fine.id == item_in.fine_id, Fine.student_id == student.id).first()
            if not fine:
                raise HTTPException(status_code=400, detail=f"Fine ID {item_in.fine_id} not found for student")

        p_item = PaymentItem(
            payment_id=payment.id,
            fee_head_id=item_in.fee_head_id,
            fine_id=item_in.fine_id,
            amount=amount
        )
        db.add(p_item)

    db.flush()
    # Recalculate student dues
    recalculate_student_balances(student.id, db)
    db.commit()
    db.refresh(payment)
    return payment
