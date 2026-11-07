from datetime import datetime, date
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
    credit_date = Column(SqlDate, default=date.today, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    remarks = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="scholarships")
    fee_head = relationship("FeeHead")
