from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Numeric, Date as SqlDate, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Fine(Base):
    __tablename__ = "fines"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    event_name = Column(String(100), nullable=False)  # Krishna Utsav, Freshers, Send-off, etc.
    amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    fine_date = Column(SqlDate, default=date.today, nullable=False)
    status = Column(String(20), default="UNPAID", nullable=False)  # UNPAID, PARTIALLY_PAID, PAID, WAIVED
    paid_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    balance = Column(Numeric(10, 2), nullable=False, default=0.0)
    remarks = Column(String(255), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="fines")
    payment_items = relationship("PaymentItem", back_populates="fine")
