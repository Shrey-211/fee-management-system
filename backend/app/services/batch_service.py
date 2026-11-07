from datetime import date, datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from ..models.payment import Payment
from ..models.batch import BankDepositBatch
from ..models.user import User
from ..schemas.payment import BankDepositBatchCreate
from ..config import settings
from .fee_engine import quantize_amount

def get_cash_in_hand_summary(db: Session) -> Dict[str, Any]:
    """
    Computes total cash collected that has not yet been deposited at the bank,
    and returns threshold status (ALERT if between ₹40k - ₹50k or above).
    """
    undeposited_payments = db.query(Payment).filter(
        Payment.payment_mode == "CASH",
        Payment.deposit_status == "UNDEPOSITED_CASH"
    ).all()

    total_cash = sum([quantize_amount(p.total_amount) for p in undeposited_payments], Decimal("0.00"))
    low_thresh = Decimal(str(settings.CASH_ALERT_THRESHOLD_LOW))
    high_thresh = Decimal(str(settings.CASH_ALERT_THRESHOLD_HIGH))

    alert_level = "NORMAL"
    alert_message = "Cash balance is within normal limits."
    
    if total_cash >= high_thresh:
        alert_level = "CRITICAL"
        alert_message = f"Undeposited cash (₹{total_cash:,.2f}) has reached or exceeded ₹{high_thresh:,.0f}. Immediate bank deposit recommended!"
    elif total_cash >= low_thresh:
        alert_level = "WARNING"
        alert_message = f"Undeposited cash (₹{total_cash:,.2f}) is approaching threshold (₹{low_thresh:,.0f}–₹{high_thresh:,.0f}). Ready for batch bank deposit."

    return {
        "total_undeposited_cash": float(total_cash),
        "unbatched_payments_count": len(undeposited_payments),
        "alert_level": alert_level,
        "alert_message": alert_message,
        "threshold_low": float(low_thresh),
        "threshold_high": float(high_thresh),
        "payments": [
            {
                "id": p.id,
                "receipt_no": p.internal_receipt_no,
                "physical_receipt_no": p.physical_receipt_no,
                "student_name": p.student.full_name if p.student else "Unknown",
                "payment_date": str(p.payment_date),
                "amount": float(p.total_amount)
            }
            for p in undeposited_payments
        ]
    }


def create_bank_deposit_batch(
    db: Session,
    batch_in: BankDepositBatchCreate,
    current_user: Optional[User] = None
) -> BankDepositBatch:
    if not batch_in.payment_ids:
        raise HTTPException(status_code=400, detail="Please select at least one cash receipt to deposit")

    payments = db.query(Payment).filter(Payment.id.in_(batch_in.payment_ids)).all()
    if len(payments) != len(batch_in.payment_ids):
        raise HTTPException(status_code=400, detail="One or more selected payment IDs are invalid")

    for p in payments:
        if p.deposit_status == "DEPOSITED" and p.deposit_batch_id:
            raise HTTPException(
                status_code=400,
                detail=f"Receipt {p.internal_receipt_no} is already assigned to a bank deposit batch"
            )

    dep_date = batch_in.deposit_date or date.today()
    total_amount = sum([quantize_amount(p.total_amount) for p in payments], Decimal("0.00"))

    # Generate batch number
    year = dep_date.strftime("%Y")
    count = db.query(BankDepositBatch).count() + 1
    batch_no = f"DEP-{year}-{count:04d}"

    batch = BankDepositBatch(
        batch_number=batch_no,
        deposit_date=dep_date,
        total_cash_amount=total_amount,
        bank_name=batch_in.bank_name,
        bank_challan_no=batch_in.bank_challan_no,
        status="DEPOSITED",
        created_by_id=current_user.id if current_user else None
    )
    db.add(batch)
    db.flush()

    for p in payments:
        p.deposit_status = "DEPOSITED"
        p.bank_deposit_date = dep_date
        p.deposit_batch_id = batch.id

    db.commit()
    db.refresh(batch)
    return batch
