from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

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
    physical_receipt_no: str = Field(..., min_length=1, description="Number from manual receipt book")
    payment_date: Optional[date] = None
    entry_date: Optional[date] = None
    payment_mode: str = Field(default="CASH", description="CASH, UPI, CHEQUE, DD, NEFT")
    remarks: Optional[str] = None
    items: List[PaymentItemCreate]

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    internal_receipt_no: str
    physical_receipt_no: str
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    payment_date: date
    entry_date: date
    payment_mode: str
    total_amount: Decimal
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[PaymentItemResponse] = []
