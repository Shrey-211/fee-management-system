from datetime import date
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.fine import Fine
from ..models.student import Student
from ..models.user import User
from ..schemas.fine import FineCreate, FineUpdate
from .fee_engine import quantize_amount, recalculate_student_balances

def apply_fine(
    db: Session,
    fine_in: FineCreate,
    current_user: Optional[User] = None
) -> Fine:
    student = db.query(Student).filter(Student.id == fine_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    amount = quantize_amount(fine_in.amount)
    if amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Fine amount must be greater than zero")

    fine = Fine(
        student_id=student.id,
        event_name=fine_in.event_name.strip(),
        amount=amount,
        fine_date=fine_in.fine_date or date.today(),
        status="UNPAID",
        paid_amount=Decimal("0.00"),
        balance=amount,
        remarks=fine_in.remarks,
        created_by_id=current_user.id if current_user else None
    )
    db.add(fine)
    db.commit()
    db.refresh(fine)

    recalculate_student_balances(student.id, db)
    return fine


def update_fine_status(
    db: Session,
    fine_id: int,
    fine_in: FineUpdate,
    current_user: Optional[User] = None
) -> Fine:
    fine = db.query(Fine).filter(Fine.id == fine_id).first()
    if not fine:
        raise HTTPException(status_code=404, detail="Fine not found")

    if fine_in.event_name is not None:
        fine.event_name = fine_in.event_name.strip()
    if fine_in.amount is not None:
        fine.amount = quantize_amount(fine_in.amount)
    if fine_in.remarks is not None:
        fine.remarks = fine_in.remarks
    if fine_in.status is not None:
        st = fine_in.status.upper().strip()
        fine.status = st
        if st == "WAIVED":
            fine.balance = Decimal("0.00")

    db.commit()
    recalculate_student_balances(fine.student_id, db)
    db.refresh(fine)
    return fine

