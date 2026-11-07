from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field

class ScholarshipCreditCreate(BaseModel):
    student_id: int
    fee_head_id: Optional[int] = None
    scholarship_name: str = Field(..., description="MahaDBT, Post-Matric, Freeship, etc.")
    sanction_order_no: Optional[str] = None
    credit_date: Optional[date] = None
    amount: Decimal = Field(..., gt=0)
    remarks: Optional[str] = None

class ScholarshipCreditResponse(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    fee_head_id: Optional[int] = None
    fee_head_name: Optional[str] = None
    scholarship_name: str
    sanction_order_no: Optional[str] = None
    credit_date: date
    amount: Decimal
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
