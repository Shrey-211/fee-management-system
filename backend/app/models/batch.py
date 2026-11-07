from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Numeric, Date as SqlDate, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class BankDepositBatch(Base):
    __tablename__ = "bank_deposit_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True, nullable=False)
    deposit_date = Column(SqlDate, default=date.today, nullable=False)
    total_cash_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    bank_name = Column(String(100), nullable=True)
    bank_challan_no = Column(String(100), nullable=True)
    status = Column(String(20), default="DEPOSITED", nullable=False)  # PENDING, DEPOSITED
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    payments = relationship("Payment", back_populates="deposit_batch")
