import io
from datetime import date
from decimal import Decimal
from typing import Dict, List, Any, Optional
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.payment import Payment, PaymentItem
from ..models.student import Student
from ..models.fee import FeeHead, StudentFeeHead
from ..models.fine import Fine
from ..models.scholarship import ScholarshipCredit
from .fee_engine import quantize_amount

HEADER_FILL = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
TOTAL_FILL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
BOLD_FONT = Font(name="Calibri", size=11, bold=True)
NORMAL_FONT = Font(name="Calibri", size=11)
THIN_BORDER = Border(
    left=Side(style='thin', color='CBD5E1'),
    right=Side(style='thin', color='CBD5E1'),
    top=Side(style='thin', color='CBD5E1'),
    bottom=Side(style='thin', color='CBD5E1')
)

def style_row(row, fill=None, font=NORMAL_FONT, alignment=None, border=THIN_BORDER):
    for cell in row:
        if fill:
            cell.fill = fill
        if font:
            cell.font = font
        if alignment:
            cell.alignment = alignment
        if border:
            cell.border = border


def generate_daily_collection_report(
    db: Session,
    report_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None
) -> Dict[str, Any]:
    query = db.query(Payment)
    if report_date:
        query = query.filter(Payment.payment_date == report_date)
    else:
        if start_date:
            query = query.filter(Payment.payment_date >= start_date)
        if end_date:
            query = query.filter(Payment.payment_date <= end_date)

    payments = query.order_by(Payment.payment_date.asc(), Payment.id.asc()).all()
    fee_heads = db.query(FeeHead).all()
    fh_map = {fh.id: fh.name for fh in fee_heads}

    items = []
    head_totals: Dict[str, Decimal] = {fh.name: Decimal("0.00") for fh in fee_heads}
    fines_total = Decimal("0.00")
    total_cash = Decimal("0.00")
    total_other = Decimal("0.00")

    for p in payments:
        student = p.student
        amt = quantize_amount(p.total_amount)
        if p.payment_mode == "CASH":
            total_cash += amt
        else:
            total_other += amt

        breakdown = {fh.name: Decimal("0.00") for fh in fee_heads}
        fine_part = Decimal("0.00")

        for item in p.items:
            item_amt = quantize_amount(item.amount)
            if item.fee_head_id and item.fee_head_id in fh_map:
                name = fh_map[item.fee_head_id]
                breakdown[name] = quantize_amount(breakdown[name] + item_amt)
                head_totals[name] = quantize_amount(head_totals[name] + item_amt)
            elif item.fine_id:
                fine_part = quantize_amount(fine_part + item_amt)
                fines_total = quantize_amount(fines_total + item_amt)

        items.append({
            "payment_id": p.id,
            "receipt_no": p.internal_receipt_no,
            "physical_receipt_no": p.physical_receipt_no,
            "student_name": student.full_name if student else "N/A",
            "student_code": student.student_code if student else "N/A",
            "category": student.category if student else "N/A",
            "payment_mode": p.payment_mode,
            "payment_date": str(p.payment_date),
            "bank_deposit_date": str(p.bank_deposit_date) if p.bank_deposit_date else "Not Deposited",
            "deposit_status": p.deposit_status,
            "total_amount": float(amt),
            "head_breakdown": {k: float(v) for k, v in breakdown.items()},
            "fine_amount": float(fine_part)
        })

    return {
        "report_date": str(report_date) if report_date else "Custom Range",
        "start_date": str(start_date) if start_date else None,
        "end_date": str(end_date) if end_date else None,
        "payments_count": len(payments),
        "total_collected": float(total_cash + total_other),
        "cash_collected": float(total_cash),
        "other_modes_collected": float(total_other),
        "fee_head_totals": {k: float(v) for k, v in head_totals.items()},
        "fines_total": float(fines_total),
        "items": items
    }


