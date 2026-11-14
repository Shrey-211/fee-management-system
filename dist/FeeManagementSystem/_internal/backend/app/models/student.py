from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False, index=True)
    dob = Column(Date, nullable=True)
    gender = Column(String(10), nullable=False)  # MALE, FEMALE, OTHER
    category = Column(String(20), nullable=False)  # OPEN, EBC, SC, ST, OBC, VJNT, etc.
    mobile_number = Column(String(20), nullable=True, index=True)
    email_address = Column(String(100), nullable=True)
    address = Column(String(255), nullable=True)
    academic_year = Column(String(20), nullable=False, default="25-26")
    course_branch = Column(String(100), nullable=True, default="MBA")

    current_year = Column(Integer, default=1)
    concession_type_id = Column(Integer, ForeignKey("fee_concession_types.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    concession_type = relationship("FeeConcessionType")
    fee_heads = relationship("StudentFeeHead", back_populates="student", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="student", cascade="all, delete-orphan")
    fines = relationship("Fine", back_populates="student", cascade="all, delete-orphan")
    scholarships = relationship("ScholarshipCredit", back_populates="student", cascade="all, delete-orphan")

