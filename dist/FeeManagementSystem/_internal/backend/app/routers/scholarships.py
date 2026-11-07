from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.scholarship import ScholarshipCredit
from ..models.student import Student
from ..models.fee import FeeHead
from ..models.user import User
from ..schemas.scholarship import ScholarshipCreditCreate, ScholarshipCreditResponse
from ..auth import get_current_user
from ..services.fee_engine import quantize_amount, recalculate_student_balances

router = APIRouter(prefix="/api/scholarships", tags=["Scholarships"])

def serialize_scholarship(sc: ScholarshipCredit) -> dict:
    return {
        "id": sc.id,
        "student_id": sc.student_id,
        "student_name": sc.student.full_name if sc.student else "Unknown",
        "student_code": sc.student.student_code if sc.student else "N/A",
        "fee_head_id": sc.fee_head_id,
        "fee_head_name": sc.fee_head.name if sc.fee_head else "General Tuition/Dev",
        "scholarship_name": sc.scholarship_name,
        "sanction_order_no": sc.sanction_order_no,
        "credit_date": sc.credit_date,
        "amount": sc.amount,
        "remarks": sc.remarks,
        "created_at": sc.created_at
    }

@router.get("", response_model=List[ScholarshipCreditResponse])
def get_scholarships(
    student_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ScholarshipCredit)
    if student_id:
        query = query.filter(ScholarshipCredit.student_id == student_id)
    credits = query.order_by(ScholarshipCredit.credit_date.desc(), ScholarshipCredit.id.desc()).all()
    return [serialize_scholarship(sc) for sc in credits]

@router.post("", response_model=ScholarshipCreditResponse)
def create_scholarship(
    sc_in: ScholarshipCreditCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == sc_in.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    amount = quantize_amount(sc_in.amount)
    if amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Scholarship credit amount must be greater than zero")

    # If fee_head_id provided, verify
    if sc_in.fee_head_id:
        fh = db.query(FeeHead).filter(FeeHead.id == sc_in.fee_head_id).first()
        if not fh:
            raise HTTPException(status_code=404, detail="Fee Head not found")

    sc = ScholarshipCredit(
        student_id=student.id,
        fee_head_id=sc_in.fee_head_id,
        scholarship_name=sc_in.scholarship_name.strip(),
        sanction_order_no=sc_in.sanction_order_no,
        credit_date=sc_in.credit_date or date.today(),
        amount=amount,
        remarks=sc_in.remarks
    )
    db.add(sc)
    db.commit()
    recalculate_student_balances(student.id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)
