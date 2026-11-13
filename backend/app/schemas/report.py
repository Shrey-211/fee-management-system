from typing import Optional, List, Dict
from decimal import Decimal
from datetime import date
from pydantic import BaseModel

class ReportDateFilter(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    academic_year: Optional[str] = None
    category: Optional[str] = None
    fee_head_id: Optional[int] = None

class DailyCollectionItem(BaseModel):
    payment_id: int
    receipt_no: str
    physical_receipt_no: Optional[str] = None
    student_name: str
    student_code: str
    category: str
    payment_mode: str
    payment_date: date
    total_amount: Decimal
    head_breakdown: Dict[str, Decimal] = {}

class DailyCollectionSummary(BaseModel):
    total_collected: Decimal
    cash_collected: Decimal
    other_modes_collected: Decimal
    fee_head_totals: Dict[str, Decimal] = {}
    fines_total: Decimal = Decimal("0.00")
    payments_count: int
    items: List[DailyCollectionItem] = []

class FeeHeadCollectionRow(BaseModel):
    fee_head_id: int
    fee_head_name: str
    fee_head_code: str
    total_collected: Decimal
    transaction_count: int

class OutstandingStudentRow(BaseModel):
    student_id: int
    student_code: str
    full_name: str
    category: str
    gender: str
    mobile_number: Optional[str] = None
    email_address: Optional[str] = None
    total_applicable_fee: Decimal
    total_fee_paid: Decimal
    fee_balance: Decimal
    total_fines: Decimal
    fines_paid: Decimal
    fines_balance: Decimal
    total_outstanding: Decimal

