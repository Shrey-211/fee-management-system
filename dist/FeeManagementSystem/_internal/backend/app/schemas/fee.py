from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field

class FeeHeadBase(BaseModel):
    name: str
    code: str
    base_amount: Decimal = Field(default=Decimal("0.00"))
    academic_year: str = "2026-2027"
    is_compulsory: bool = True
    allows_waiver: bool = True

class FeeHeadCreate(FeeHeadBase):
    pass

class FeeHeadUpdate(BaseModel):
    name: Optional[str] = None
    base_amount: Optional[Decimal] = None
    academic_year: Optional[str] = None
    is_compulsory: Optional[bool] = None
    allows_waiver: Optional[bool] = None

class FeeHeadResponse(FeeHeadBase):
    id: int

    class Config:
        from_attributes = True

class StudentFeeHeadResponse(BaseModel):
    id: int
    fee_head_id: int
    name: str
    code: str
    base_amount: Decimal
    discount_percent: Decimal
    discount_amount: Decimal
    net_due: Decimal
    paid_amount: Decimal
    balance: Decimal
    waiver_reason: Optional[str] = None

    class Config:
        from_attributes = True
