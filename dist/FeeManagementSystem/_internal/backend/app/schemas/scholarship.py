from typing import Optional
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
    sanction_order_no: Optional[str] = None
    credit_date: Optional[date] = None
    remarks: Optional[str] = None

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
    status: str = "NOT_RECEIVED"
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