def export_daily_collection_excel(db: Session, start_date: date, end_date: date) -> io.BytesIO:
    report_data = generate_daily_collection_report(db, start_date=start_date, end_date=end_date)
    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Collection Report"

    # College Title Header
    ws.merge_cells("A1:I1")
    ws["A1"] = "COLLEGE FEE MANAGEMENT SYSTEM — FEE COLLECTION REPORT"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    ws["A1"].alignment = Alignment(horizontal="center")

    ws.merge_cells("A2:I2")
    ws["A2"] = f"Period: {start_date} to {end_date} | Generated Offline"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True)
    ws["A2"].alignment = Alignment(horizontal="center")

    ws.append([]) # Row 3 blank

    # Table Headers
    headers = [
        "Receipt Date", "System Receipt #", "Manual Receipt #", "Student ID", 
        "Student Name", "Category", "Payment Mode", "Deposit Status", "Amount (₹)"
    ]
    ws.append(headers)
    style_row(ws[4], fill=HEADER_FILL, font=HEADER_FONT, alignment=Alignment(horizontal="center"))

    row_idx = 5
    for item in report_data["items"]:
        row_vals = [
            item["payment_date"],
            item["receipt_no"],
            item["physical_receipt_no"],
            item["student_code"],
            item["student_name"],
            item["category"],
            item["payment_mode"],
            item["deposit_status"],
            item["total_amount"]
        ]
        ws.append(row_vals)
        style_row(ws[row_idx], font=NORMAL_FONT)
        ws[f"I{row_idx}"].number_format = "#,##0.00"
        row_idx += 1

    # Total Row
    total_row = [
        "TOTAL", "", "", "", "", "", "", "", report_data["total_collected"]
    ]
    ws.append(total_row)
    style_row(ws[row_idx], fill=TOTAL_FILL, font=BOLD_FONT)
    ws[f"I{row_idx}"].number_format = "#,##0.00"

    # Auto-adjust column widths
    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or '')) for cell in col if not type(cell).__name__ == "MergedCell")
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def export_outstanding_dues_excel(db: Session, academic_year: Optional[str] = None) -> io.BytesIO:
    students = db.query(Student).filter(Student.is_active == True).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Outstanding Fee Balances"

    ws.merge_cells("A1:K1")
    ws["A1"] = "COLLEGE FEE MANAGEMENT SYSTEM — OUTSTANDING BALANCES REPORT"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    ws["A1"].alignment = Alignment(horizontal="center")

    ws.merge_cells("A2:K2")
    ws["A2"] = f"Academic Year: {academic_year or 'All Years'} | Includes Applicable Waivers & Fines"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True)
    ws["A2"].alignment = Alignment(horizontal="center")

    ws.append([])

    headers = [
        "Student Code", "Student Name", "Gender", "Category", "Mobile",
        "Applicable Fee (₹)", "Fee Paid (₹)", "Fee Balance (₹)", 
        "Fines Total (₹)", "Fines Paid (₹)", "Net Total Due (₹)"
    ]
    ws.append(headers)
    style_row(ws[4], fill=HEADER_FILL, font=HEADER_FONT, alignment=Alignment(horizontal="center"))

    row_idx = 5
    tot_fee = Decimal("0.00")
    tot_paid = Decimal("0.00")
    tot_fee_bal = Decimal("0.00")
    tot_fines = Decimal("0.00")
    tot_fines_paid = Decimal("0.00")
    tot_overall_due = Decimal("0.00")

    for s in students:
        # Fee heads
        applicable = sum([quantize_amount(h.net_due) for h in s.fee_heads], Decimal("0.00"))
        fee_paid = sum([quantize_amount(h.paid_amount) for h in s.fee_heads], Decimal("0.00"))
        fee_bal = sum([quantize_amount(h.balance) for h in s.fee_heads], Decimal("0.00"))

        # Fines
        active_fines = [f for f in s.fines if f.status != "WAIVED"]
        fines_amt = sum([quantize_amount(f.amount) for f in active_fines], Decimal("0.00"))
        fines_p = sum([quantize_amount(f.paid_amount) for f in active_fines], Decimal("0.00"))
        fines_bal = sum([quantize_amount(f.balance) for f in active_fines], Decimal("0.00"))

        net_due = quantize_amount(fee_bal + fines_bal)

        tot_fee += applicable
        tot_paid += fee_paid
        tot_fee_bal += fee_bal
        tot_fines += fines_amt
        tot_fines_paid += fines_p
        tot_overall_due += net_due

        row = [
            s.student_code, s.full_name, s.gender, s.category, s.mobile_number or "N/A",
            float(applicable), float(fee_paid), float(fee_bal),
            float(fines_amt), float(fines_p), float(net_due)
        ]
        ws.append(row)
        style_row(ws[row_idx], font=NORMAL_FONT)
        for c in ["F", "G", "H", "I", "J", "K"]:
            ws[f"{c}{row_idx}"].number_format = "#,##0.00"
        row_idx += 1

    total_row = [
        "TOTAL", "", "", "", "",
        float(tot_fee), float(tot_paid), float(tot_fee_bal),
        float(tot_fines), float(tot_fines_paid), float(tot_overall_due)
    ]
    ws.append(total_row)
    style_row(ws[row_idx], fill=TOTAL_FILL, font=BOLD_FONT)
    for c in ["F", "G", "H", "I", "J", "K"]:
        ws[f"{c}{row_idx}"].number_format = "#,##0.00"

    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or '')) for cell in col if not type(cell).__name__ == "MergedCell")
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
