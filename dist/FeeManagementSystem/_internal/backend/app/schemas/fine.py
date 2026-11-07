from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field

class FineCreate(BaseModel):
    student_id: int
    event_name: str = Field(..., description="Krishna Utsav, Freshers, Send-off, etc.")
    amount: Decimal = Field(..., gt=0)
    fine_date: Optional[date] = None
    remarks: Optional[str] = None

class FineUpdate(BaseModel):
    event_name: Optional[str] = None
    amount: Optional[Decimal] = None
    status: Optional[str] = None  # UNPAID, PARTIALLY_PAID, PAID, WAIVED
    remarks: Optional[str] = None

class FineResponse(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    event_name: str
    amount: Decimal
    fine_date: date
    status: str
    paid_amount: Decimal
    balance: Decimal
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
