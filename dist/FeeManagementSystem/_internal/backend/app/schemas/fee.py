from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

class FeeHeadBase(BaseModel):
    name: str
    code: str
    base_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    academic_year: str = "2026-2027"
    is_compulsory: bool = True
    allows_waiver: bool = True

    @field_validator("name", "code", mode="before")
    @classmethod
    def trim_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

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
    waiver_percent: Decimal = Field(default=Decimal("0.00"), ge=0, le=100)
    waiver_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    reason: Optional[str] = None

    @field_validator("reason", mode="before")
    @classmethod
    def coerce_empty_reason(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class FeeTypeHeadRuleResponse(FeeTypeHeadRuleBase):
    id: int
    fee_head_name: Optional[str] = None
    fee_head_code: Optional[str] = None
    fee_head_base_amount: Optional[Decimal] = None

    class Config:
        from_attributes = True

class FeeConcessionTypeBase(BaseModel):
    name: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1)
    type_group: str = "CASTE"  # "CASTE", "GENDER", "CUSTOM"
    academic_year: str = "2026-2027"
    description: Optional[str] = None
    is_active: bool = True

    @field_validator("name", "code", mode="before")
    @classmethod
    def trim_name_code(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("description", mode="before")
    @classmethod
    def coerce_empty_desc(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

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


