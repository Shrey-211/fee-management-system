from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from ..models.student import Student
from ..models.fee import FeeHead, StudentFeeHead, FeeConcessionType, FeeTypeHeadRule
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
    category: str,
    concession_type_id: Optional[int] = None,
    db: Optional[Session] = None
) -> Tuple[Decimal, Decimal, str]:
    """
    Evaluates discount percent, discount amount, and reason.
    Priority 1: Evaluates dynamic FeeConcessionType rules configured in Settings.
    Priority 2: Fallback to college baseline rules if dynamic types are not yet populated.
    """
    base = quantize_amount(fee_head.base_amount)
    code = (fee_head.code or "").upper().strip()
    gender = (gender or "").upper().strip()
    category = (category or "").upper().strip()

    # 1. Attempt dynamic evaluation from configured FeeConcessionType & FeeTypeHeadRule
    if db is not None:
        try:
            # Fetch active concession types
            types = db.query(FeeConcessionType).filter(
                FeeConcessionType.is_active == True,
                FeeConcessionType.academic_year == fee_head.academic_year
            ).all()

            if not types:
                types = db.query(FeeConcessionType).filter(FeeConcessionType.is_active == True).all()

            applicable_types = []
            for t in types:
                t_code = (t.code or "").upper().strip()
                t_group = (t.type_group or "").upper().strip()

                if t_group == "GENDER":
                    if t_code == gender or (gender == "FEMALE" and ("GIRL" in t_code or "FEMALE" in t_code)):
                        applicable_types.append(t)
                elif t_group == "CASTE":
                    if t_code == category:
                        applicable_types.append(t)
                    elif category in ["SC", "ST"] and t_code in ["SC", "ST", "SC/ST", "SC_ST"]:
                        applicable_types.append(t)
                elif t_group == "CUSTOM":
                    if concession_type_id and t.id == concession_type_id:
                        applicable_types.append(t)

            if applicable_types:
                # Find maximum discount across all applicable types for this fee head
                best_discount = Decimal("0.00")
                best_pct = Decimal("0.00")
                best_reason = None

                for app_type in applicable_types:
                    for rule in app_type.head_rules:
                        if rule.fee_head_id == fee_head.id:
                            rule_pct = quantize_amount(rule.waiver_percent)
                            pct_disc = quantize_amount(base * (rule_pct / Decimal("100.00")))
                            fix_disc = quantize_amount(rule.waiver_amount or 0)
                            disc = max(pct_disc, fix_disc)
                            if rule_pct >= Decimal("100.00") or disc >= base:
                                disc = base
                                rule_pct = Decimal("100.00")

                            if disc > best_discount or (disc == best_discount and best_reason is None):
                                best_discount = disc
                                best_pct = rule_pct
                                best_reason = rule.reason or f"{rule_pct}% Waived ({app_type.name})"

                if best_discount > Decimal("0.00"):
                    return best_pct, best_discount, best_reason or f"{best_pct}% Waived"
                elif not fee_head.allows_waiver or code in ["DRESS_CODE", "EXAM", "OTHER", "DRESS"]:
                    return Decimal("0.00"), Decimal("0.00"), "Compulsory Fee (Applicable to all)"
                else:
                    return Decimal("0.00"), Decimal("0.00"), best_reason or "Standard Fee"
        except Exception as e:
            # Fall back to default deterministic rules on error
            pass

    # 2. Fallback to baseline default PRD rules
    # Compulsory non-waiver fee heads
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
            category=student.category,
            concession_type_id=getattr(student, 'concession_type_id', None),
            db=db
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

        # Synchronize Government Scholarship entry for any fee head category waiver
        existing_sc = db.query(ScholarshipCredit).filter(
            ScholarshipCredit.student_id == student.id,
            ScholarshipCredit.fee_head_id == fh.id
        ).first()

        if discount_amt > Decimal("0.00"):
            scheme_name = reason or f"{student.category} Govt Scholarship Scheme"
            if existing_sc:
                # If not yet disbursed from government, keep amount and scheme synchronized
                if existing_sc.status != "RECEIVED":
                    existing_sc.amount = discount_amt
                    existing_sc.scholarship_name = scheme_name
                    existing_sc.remarks = "Not Received"
            else:
                new_sc = ScholarshipCredit(
                    student_id=student.id,
                    fee_head_id=fh.id,
                    scholarship_name=scheme_name,
                    amount=discount_amt,
                    status="NOT_RECEIVED",
                    credit_date=None,
                    sanction_order_no=None,
                    remarks="Not Received"
                )
                db.add(new_sc)
        else:
            # If no discount applies and there was an unreceived pending entry, clean it up
            if existing_sc and existing_sc.status != "RECEIVED":
                db.delete(existing_sc)


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
            PaymentItem.fee_head_id == sfh.fee_head_id,
            Payment.payment_mode != "GOVT_SCHOLARSHIP"
        ).all()
        total_paid_head = sum([quantize_amount(item.amount) for item in paid_from_payments], Decimal("0.00"))

        sfh.paid_amount = quantize_amount(total_paid_head)
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


def reapply_all_student_fee_rules(db: Session, academic_year: Optional[str] = None) -> int:
    """
    Recalculates fee heads and balances for all enrolled students based on updated fee types and heads.
    Returns the count of updated students.
    """
    query = db.query(Student).filter(Student.is_active == True)
    if academic_year:
        query = query.filter(Student.academic_year == academic_year)
    students = query.all()
    for s in students:
        initialize_student_fees(s, db)
        recalculate_student_balances(s.id, db)
    db.commit()
    return len(students)


