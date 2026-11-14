from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.scholarship import ScholarshipCredit
from ..models.student import Student
from ..models.fee import FeeHead
from ..models.user import User
from ..schemas.scholarship import (
    ScholarshipCreditCreate,
    ScholarshipCreditResponse,
    MarkScholarshipReceivedRequest
)
from ..auth import get_current_user, require_accountant_or_admin
from ..services.fee_engine import quantize_amount, recalculate_student_balances
from ..services.audit_service import log_audit


router = APIRouter(prefix="/api/scholarships", tags=["Scholarships"])

def serialize_scholarship(sc: ScholarshipCredit) -> dict:
    return {
        "id": sc.id,
        "student_id": sc.student_id,
        "student_name": sc.student.full_name if sc.student else "Unknown",
        "student_code": sc.student.student_code if sc.student else "N/A",
        "student_category": sc.student.category if sc.student else "N/A",
        "academic_year": sc.student.academic_year if sc.student else "N/A",
        "fee_head_id": sc.fee_head_id,
        "fee_head_name": sc.fee_head.name if sc.fee_head else "General Tuition/Dev",
        "scholarship_name": sc.scholarship_name,
        "sanction_order_no": sc.sanction_order_no,
        "credit_date": sc.credit_date,
        "amount": sc.amount,
        "status": getattr(sc, 'status', 'NOT_RECEIVED'),
        "remarks": sc.remarks or ("Not Received" if getattr(sc, 'status', 'NOT_RECEIVED') != "RECEIVED" else None),
        "created_at": sc.created_at
    }

@router.get("", response_model=List[ScholarshipCreditResponse])
def get_scholarships(
    student_id: Optional[int] = None,
    status: Optional[str] = Query(None, description="RECEIVED or NOT_RECEIVED"),
    search: Optional[str] = Query(None, description="Search by student name or scholarship"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ScholarshipCredit).join(Student, ScholarshipCredit.student_id == Student.id)
    if student_id:
        query = query.filter(ScholarshipCredit.student_id == student_id)
    if status:
        query = query.filter(ScholarshipCredit.status == status.upper().strip())
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(
            Student.full_name.ilike(s),
            Student.student_code.ilike(s),
            ScholarshipCredit.scholarship_name.ilike(s),
            ScholarshipCredit.sanction_order_no.ilike(s)
        ))
    
    # Sort NOT_RECEIVED first, then by id desc
    credits = query.order_by(ScholarshipCredit.id.desc()).all()
    # Sort so NOT_RECEIVED are easily prominent if viewing all
    credits.sort(key=lambda x: 0 if getattr(x, 'status', 'NOT_RECEIVED') == 'NOT_RECEIVED' else 1)
    return [serialize_scholarship(sc) for sc in credits]

@router.post("", response_model=ScholarshipCreditResponse)
def create_scholarship(
    sc_in: ScholarshipCreditCreate,
    current_user: User = Depends(require_accountant_or_admin),
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

    status = (sc_in.status or "NOT_RECEIVED").upper().strip()
    credit_date = sc_in.credit_date
    if status == "RECEIVED" and not credit_date:
        credit_date = date.today()

    sc = ScholarshipCredit(
        student_id=student.id,
        fee_head_id=sc_in.fee_head_id,
        scholarship_name=sc_in.scholarship_name.strip(),
        sanction_order_no=sc_in.sanction_order_no,
        credit_date=credit_date,
        amount=amount,
        status=status,
        remarks=sc_in.remarks or ("Not Received" if status != "RECEIVED" else None)
    )
    db.add(sc)
    db.flush()

    log_audit(
        db,
        action="CREDIT_SCHOLARSHIP",
        entity_name="scholarships",
        entity_id=sc.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": student.id,
            "student_code": student.student_code,
            "scholarship_name": sc.scholarship_name,
            "amount": str(sc.amount),
            "status": sc.status
        }
    )
    db.commit()
    recalculate_student_balances(student.id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)

@router.put("/{scholarship_id}/mark-received", response_model=ScholarshipCreditResponse)
def mark_scholarship_received(
    scholarship_id: int,
    req: MarkScholarshipReceivedRequest,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    sc = db.query(ScholarshipCredit).filter(ScholarshipCredit.id == scholarship_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scholarship record not found")

    sc.status = "RECEIVED"
    sc.credit_date = req.credit_date or date.today()
    if req.sanction_order_no:
        sc.sanction_order_no = req.sanction_order_no.strip()
    if req.remarks:
        sc.remarks = req.remarks.strip()
    else:
        sc.remarks = f"Disbursed by Government on {sc.credit_date}"

    log_audit(
        db,
        action="SCHOLARSHIP_RECEIVED",
        entity_name="scholarships",
        entity_id=sc.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": sc.student_id,
            "amount": str(sc.amount),
            "sanction_order_no": sc.sanction_order_no,
            "credit_date": str(sc.credit_date)
        }
    )
    db.commit()
    recalculate_student_balances(sc.student_id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)

@router.put("/{scholarship_id}/mark-pending", response_model=ScholarshipCreditResponse)
def mark_scholarship_pending(
    scholarship_id: int,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    sc = db.query(ScholarshipCredit).filter(ScholarshipCredit.id == scholarship_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scholarship record not found")

    sc.status = "NOT_RECEIVED"
    sc.credit_date = None
    sc.remarks = "Not Received"

    log_audit(
        db,
        action="SCHOLARSHIP_PENDING",
        entity_name="scholarships",
        entity_id=sc.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": sc.student_id,
            "amount": str(sc.amount)
        }
    )
    db.commit()
    recalculate_student_balances(sc.student_id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)


