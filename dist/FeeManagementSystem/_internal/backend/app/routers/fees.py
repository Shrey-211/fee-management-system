from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.fee import FeeHead
from ..models.user import User
from ..schemas.fee import FeeHeadCreate, FeeHeadUpdate, FeeHeadResponse
from ..auth import get_current_user, require_admin
from ..services.fee_engine import quantize_amount

router = APIRouter(prefix="/api/fees", tags=["Fees"])

@router.get("/heads", response_model=List[FeeHeadResponse])
def get_fee_heads(
    academic_year: str = "2026-2027",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    heads = db.query(FeeHead).filter(FeeHead.academic_year == academic_year).all()
    if not heads:
        heads = db.query(FeeHead).all()
    return heads

@router.post("/heads", response_model=FeeHeadResponse)
def create_fee_head(
    head_in: FeeHeadCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(FeeHead).filter(
        FeeHead.code == head_in.code.upper().strip(),
        FeeHead.academic_year == head_in.academic_year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Fee head code already exists for this academic year")

    head = FeeHead(
        name=head_in.name.strip(),
        code=head_in.code.upper().strip(),
        base_amount=quantize_amount(head_in.base_amount),
        academic_year=head_in.academic_year,
        is_compulsory=head_in.is_compulsory,
        allows_waiver=head_in.allows_waiver
    )
    db.add(head)
    db.commit()
    db.refresh(head)
    return head

@router.put("/heads/{head_id}", response_model=FeeHeadResponse)
def update_fee_head(
    head_id: int,
    head_in: FeeHeadUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    head = db.query(FeeHead).filter(FeeHead.id == head_id).first()
    if not head:
        raise HTTPException(status_code=404, detail="Fee head not found")

    if head_in.name is not None:
        head.name = head_in.name.strip()
    if head_in.base_amount is not None:
        head.base_amount = quantize_amount(head_in.base_amount)
    if head_in.academic_year is not None:
        head.academic_year = head_in.academic_year
    if head_in.is_compulsory is not None:
        head.is_compulsory = head_in.is_compulsory
    if head_in.allows_waiver is not None:
        head.allows_waiver = head_in.allows_waiver

    db.commit()
    db.refresh(head)
    return head
