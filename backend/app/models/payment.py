from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Numeric, Date as SqlDate, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    internal_receipt_no = Column(String(50), unique=True, index=True, nullable=False)
    physical_receipt_no = Column(String(50), index=True, nullable=False)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    
    payment_date = Column(SqlDate, default=date.today, nullable=False)      # When cash/fee was collected
    entry_date = Column(SqlDate, default=date.today, nullable=False)        # Date entered into system
    bank_deposit_date = Column(SqlDate, nullable=True)                      # Date banked
    
    payment_mode = Column(String(20), default="CASH", nullable=False)       # CASH, UPI, CHEQUE, DD, NEFT
    total_amount = Column(Numeric(10, 2), nullable=False, default=0.0)
    
    deposit_status = Column(String(20), default="UNDEPOSITED_CASH", nullable=False) # UNDEPOSITED_CASH, DEPOSITED
    deposit_batch_id = Column(Integer, ForeignKey("bank_deposit_batches.id"), nullable=True)
    
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="payments")
    deposit_batch = relationship("BankDepositBatch", back_populates="payments")
    items = relationship("PaymentItem", back_populates="payment", cascade="all, delete-orphan")


class PaymentItem(Base):
    __tablename__ = "payment_items"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(Integer, ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    fee_head_id = Column(Integer, ForeignKey("fee_heads.id", ondelete="SET NULL"), nullable=True)
    fine_id = Column(Integer, ForeignKey("fines.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False, default=0.0)

    payment = relationship("Payment", back_populates="items")
    fee_head = relationship("FeeHead")
    fine = relationship("Fine", back_populates="payment_items")
