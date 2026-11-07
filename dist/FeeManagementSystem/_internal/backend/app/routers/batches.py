from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.batch import BankDepositBatch
from ..models.user import User
from ..schemas.payment import BankDepositBatchCreate, BankDepositBatchResponse
from ..auth import get_current_user, require_accountant_or_admin
from ..services.batch_service import get_cash_in_hand_summary, create_bank_deposit_batch

router = APIRouter(prefix="/api/batches", tags=["Bank Batches"])

@router.get("/cash-status")
def get_cash_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    return get_cash_in_hand_summary(db)

@router.get("", response_model=List[BankDepositBatchResponse])
def get_batches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batches = db.query(BankDepositBatch).order_by(BankDepositBatch.deposit_date.desc(), BankDepositBatch.id.desc()).all()
    res = []
    for b in batches:
        res.append({
            "id": b.id,
            "batch_number": b.batch_number,
            "deposit_date": b.deposit_date,
            "total_cash_amount": b.total_cash_amount,
            "bank_name": b.bank_name,
            "bank_challan_no": b.bank_challan_no,
            "status": b.status,
            "created_at": b.created_at,
            "payment_count": len(b.payments)
        })
    return res

@router.post("", response_model=BankDepositBatchResponse)
def create_batch(
    batch_in: BankDepositBatchCreate,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    batch = create_bank_deposit_batch(db, batch_in, current_user=current_user)
    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "deposit_date": batch.deposit_date,
        "total_cash_amount": batch.total_cash_amount,
        "bank_name": batch.bank_name,
        "bank_challan_no": batch.bank_challan_no,
        "status": batch.status,
        "created_at": batch.created_at,
        "payment_count": len(batch.payments)
    }
