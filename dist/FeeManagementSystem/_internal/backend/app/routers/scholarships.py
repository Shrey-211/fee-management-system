from typing import List, Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.scholarship import ScholarshipCredit, ScholarshipDisbursement
from ..models.student import Student
from ..models.fee import FeeHead
from ..models.user import User
from ..schemas.scholarship import (
    ScholarshipCreditCreate,
    ScholarshipCreditResponse,
    MarkScholarshipReceivedRequest,
    ScholarshipDisbursementResponse
)
from ..auth import get_current_user, require_accountant_or_admin
from ..services.fee_engine import quantize_amount, recalculate_student_balances
from ..services.audit_service import log_audit
from ..services.report_service import export_scholarships_excel


router = APIRouter(prefix="/api/scholarships", tags=["Scholarships"])

def serialize_scholarship(sc: ScholarshipCredit) -> dict:
    amt = quantize_amount(sc.amount)
    rec = quantize_amount(getattr(sc, 'received_amount', None) or (amt if getattr(sc, 'status', None) == 'RECEIVED' else Decimal("0.00")))
    rem = quantize_amount(max(Decimal("0.00"), amt - rec))

    if rec <= Decimal("0.00"):
        st = "NOT_RECEIVED"
    elif rec >= amt:
        st = "RECEIVED"
    else:
        st = "PARTIALLY_RECEIVED"

    disb_list = []
    for d in (getattr(sc, 'disbursements', []) or []):
        disb_list.append({
            "id": d.id,
            "scholarship_id": d.scholarship_id,
            "payment_id": getattr(d, 'payment_id', None),
            "receipt_no": d.payment.internal_receipt_no if getattr(d, 'payment', None) else None,
            "amount": quantize_amount(d.amount),
            "disbursement_date": d.disbursement_date,
            "sanction_order_no": d.sanction_order_no,
            "remarks": d.remarks,
            "created_at": d.created_at
        })

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
        "amount": amt,
        "received_amount": rec,
        "remaining_amount": rem,
        "status": st,
        "remarks": sc.remarks or ("Not Received" if st == "NOT_RECEIVED" else (f"Partially Received (₹{rec})" if st == "PARTIALLY_RECEIVED" else "Received")),
        "created_at": sc.created_at,
        "disbursements": disb_list
    }

