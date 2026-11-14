from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator

class ScholarshipCreditCreate(BaseModel):
    student_id: int
    fee_head_id: Optional[int] = None
    scholarship_name: str = Field(..., description="MahaDBT, Post-Matric, Freeship, etc.")
    sanction_order_no: Optional[str] = None
    credit_date: Optional[date] = None
    amount: Decimal = Field(..., gt=0)
    received_amount: Optional[Decimal] = Decimal("0.00")
    status: str = "NOT_RECEIVED"
    remarks: Optional[str] = None

    @field_validator("fee_head_id", mode="before")
    @classmethod
    def coerce_fee_head_id(cls, v):
        if v == "" or v is None or v == 0:
            return None
        return v

    @field_validator("credit_date", mode="before")
    @classmethod
    def coerce_credit_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("sanction_order_no", "remarks", mode="before")
    @classmethod
    def coerce_empty_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class MarkScholarshipReceivedRequest(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0, description="Installment amount received. If omitted, marks full remaining amount.")
    sanction_order_no: Optional[str] = None
    credit_date: Optional[date] = None
    remarks: Optional[str] = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v):
        if v == "" or v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v

    @field_validator("credit_date", mode="before")
    @classmethod
    def coerce_credit_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("sanction_order_no", "remarks", mode="before")
    @classmethod
    def coerce_empty_strings(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ScholarshipDisbursementResponse(BaseModel):
    id: int
    scholarship_id: int
    amount: Decimal
    disbursement_date: date
    sanction_order_no: Optional[str] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ScholarshipCreditResponse(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    student_category: Optional[str] = None
    academic_year: Optional[str] = None
    fee_head_id: Optional[int] = None
    fee_head_name: Optional[str] = None
    scholarship_name: str
    sanction_order_no: Optional[str] = None
    credit_date: Optional[date] = None
    amount: Decimal
    received_amount: Decimal = Decimal("0.00")
    remaining_amount: Decimal = Decimal("0.00")
    status: str = "NOT_RECEIVED"
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    disbursements: List[ScholarshipDisbursementResponse] = []

    class Config:
        from_attributes = True


