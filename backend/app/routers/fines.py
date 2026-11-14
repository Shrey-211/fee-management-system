from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.fine import Fine
from ..models.user import User
from ..schemas.fine import FineCreate, FineUpdate, FineResponse
from ..auth import get_current_user
from ..services.fine_service import apply_fine, update_fine_status

router = APIRouter(prefix="/api/fines", tags=["Fines"])

def serialize_fine(f: Fine) -> dict:
    return {
        "id": f.id,
        "student_id": f.student_id,
        "student_name": f.student.full_name if f.student else "Unknown",
        "student_code": f.student.student_code if f.student else "N/A",
        "event_name": f.event_name,
        "amount": f.amount,
        "fine_date": f.fine_date,
        "status": f.status,
        "paid_amount": f.paid_amount,
        "balance": f.balance,
        "remarks": f.remarks,
        "created_at": f.created_at
    }

@router.get("", response_model=List[FineResponse])
def get_fines(
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Fine)
    if student_id:
        query = query.filter(Fine.student_id == student_id)
    if status:
        query = query.filter(Fine.status == status.upper().strip())

    fines = query.order_by(Fine.fine_date.desc(), Fine.id.desc()).all()
    return [serialize_fine(f) for f in fines]

@router.post("", response_model=FineResponse)
def create_fine(
    fine_in: FineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    fine = apply_fine(db, fine_in, current_user=current_user)
    return serialize_fine(fine)

@router.put("/{fine_id}", response_model=FineResponse)
def update_fine(
    fine_id: int,
    fine_in: FineUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if fine_in.status and fine_in.status.upper().strip() == "WAIVED":
        if current_user.role.lower() not in ["admin", "accountant"]:
            raise HTTPException(
                status_code=403,
                detail="Accountant or Admin privileges required to waive event fines"
            )
    fine = update_fine_status(db, fine_id, fine_in, current_user=current_user)
    return serialize_fine(fine)


