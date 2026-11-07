from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple
from sqlalchemy.orm import Session
from ..models.student import Student
from ..models.fee import FeeHead, StudentFeeHead
from ..models.payment import PaymentItem, Payment
from ..models.fine import Fine
from ..models.scholarship import ScholarshipCredit

TWO_PLACES = Decimal("0.01")

def quantize_amount(val: Decimal | float | int | str) -> Decimal:
    """Ensure precise 2-decimal arithmetic without floating-point artifacts."""
    if not isinstance(val, Decimal):
        val = Decimal(str(val))
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def calculate_fee_waiver(
    fee_head: FeeHead,
    gender: str,
    category: str
) -> Tuple[Decimal, Decimal, str]:
    """
    Evaluates discount percent, discount amount, and reason based on PRD requirements:
    - Dress-code, University Exam, and Other charges are applicable to all students (0% discount).
    - Tuition is waived (100%) for Girls.
    - Tuition and Development fees are waived (100%) for SC/ST students.
    - Development fees apply to other categories.
    - EBC students receive 50% discount on Tuition.
    - Overlapping resolution: SC/ST takes precedence; Girls 100% waiver takes precedence over EBC 50%.
    """
    base = quantize_amount(fee_head.base_amount)
    code = (fee_head.code or "").upper().strip()
    gender = (gender or "").upper().strip()
    category = (category or "").upper().strip()

    # Compulsory non-waiver fee heads: Dress Code, University Exam, Other charges
    if not fee_head.allows_waiver or code in ["DRESS_CODE", "EXAM", "OTHER", "DRESS"]:
        return Decimal("0.00"), Decimal("0.00"), "Compulsory Fee (Applicable to all)"

    discount_percent = Decimal("0.00")
    reason = "Standard Fee"

    # SC / ST Category Rules (Tuition and Development 100% waived)
    if category in ["SC", "ST"]:
        if "TUITION" in code or "DEVELOPMENT" in code or "DEV" in code:
            discount_percent = Decimal("100.00")
            reason = f"100% Waived ({category} Category Scheme)"
            discount_amount = base
            return discount_percent, discount_amount, reason

    # Tuition Fee Rules (Girls & EBC)
    if "TUITION" in code:
        if gender == "FEMALE":
            discount_percent = Decimal("100.00")
            reason = "100% Waived (Girl Student Scheme)"
            discount_amount = base
            return discount_percent, discount_amount, reason
        elif category == "EBC":
            discount_percent = Decimal("50.00")
            reason = "50% Discount (EBC Scheme)"
            discount_amount = quantize_amount(base * Decimal("0.50"))
            return discount_percent, discount_amount, reason

    # Development Fee for other categories (Applicable at 100%)
    if "DEVELOPMENT" in code or "DEV" in code:
        discount_percent = Decimal("0.00")
        reason = "Applicable Development Fee"
        return discount_percent, Decimal("0.00"), reason

    # Default fallback
    discount_amount = quantize_amount(base * (discount_percent / Decimal("100.00")))
    return discount_percent, discount_amount, reason


def initialize_student_fees(student: Student, db: Session) -> List[StudentFeeHead]:
    """
    Initializes or updates StudentFeeHead records for the student's academic year.
    Preserves paid amounts if recalculating.
    """
    fee_heads = db.query(FeeHead).filter(FeeHead.academic_year == student.academic_year).all()
    if not fee_heads:
        # Fallback to any active fee heads
        fee_heads = db.query(FeeHead).all()

    existing_sfh_map = {sfh.fee_head_id: sfh for sfh in student.fee_heads}
    result = []

    for fh in fee_heads:
        discount_pct, discount_amt, reason = calculate_fee_waiver(
            fee_head=fh,
            gender=student.gender,
            category=student.category
        )
        base = quantize_amount(fh.base_amount)
        net = quantize_amount(base - discount_amt)

        if fh.id in existing_sfh_map:
            sfh = existing_sfh_map[fh.id]
            sfh.base_amount = base
            sfh.discount_percent = discount_pct
            sfh.discount_amount = discount_amt
            sfh.net_due = net
            sfh.waiver_reason = reason
            sfh.balance = quantize_amount(net - quantize_amount(sfh.paid_amount))
            result.append(sfh)
        else:
            sfh = StudentFeeHead(
                student_id=student.id,
                fee_head_id=fh.id,
                base_amount=base,
                discount_percent=discount_pct,
                discount_amount=discount_amt,
                net_due=net,
                paid_amount=Decimal("0.00"),
                balance=net,
                waiver_reason=reason
            )
            db.add(sfh)
            result.append(sfh)

    db.flush()
    return result


def recalculate_student_balances(student_id: int, db: Session):
    """
    Recomputes paid amounts and balances across all student fee heads, fines, and total ledger.
    Handles exact decimal arithmetic to ensure residual balances (even ₹1) are maintained accurately.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        return

    # 1. Calculate fee head payments from payment items
    for sfh in student.fee_heads:
        paid_from_payments = db.query(PaymentItem).join(Payment).filter(
            Payment.student_id == student_id,
            PaymentItem.fee_head_id == sfh.fee_head_id
        ).all()
        total_paid_head = sum([quantize_amount(item.amount) for item in paid_from_payments], Decimal("0.00"))

        # Also credit scholarships allocated to this fee head
        scholarship_credits = db.query(ScholarshipCredit).filter(
            ScholarshipCredit.student_id == student_id,
            ScholarshipCredit.fee_head_id == sfh.fee_head_id
        ).all()
        total_scholarship = sum([quantize_amount(sc.amount) for sc in scholarship_credits], Decimal("0.00"))

        sfh.paid_amount = quantize_amount(total_paid_head + total_scholarship)
        sfh.balance = quantize_amount(sfh.net_due - sfh.paid_amount)

    # 2. Calculate fine balances
    fines = db.query(Fine).filter(Fine.student_id == student_id).all()
    for fine in fines:
        if fine.status == "WAIVED":
            fine.balance = Decimal("0.00")
            continue
        fine_paid_items = db.query(PaymentItem).filter(PaymentItem.fine_id == fine.id).all()
        paid_fine = sum([quantize_amount(item.amount) for item in fine_paid_items], Decimal("0.00"))
        fine.paid_amount = quantize_amount(paid_fine)
        fine.balance = quantize_amount(fine.amount - fine.paid_amount)
        if fine.balance <= Decimal("0.00"):
            fine.status = "PAID"
        elif fine.paid_amount > Decimal("0.00"):
            fine.status = "PARTIALLY_PAID"
        else:
            fine.status = "UNPAID"

    db.commit()
