from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator

class PaymentItemCreate(BaseModel):
    fee_head_id: Optional[int] = None
    fine_id: Optional[int] = None
    amount: Decimal = Field(..., gt=0)

class PaymentItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fee_head_id: Optional[int] = None
    fee_head_name: Optional[str] = None
    fine_id: Optional[int] = None
    fine_event_name: Optional[str] = None
    amount: Decimal

class PaymentCreate(BaseModel):
    student_id: int
    physical_receipt_no: Optional[str] = Field(default=None, description="Optional number from manual receipt book")
    payment_date: Optional[date] = None
    entry_date: Optional[date] = None
    payment_mode: str = Field(default="CASH", description="CASH, UPI, CHEQUE, DD, NEFT")
    remarks: Optional[str] = None
    items: List[PaymentItemCreate]

    @field_validator("physical_receipt_no", mode="before")
    @classmethod
    def coerce_empty_physical_receipt(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("payment_date", "entry_date", mode="before")
    @classmethod
    def coerce_empty_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("remarks", mode="before")
    @classmethod
    def coerce_empty_remarks(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class PaymentUpdate(BaseModel):
    physical_receipt_no: Optional[str] = None
    payment_date: Optional[date] = None
    entry_date: Optional[date] = None
    payment_mode: Optional[str] = None
    remarks: Optional[str] = None
    items: Optional[List[PaymentItemCreate]] = None

    @field_validator("physical_receipt_no", mode="before")
    @classmethod
    def coerce_empty_physical_receipt(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("payment_date", "entry_date", mode="before")
    @classmethod
    def coerce_empty_date(cls, v):
        if v == "" or v is None:
            return None
        return v

    @field_validator("remarks", mode="before")
    @classmethod
    def coerce_empty_remarks(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    internal_receipt_no: str
    physical_receipt_no: Optional[str] = None
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    student_category: Optional[str] = None
    student_course: Optional[str] = None
    student_academic_year: Optional[str] = None
    student_current_year: Optional[int] = 1
    payment_date: date
    entry_date: date
    payment_mode: str
    total_amount: Decimal
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[PaymentItemResponse] = []
