import threading
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
from ..schemas.payment import PaymentCreate, PaymentUpdate
from .fee_engine import quantize_amount, recalculate_student_balances
from .audit_service import log_audit

receipt_generation_lock = threading.Lock()

def generate_internal_receipt_no(db: Session, academic_year: str = "2026") -> str:
    with receipt_generation_lock:
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

    phys_receipt = (payment_in.physical_receipt_no or "").strip()
    if phys_receipt:
        existing_phys = db.query(Payment).filter(
            Payment.physical_receipt_no == phys_receipt,
            Payment.student_id == student.id
        ).first()
        if existing_phys:
            raise HTTPException(
                status_code=400,
                detail=f"Manual receipt book number '{phys_receipt}' has already been recorded for this student."
            )

    internal_receipt = generate_internal_receipt_no(db, student.academic_year)

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

    # Log audit trail
    log_audit(
        db,
        action="RECORD_PAYMENT",
        entity_name="payments",
        entity_id=payment.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": student.id,
            "student_code": student.student_code,
            "internal_receipt_no": internal_receipt,
            "physical_receipt_no": phys_receipt,
            "total_amount": str(total_amount),
            "payment_mode": mode
        }
    )

    # Recalculate student dues
    recalculate_student_balances(student.id, db)
    db.commit()
    db.refresh(payment)
    return payment


def update_payment(
    db: Session,
    payment_id: int,
    payment_in: PaymentUpdate,
    current_user: Optional[User] = None
) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment receipt not found")

    student_id = payment.student_id

    # Check physical receipt uniqueness if updating
    if payment_in.physical_receipt_no is not None:
        phys = (payment_in.physical_receipt_no or "").strip()
        if phys:
            existing = db.query(Payment).filter(
                Payment.physical_receipt_no == phys,
                Payment.student_id == student_id,
                Payment.id != payment.id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Manual receipt book number '{phys}' is already used by another receipt for this student."
                )
            payment.physical_receipt_no = phys
        else:
            payment.physical_receipt_no = None

    if payment_in.payment_date is not None:
        payment.payment_date = payment_in.payment_date
    if payment_in.entry_date is not None:
        payment.entry_date = payment_in.entry_date
    if payment_in.payment_mode is not None:
        payment.payment_mode = payment_in.payment_mode.upper().strip()
    if payment_in.remarks is not None:
        payment.remarks = payment_in.remarks.strip() if payment_in.remarks else None

    # Update line items if provided
    if payment_in.items is not None:
        if not payment_in.items:
            raise HTTPException(status_code=400, detail="Payment must have at least one line item")

        # Delete existing items
        db.query(PaymentItem).filter(PaymentItem.payment_id == payment.id).delete()

        total_amount = Decimal("0.00")
        for item_in in payment_in.items:
            amount = quantize_amount(item_in.amount)
            if amount <= Decimal("0.00"):
                continue

            if item_in.fee_head_id:
                sfh = db.query(StudentFeeHead).filter(
                    StudentFeeHead.student_id == student_id,
                    StudentFeeHead.fee_head_id == item_in.fee_head_id
                ).first()
                if not sfh:
                    raise HTTPException(status_code=400, detail=f"Fee head ID {item_in.fee_head_id} not assigned to student")

            if item_in.fine_id:
                fine = db.query(Fine).filter(Fine.id == item_in.fine_id, Fine.student_id == student_id).first()
                if not fine:
                    raise HTTPException(status_code=400, detail=f"Fine ID {item_in.fine_id} not found for student")

            p_item = PaymentItem(
                payment_id=payment.id,
                fee_head_id=item_in.fee_head_id,
                fine_id=item_in.fine_id,
                amount=amount
            )
            db.add(p_item)
            total_amount += amount

        if total_amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Total payment amount must be greater than zero")
        payment.total_amount = total_amount

    db.flush()

    log_audit(
        db,
        action="UPDATE_PAYMENT",
        entity_name="payments",
        entity_id=payment.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": student_id,
            "student_code": payment.student.student_code if payment.student else None,
            "internal_receipt_no": payment.internal_receipt_no,
            "physical_receipt_no": payment.physical_receipt_no,
            "total_amount": str(payment.total_amount),
            "payment_mode": payment.payment_mode
        }
    )

    recalculate_student_balances(student_id, db)
    db.commit()
    db.refresh(payment)
    return payment


def delete_payment(
    db: Session,
    payment_id: int,
    current_user: Optional[User] = None
) -> dict:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment receipt not found")

    student_id = payment.student_id

    log_audit(
        db,
        action="DELETE_PAYMENT",
        entity_name="payments",
        entity_id=payment.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": student_id,
            "student_code": payment.student.student_code if payment.student else None,
            "internal_receipt_no": payment.internal_receipt_no,
            "physical_receipt_no": payment.physical_receipt_no,
            "total_amount": str(payment.total_amount),
            "payment_date": str(payment.payment_date)
        }
    )

    db.delete(payment)
    db.flush()

    recalculate_student_balances(student_id, db)
    db.commit()
    return {"message": "Payment receipt deleted successfully", "id": payment_id, "student_id": student_id}

