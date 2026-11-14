from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.fee import FeeHead, FeeConcessionType, FeeTypeHeadRule
from ..models.user import User
from ..schemas.fee import (
    FeeHeadCreate, FeeHeadUpdate, FeeHeadResponse,
    FeeConcessionTypeCreate, FeeConcessionTypeUpdate, FeeConcessionTypeResponse
)
from ..auth import get_current_user, require_admin
from ..services.fee_engine import quantize_amount, reapply_all_student_fee_rules
from ..services.audit_service import log_audit


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
    db.flush()
    log_audit(
        db,
        action="CREATE_FEE_HEAD",
        entity_name="fee_heads",
        entity_id=head.id,
        user_id=admin.id,
        details={"name": head.name, "code": head.code, "base_amount": str(head.base_amount)}
    )
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
        # Automatically synchronize all enrolled students' fee heads with the updated base amount
        reapply_all_student_fee_rules(db, academic_year=head.academic_year)
    if head_in.academic_year is not None:
        head.academic_year = head_in.academic_year
    if head_in.is_compulsory is not None:
        head.is_compulsory = head_in.is_compulsory
    if head_in.allows_waiver is not None:
        head.allows_waiver = head_in.allows_waiver

    log_audit(
        db,
        action="UPDATE_FEE_HEAD",
        entity_name="fee_heads",
        entity_id=head.id,
        user_id=admin.id,
        details={"name": head.name, "code": head.code, "base_amount": str(head.base_amount)}
    )
    db.commit()
    db.refresh(head)
    return head



def build_concession_type_response(t: FeeConcessionType) -> dict:
    rules = []
    for r in t.head_rules:
        rules.append({
            "id": r.id,
            "fee_head_id": r.fee_head_id,
            "waiver_percent": r.waiver_percent,
            "waiver_amount": r.waiver_amount,
            "reason": r.reason,
            "fee_head_name": r.fee_head.name if r.fee_head else None,
            "fee_head_code": r.fee_head.code if r.fee_head else None,
            "fee_head_base_amount": r.fee_head.base_amount if r.fee_head else None
        })
    return {
        "id": t.id,
        "name": t.name,
        "code": t.code,
        "type_group": t.type_group,
        "academic_year": t.academic_year,
        "description": t.description,
        "is_active": t.is_active,
        "rules": rules
    }


@router.get("/types", response_model=List[FeeConcessionTypeResponse])
def get_concession_types(
    academic_year: Optional[str] = "2026-2027",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(FeeConcessionType)
    if academic_year:
        query = query.filter(FeeConcessionType.academic_year == academic_year)
    types = query.order_by(FeeConcessionType.type_group.asc(), FeeConcessionType.name.asc()).all()
    return [build_concession_type_response(t) for t in types]


@router.post("/types", response_model=FeeConcessionTypeResponse)
def create_concession_type(
    type_in: FeeConcessionTypeCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    code = type_in.code.strip().upper()
    existing = db.query(FeeConcessionType).filter(
        FeeConcessionType.code == code,
        FeeConcessionType.academic_year == type_in.academic_year
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Fee type with this code already exists for this academic year")

    c_type = FeeConcessionType(
        name=type_in.name.strip(),
        code=code,
        type_group=type_in.type_group.strip().upper(),
        academic_year=type_in.academic_year.strip(),
        description=type_in.description,
        is_active=type_in.is_active
    )
    db.add(c_type)
    db.flush()

    for r in type_in.rules:
        rule = FeeTypeHeadRule(
            concession_type_id=c_type.id,
            fee_head_id=r.fee_head_id,
            waiver_percent=quantize_amount(r.waiver_percent),
            waiver_amount=quantize_amount(r.waiver_amount),
            reason=r.reason
        )
        db.add(rule)

    log_audit(
        db,
        action="CREATE_CONCESSION_TYPE",
        entity_name="fee_concession_types",
        entity_id=c_type.id,
        user_id=admin.id,
        details={"name": c_type.name, "code": c_type.code, "group": c_type.type_group}
    )
    db.commit()
    db.refresh(c_type)
    return build_concession_type_response(c_type)



@router.get("/types/{type_id}", response_model=FeeConcessionTypeResponse)
def get_concession_type(
    type_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    c_type = db.query(FeeConcessionType).filter(FeeConcessionType.id == type_id).first()
    if not c_type:
        raise HTTPException(status_code=404, detail="Fee concession type not found")
    return build_concession_type_response(c_type)


@router.put("/types/{type_id}", response_model=FeeConcessionTypeResponse)
def update_concession_type(
    type_id: int,
    type_in: FeeConcessionTypeUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    c_type = db.query(FeeConcessionType).filter(FeeConcessionType.id == type_id).first()
    if not c_type:
        raise HTTPException(status_code=404, detail="Fee concession type not found")

    if type_in.name is not None:
        c_type.name = type_in.name.strip()
    if type_in.code is not None:
        c_type.code = type_in.code.strip().upper()
    if type_in.type_group is not None:
        c_type.type_group = type_in.type_group.strip().upper()
    if type_in.academic_year is not None:
        c_type.academic_year = type_in.academic_year.strip()
    if type_in.description is not None:
        c_type.description = type_in.description
    if type_in.is_active is not None:
        c_type.is_active = type_in.is_active

    if type_in.rules is not None:
        db.query(FeeTypeHeadRule).filter(FeeTypeHeadRule.concession_type_id == type_id).delete()
        for r in type_in.rules:
            rule = FeeTypeHeadRule(
                concession_type_id=type_id,
                fee_head_id=r.fee_head_id,
                waiver_percent=quantize_amount(r.waiver_percent),
                waiver_amount=quantize_amount(r.waiver_amount),
                reason=r.reason
            )
            db.add(rule)

    log_audit(
        db,
        action="CREATE_CONCESSION_TYPE",
        entity_name="fee_concession_types",
        entity_id=c_type.id,
        user_id=admin.id,
        details={"name": c_type.name, "code": c_type.code, "group": c_type.type_group}
    )
    db.commit()
    db.refresh(c_type)
    return build_concession_type_response(c_type)



@router.delete("/types/{type_id}")
def delete_concession_type(
    type_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    c_type = db.query(FeeConcessionType).filter(FeeConcessionType.id == type_id).first()
    if not c_type:
        raise HTTPException(status_code=404, detail="Fee concession type not found")
    name = c_type.name
    code = c_type.code
    db.delete(c_type)
    log_audit(
        db,
        action="DELETE_CONCESSION_TYPE",
        entity_name="fee_concession_types",
        entity_id=type_id,
        user_id=admin.id,
        details={"name": name, "code": code}
    )
    db.commit()
    return {"status": "deleted", "id": type_id}


@router.post("/reapply-rules")
def reapply_fee_rules(
    academic_year: Optional[str] = "2026-2027",
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    count = reapply_all_student_fee_rules(db, academic_year=academic_year)
    log_audit(
        db,
        action="REAPPLY_FEE_RULES",
        entity_name="fee_rules",
        user_id=admin.id,
        details={"academic_year": academic_year, "students_recalculated": count}
    )
    db.commit()
    return {
        "status": "success",
        "academic_year": academic_year,
        "students_recalculated": count,
        "message": f"Successfully re-evaluated and updated fee rules for {count} students."
    }

