from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field
from .fee import StudentFeeHeadResponse
from .fine import FineResponse
from .payment import PaymentResponse
from .scholarship import ScholarshipCreditResponse

class StudentBase(BaseModel):
    student_code: str = Field(..., description="Unique Student ID / Roll No")
    full_name: str
    dob: Optional[date] = None
    gender: str = Field(..., description="MALE, FEMALE, OTHER")
    category: str = Field(..., description="OPEN, EBC, SC, ST, OBC, VJNT, NT, SBC")
    mobile_number: Optional[str] = None
    email_address: Optional[str] = None
    address: Optional[str] = None
    academic_year: str = "2026-2027"
    course_branch: Optional[str] = "General"
    current_year: int = 1

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    student_code: Optional[str] = None
    full_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    category: Optional[str] = None
    mobile_number: Optional[str] = None
    email_address: Optional[str] = None
    address: Optional[str] = None
    academic_year: Optional[str] = None
    course_branch: Optional[str] = None
    current_year: Optional[int] = None
    is_active: Optional[bool] = None

class StudentResponse(StudentBase):
    id: int
    is_active: bool
    total_fee: Decimal = Decimal("0.00")
    total_waiver: Decimal = Decimal("0.00")
    net_fee_due: Decimal = Decimal("0.00")
    total_fee_paid: Decimal = Decimal("0.00")
    total_fines: Decimal = Decimal("0.00")
    total_fines_paid: Decimal = Decimal("0.00")
    total_fines_balance: Decimal = Decimal("0.00")
    overall_balance: Decimal = Decimal("0.00")
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StudentDetailResponse(StudentResponse):
    fee_heads: List[StudentFeeHeadResponse] = []
    payments: List[PaymentResponse] = []
    fines: List[FineResponse] = []
    scholarships: List[ScholarshipCreditResponse] = []
