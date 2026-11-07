from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field

class PaymentItemCreate(BaseModel):
    fee_head_id: Optional[int] = None
    fine_id: Optional[int] = None
    amount: Decimal = Field(..., gt=0)

class PaymentItemResponse(BaseModel):
    id: int
    fee_head_id: Optional[int] = None
    fee_head_name: Optional[str] = None
    fine_id: Optional[int] = None
    fine_event_name: Optional[str] = None
    amount: Decimal

    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    student_id: int
    physical_receipt_no: str = Field(..., min_length=1, description="Number from manual receipt book")
    payment_date: Optional[date] = None
    entry_date: Optional[date] = None
    payment_mode: str = Field(default="CASH", description="CASH, UPI, CHEQUE, DD, NEFT")
    bank_deposit_date: Optional[date] = None
    remarks: Optional[str] = None
    items: List[PaymentItemCreate]

class PaymentResponse(BaseModel):
    id: int
    internal_receipt_no: str
    physical_receipt_no: str
    student_id: int
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    payment_date: date
    entry_date: date
    bank_deposit_date: Optional[date] = None
    payment_mode: str
    total_amount: Decimal
    deposit_status: str
    deposit_batch_id: Optional[int] = None
    remarks: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[PaymentItemResponse] = []

    class Config:
        from_attributes = True

class BankDepositBatchCreate(BaseModel):
    deposit_date: Optional[date] = None
    bank_name: Optional[str] = "Bank of Maharashtra / SBI"
    bank_challan_no: Optional[str] = None
    payment_ids: List[int]

class BankDepositBatchResponse(BaseModel):
    id: int
    batch_number: str
    deposit_date: date
    total_cash_amount: Decimal
    bank_name: Optional[str] = None
    bank_challan_no: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    payment_count: int = 0

    class Config:
        from_attributes = True