@router.get("", response_model=List[ScholarshipCreditResponse])
def get_scholarships(
    student_id: Optional[int] = None,
    status: Optional[str] = Query(None, description="RECEIVED, PARTIALLY_RECEIVED, or NOT_RECEIVED"),
    search: Optional[str] = Query(None, description="Search by student name or scholarship"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ScholarshipCredit).join(Student, ScholarshipCredit.student_id == Student.id)
    if student_id:
        query = query.filter(ScholarshipCredit.student_id == student_id)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(
            Student.full_name.ilike(s),
            Student.student_code.ilike(s),
            ScholarshipCredit.scholarship_name.ilike(s),
            ScholarshipCredit.sanction_order_no.ilike(s)
        ))
    
    credits = query.order_by(ScholarshipCredit.id.desc()).all()
    serialized = [serialize_scholarship(sc) for sc in credits]

    if status:
        stat_filter = status.upper().strip()
        if stat_filter in ["PARTIAL", "PARTIALLY_RECEIVED"]:
            serialized = [s for s in serialized if s["status"] == "PARTIALLY_RECEIVED"]
        elif stat_filter == "RECEIVED":
            serialized = [s for s in serialized if s["status"] == "RECEIVED"]
        elif stat_filter in ["NOT_RECEIVED", "PENDING"]:
            serialized = [s for s in serialized if s["status"] == "NOT_RECEIVED"]

    # Sort: Pending/partial first, then fully received
    serialized.sort(key=lambda x: 0 if x["status"] == "NOT_RECEIVED" else (1 if x["status"] == "PARTIALLY_RECEIVED" else 2))
    return serialized

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

    if sc_in.fee_head_id:
        fh = db.query(FeeHead).filter(FeeHead.id == sc_in.fee_head_id).first()
        if not fh:
            raise HTTPException(status_code=404, detail="Fee Head not found")

    status = (sc_in.status or "NOT_RECEIVED").upper().strip()
    credit_date = sc_in.credit_date
    received_amount = quantize_amount(sc_in.received_amount or Decimal("0.00"))

    if status == "RECEIVED" and received_amount <= Decimal("0.00"):
        received_amount = amount

    if received_amount >= amount:
        status = "RECEIVED"
        if not credit_date:
            credit_date = date.today()
    elif received_amount > Decimal("0.00"):
        status = "PARTIALLY_RECEIVED"
        if not credit_date:
            credit_date = date.today()
    else:
        status = "NOT_RECEIVED"
        received_amount = Decimal("0.00")

    sc = ScholarshipCredit(
        student_id=student.id,
        fee_head_id=sc_in.fee_head_id,
        scholarship_name=sc_in.scholarship_name.strip(),
        sanction_order_no=sc_in.sanction_order_no,
        credit_date=credit_date,
        amount=amount,
        received_amount=received_amount,
        status=status,
        remarks=sc_in.remarks or ("Not Received" if status == "NOT_RECEIVED" else ("Partial" if status == "PARTIALLY_RECEIVED" else "Received"))
    )
    db.add(sc)
    db.flush()

    if received_amount > Decimal("0.00"):
        disb = ScholarshipDisbursement(
            scholarship_id=sc.id,
            amount=received_amount,
            disbursement_date=credit_date or date.today(),
            sanction_order_no=sc_in.sanction_order_no,
            remarks=sc_in.remarks or "Initial Disbursement"
        )
        db.add(disb)
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
            "received_amount": str(sc.received_amount),
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

    claim_amount = quantize_amount(sc.amount)
    current_received = quantize_amount(getattr(sc, 'received_amount', None) or (claim_amount if sc.status == "RECEIVED" else Decimal("0.00")))
    remaining_due = quantize_amount(max(Decimal("0.00"), claim_amount - current_received))

    if remaining_due <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="This scholarship claim has already been 100% received.")

    if req.amount is not None:
        inst_amount = quantize_amount(req.amount)
        if inst_amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Disbursement amount must be greater than zero.")
        if inst_amount > remaining_due:
            raise HTTPException(status_code=400, detail=f"Amount entered (₹{inst_amount}) exceeds remaining due (₹{remaining_due}).")
    else:
        inst_amount = remaining_due

    disb_date = req.credit_date or date.today()
    sanction_no = req.sanction_order_no.strip() if req.sanction_order_no else sc.sanction_order_no

    # Automatically generate an official payment receipt for this government disbursement
    from ..models.payment import Payment, PaymentItem
    from ..services.payment_service import generate_internal_receipt_no

    student = sc.student
    ay = (student.academic_year if student else "25-26") or "25-26"
    internal_receipt = generate_internal_receipt_no(db, ay)
    phys_receipt = sanction_no or f"DBT-{disb_date.strftime('%Y%m%d')}"

    payment = Payment(
        internal_receipt_no=internal_receipt,
        physical_receipt_no=phys_receipt,
        student_id=sc.student_id,
        payment_date=disb_date,
        entry_date=date.today(),
        payment_mode="GOVT_SCHOLARSHIP",
        total_amount=inst_amount,
        recorded_by_id=current_user.id if current_user else None,
        remarks=f"Govt Scholarship DBT: {sc.scholarship_name}" + (f" - {req.remarks}" if req.remarks else "")
    )
    db.add(payment)
    db.flush()

    p_item = PaymentItem(
        payment_id=payment.id,
        fee_head_id=sc.fee_head_id,
        fine_id=None,
        amount=inst_amount
    )
    db.add(p_item)
    db.flush()

    disb = ScholarshipDisbursement(
        scholarship_id=sc.id,
        payment_id=payment.id,
        amount=inst_amount,
        disbursement_date=disb_date,
        sanction_order_no=sanction_no,
        remarks=req.remarks.strip() if req.remarks else f"Disbursement received on {disb_date}"
    )
    db.add(disb)
    db.flush()

    new_received = quantize_amount(current_received + inst_amount)
    sc.received_amount = new_received
    sc.credit_date = disb_date
    if sanction_no:
        sc.sanction_order_no = sanction_no

    if new_received >= claim_amount:
        sc.status = "RECEIVED"
        sc.remarks = f"Fully Disbursed on {disb_date}"
    else:
        sc.status = "PARTIALLY_RECEIVED"
        rem = quantize_amount(claim_amount - new_received)
        sc.remarks = f"Partially Disbursed: ₹{new_received} received, ₹{rem} remaining"

    log_audit(
        db,
        action="SCHOLARSHIP_DISBURSEMENT",
        entity_name="scholarships",
        entity_id=sc.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": sc.student_id,
            "disbursement_amount": str(inst_amount),
            "new_total_received": str(sc.received_amount),
            "remaining_due": str(claim_amount - sc.received_amount),
            "status": sc.status,
            "sanction_order_no": sc.sanction_order_no,
            "credit_date": str(sc.credit_date)
        }
    )
    db.commit()
    recalculate_student_balances(sc.student_id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)


