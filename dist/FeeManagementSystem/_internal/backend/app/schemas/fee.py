from typing import Optional, List
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


# Concession / Type Rules Schemas
class FeeTypeHeadRuleBase(BaseModel):
    fee_head_id: int
    waiver_percent: Decimal = Field(default=Decimal("0.00"))
    waiver_amount: Decimal = Field(default=Decimal("0.00"))
    reason: Optional[str] = None

class FeeTypeHeadRuleResponse(FeeTypeHeadRuleBase):
    id: int
    fee_head_name: Optional[str] = None
    fee_head_code: Optional[str] = None
    fee_head_base_amount: Optional[Decimal] = None

    class Config:
        from_attributes = True

class FeeConcessionTypeBase(BaseModel):
    name: str
    code: str
    type_group: str = "CASTE"  # "CASTE", "GENDER", "CUSTOM"
    academic_year: str = "2026-2027"
    description: Optional[str] = None
    is_active: bool = True

class FeeConcessionTypeCreate(FeeConcessionTypeBase):
    rules: List[FeeTypeHeadRuleBase] = []

class FeeConcessionTypeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type_group: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    rules: Optional[List[FeeTypeHeadRuleBase]] = None

class FeeConcessionTypeResponse(FeeConcessionTypeBase):
    id: int
    rules: List[FeeTypeHeadRuleResponse] = []

    class Config:
        from_attributes = True


