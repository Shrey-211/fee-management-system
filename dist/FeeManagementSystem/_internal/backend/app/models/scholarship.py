from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Numeric, Date as SqlDate, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class ScholarshipCredit(Base):
    __tablename__ = "scholarship_credits"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    fee_head_id = Column(Integer, ForeignKey("fee_heads.id", ondelete="SET NULL"), nullable=True)
    scholarship_name = Column(String(100), nullable=False)  # MahaDBT, Post-Matric, Freeship, etc.
    sanction_order_no = Column(String(100), nullable=True)
    credit_date = Column(SqlDate, nullable=True)
    amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))  # Total Sanctioned / Claim Amount
    received_amount = Column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))  # Total Received to Date
    status = Column(String(20), default="NOT_RECEIVED", nullable=False)  # NOT_RECEIVED, PARTIALLY_RECEIVED, RECEIVED
    remarks = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="scholarships")
    fee_head = relationship("FeeHead")
    disbursements = relationship("ScholarshipDisbursement", back_populates="scholarship", cascade="all, delete-orphan", order_by="ScholarshipDisbursement.disbursement_date.asc()")


class ScholarshipDisbursement(Base):
    __tablename__ = "scholarship_disbursements"

    id = Column(Integer, primary_key=True, index=True)
    scholarship_id = Column(Integer, ForeignKey("scholarship_credits.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(10, 2), nullable=False)
    disbursement_date = Column(SqlDate, nullable=False, default=date.today)
    sanction_order_no = Column(String(100), nullable=True)
    remarks = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    scholarship = relationship("ScholarshipCredit", back_populates="disbursements")
    payment = relationship("Payment")