class ScholarshipExportRequest(BaseModel):
    status: Optional[str] = None
    search: Optional[str] = None
    ids: Optional[List[int]] = None


@router.get("/export/excel")
def download_scholarships_excel(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download scholarships report as formatted Excel workbook."""
    excel_stream = export_scholarships_excel(db, status=status, search=search)
    filename = f"scholarships_report_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/excel")
def download_scholarships_excel_post(
    req: ScholarshipExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download filtered scholarships as formatted Excel workbook (supports exact visible IDs)."""
    excel_stream = export_scholarships_excel(db, status=req.status, search=req.search, ids=req.ids)
    filename = f"scholarships_report_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

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
    sc.received_amount = Decimal("0.00")
    sc.credit_date = None
    sc.remarks = "Not Received"

    from ..models.payment import Payment
    disbs = db.query(ScholarshipDisbursement).filter(ScholarshipDisbursement.scholarship_id == sc.id).all()
    for d in disbs:
        if d.payment_id:
            linked_payment = db.query(Payment).filter(Payment.id == d.payment_id).first()
            if linked_payment:
                db.delete(linked_payment)

    db.query(ScholarshipDisbursement).filter(ScholarshipDisbursement.scholarship_id == sc.id).delete()

    log_audit(
        db,
        action="SCHOLARSHIP_RESET",
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


@router.delete("/{scholarship_id}/disbursements/{disbursement_id}", response_model=ScholarshipCreditResponse)
def delete_scholarship_disbursement(
    scholarship_id: int,
    disbursement_id: int,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    sc = db.query(ScholarshipCredit).filter(ScholarshipCredit.id == scholarship_id).first()
    if not sc:
        raise HTTPException(status_code=404, detail="Scholarship record not found")

    disb = db.query(ScholarshipDisbursement).filter(
        ScholarshipDisbursement.id == disbursement_id,
        ScholarshipDisbursement.scholarship_id == scholarship_id
    ).first()
    if not disb:
        raise HTTPException(status_code=404, detail="Disbursement entry not found")

    removed_amt = quantize_amount(disb.amount)
    if disb.payment_id:
        from ..models.payment import Payment
        linked_payment = db.query(Payment).filter(Payment.id == disb.payment_id).first()
        if linked_payment:
            db.delete(linked_payment)

    db.delete(disb)
    db.flush()

    rem_disbs = db.query(ScholarshipDisbursement).filter(ScholarshipDisbursement.scholarship_id == scholarship_id).all()
    new_received = sum([quantize_amount(d.amount) for d in rem_disbs], Decimal("0.00"))
    sc.received_amount = new_received

    claim_amount = quantize_amount(sc.amount)
    if new_received <= Decimal("0.00"):
        sc.status = "NOT_RECEIVED"
        sc.credit_date = None
        sc.remarks = "Not Received"
    elif new_received >= claim_amount:
        sc.status = "RECEIVED"
        sc.credit_date = max([d.disbursement_date for d in rem_disbs])
        sc.remarks = "Fully Disbursed"
    else:
        sc.status = "PARTIALLY_RECEIVED"
        sc.credit_date = max([d.disbursement_date for d in rem_disbs])
        rem = quantize_amount(claim_amount - new_received)
        sc.remarks = f"Partially Disbursed: ₹{new_received} received, ₹{rem} remaining"

    log_audit(
        db,
        action="DELETE_SCHOLARSHIP_DISBURSEMENT",
        entity_name="scholarships",
        entity_id=sc.id,
        user_id=current_user.id if current_user else None,
        details={
            "student_id": sc.student_id,
            "deleted_amount": str(removed_amt),
            "new_received": str(new_received)
        }
    )

    db.commit()
    recalculate_student_balances(sc.student_id, db)
    db.refresh(sc)
    return serialize_scholarship(sc)


class ScholarshipExportRequest(BaseModel):
    status: Optional[str] = None
    search: Optional[str] = None
    ids: Optional[List[int]] = None


@router.get("/export/excel")
def download_scholarships_excel(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download scholarships report as formatted Excel workbook."""
    excel_stream = export_scholarships_excel(db, status=status, search=search)
    filename = f"scholarships_report_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/excel")
def download_scholarships_excel_post(
    req: ScholarshipExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download filtered scholarships as formatted Excel workbook (supports exact visible IDs)."""
    excel_stream = export_scholarships_excel(db, status=req.status, search=req.search, ids=req.ids)
    filename = f"scholarships_report_{date.today().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )



