from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class FeeHead(Base):
    __tablename__ = "fee_heads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Tuition, Development, Dress code, Exam, Other
    code = Column(String(50), unique=True, index=True, nullable=False)
    base_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    academic_year = Column(String(20), nullable=False, default="2026-2027")
    is_compulsory = Column(Boolean, default=True)  # True for dress, exam, other
    allows_waiver = Column(Boolean, default=True)  # True for tuition, development

    student_fee_heads = relationship("StudentFeeHead", back_populates="fee_head", cascade="all, delete-orphan")


class StudentFeeHead(Base):
    __tablename__ = "student_fee_heads"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    fee_head_id = Column(Integer, ForeignKey("fee_heads.id", ondelete="CASCADE"), nullable=False, index=True)
    
    base_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=0.0)  # e.g. 50.00 for EBC, 100.00 for Girls/SC/ST
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    net_due = Column(Numeric(10, 2), nullable=False, default=0.0)  # base_amount - discount_amount
    paid_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    balance = Column(Numeric(10, 2), nullable=False, default=0.0)  # net_due - paid_amount
    waiver_reason = Column(String(255), nullable=True)

    student = relationship("Student", back_populates="fee_heads")
    fee_head = relationship("FeeHead", back_populates="student_fee_heads")


class FeeConcessionType(Base):
    __tablename__ = "fee_concession_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # e.g. "EBC", "SC", "ST", "OPEN", "Female", "TFWS"
    code = Column(String(50), nullable=False, index=True)  # e.g. "EBC", "SC", "FEMALE", etc.
    type_group = Column(String(50), nullable=False, default="CASTE")  # "CASTE", "GENDER", "CUSTOM"
    academic_year = Column(String(20), nullable=False, default="2026-2027")
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)

    head_rules = relationship("FeeTypeHeadRule", back_populates="concession_type", cascade="all, delete-orphan")


class FeeTypeHeadRule(Base):
    __tablename__ = "fee_type_head_rules"

    id = Column(Integer, primary_key=True, index=True)
    concession_type_id = Column(Integer, ForeignKey("fee_concession_types.id", ondelete="CASCADE"), nullable=False, index=True)
    fee_head_id = Column(Integer, ForeignKey("fee_heads.id", ondelete="CASCADE"), nullable=False, index=True)

    waiver_percent = Column(Numeric(5, 2), nullable=False, default=0.0)  # e.g. 50.00 or 100.00
    waiver_amount = Column(Numeric(10, 2), nullable=False, default=0.0)  # Flat discount amount if applicable
    reason = Column(String(255), nullable=True)

    concession_type = relationship("FeeConcessionType", back_populates="head_rules")
    fee_head = relationship("FeeHead")


