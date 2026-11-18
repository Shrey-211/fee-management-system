import io
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Any, Optional
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image as OpenpyxlImage
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..config import settings
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


def add_college_excel_header(ws, report_title: str, subtitle: str, end_col: str = "H") -> int:
    """
    Adds full institutional college header at the top of the Excel worksheet spanning all columns.
    Returns row index (6) where table headers begin.
    """
    # Set professional row heights for header block
    ws.row_dimensions[1].height = 32
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 20
    ws.row_dimensions[4].height = 18
    ws.row_dimensions[5].height = 10

    # Row 1: Full College Name spanning from Column A to End Column at the very top
    ws.merge_cells(f"A1:{end_col}1")
    cell_r1 = ws["A1"]
    cell_r1.value = settings.COLLEGE_NAME.upper()
    cell_r1.font = Font(name="Calibri", size=13, bold=True, color="1E3A8A")
    cell_r1.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # Row 2: College Location & Affiliation
    ws.merge_cells(f"A2:{end_col}2")
    cell_r2 = ws["A2"]
    cell_r2.value = f"{settings.COLLEGE_ADDRESS} | {settings.COLLEGE_TAGLINE}"
    cell_r2.font = Font(name="Calibri", size=9.5, italic=True, color="475569")
    cell_r2.alignment = Alignment(horizontal="center", vertical="center")

    # Row 3: System & Report Title
    ws.merge_cells(f"A3:{end_col}3")
    cell_r3 = ws["A3"]
    cell_r3.value = f"COLLEGE FEE MANAGEMENT SYSTEM — {report_title.upper()}"
    cell_r3.font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    cell_r3.alignment = Alignment(horizontal="center", vertical="center")

    # Row 4: Period & Metadata
    ws.merge_cells(f"A4:{end_col}4")
    cell_r4 = ws["A4"]
    cell_r4.value = subtitle
    cell_r4.font = Font(name="Calibri", size=9.5, italic=True, color="64748B")
    cell_r4.alignment = Alignment(horizontal="center", vertical="center")

    return 6


def generate_daily_collection_report(
    db: Session,
    report_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    academic_year: Optional[str] = None,
    year_of_study: Optional[int] = None
) -> Dict[str, Any]:
    query = db.query(Payment)
    if report_date:
        query = query.filter(Payment.payment_date == report_date)
    else:
        if start_date:
            query = query.filter(Payment.payment_date >= start_date)
        if end_date:
            query = query.filter(Payment.payment_date <= end_date)

    if year_of_study:
        query = query.join(Student).filter(Student.current_year == year_of_study)

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
            "student_current_year": student.current_year if student else 1,
            "category": student.category if student else "N/A",
            "payment_mode": p.payment_mode,
            "payment_date": str(p.payment_date),
            "total_amount": float(amt),
            "head_breakdown": {k: float(v) for k, v in breakdown.items()},
            "fine_amount": float(fine_part)
        })

    return {
        "college_name": settings.COLLEGE_NAME,
        "college_short_name": settings.COLLEGE_SHORT_NAME,
        "college_address": settings.COLLEGE_ADDRESS,
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


def export_daily_collection_excel(
    db: Session,
    start_date: date,
    end_date: date,
    year_of_study: Optional[int] = None
) -> io.BytesIO:
    report_data = generate_daily_collection_report(
        db, start_date=start_date, end_date=end_date, year_of_study=year_of_study
    )
    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Collection Report"

    yr_label = f"{year_of_study}st Year" if year_of_study == 1 else f"{year_of_study}nd Year" if year_of_study == 2 else "All Years"

    # College Title Header at the top
    header_row = add_college_excel_header(
        ws,
        report_title="Daily Fee Collection Report",
        subtitle=f"Period: {start_date} to {end_date} | Year: {yr_label} | Phaltan, Maharashtra | Generated: {date.today()}",
        end_col="I"
    )

    # Table Headers at Row 6
    headers = [
        "Receipt Date", "System Receipt #", "Manual Receipt #", "Student ID", 
        "Student Name", "Year", "Category", "Payment Mode", "Amount (₹)"
    ]
    for c_idx, h in enumerate(headers, 1):
        ws.cell(row=header_row, column=c_idx, value=h)
    style_row(ws[header_row], fill=HEADER_FILL, font=HEADER_FONT, alignment=Alignment(horizontal="center"))

    row_idx = header_row + 1
    for item in report_data["items"]:
        row_vals = [
            item["payment_date"],
            item["receipt_no"],
            item["physical_receipt_no"],
            item["student_code"],
            item["student_name"],
            "2nd Year" if item.get("student_current_year") == 2 else "1st Year",
            item["category"],
            item["payment_mode"],
            item["total_amount"]
        ]
        for c_idx, val in enumerate(row_vals, 1):
            ws.cell(row=row_idx, column=c_idx, value=val)
        style_row(ws[row_idx], font=NORMAL_FONT)
        ws[f"I{row_idx}"].number_format = "#,##0.00"
        row_idx += 1

    # Total Row
    total_vals = [
        "TOTAL", "", "", "", "", "", "", "", report_data["total_collected"]
    ]
    for c_idx, val in enumerate(total_vals, 1):
        ws.cell(row=row_idx, column=c_idx, value=val)
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


def export_outstanding_dues_excel(
    db: Session,
    academic_year: Optional[str] = None,
    year_of_study: Optional[int] = None
) -> io.BytesIO:
    query = db.query(Student).filter(Student.is_active == True)
    if academic_year:
        clean_ay = academic_year.replace("20", "").strip()
        query = query.filter(
            (Student.academic_year == academic_year.strip()) |
            (Student.academic_year == clean_ay) |
            (Student.academic_year.like(f"%{clean_ay}%"))
        )
    if year_of_study:
        query = query.filter(Student.current_year == year_of_study)

    students = query.order_by(Student.full_name.asc()).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Outstanding Fee Balances"

    yr_label = f"{year_of_study}st Year" if year_of_study == 1 else f"{year_of_study}nd Year" if year_of_study == 2 else "All Years"

    # College Title Header at the top
    header_row = add_college_excel_header(
        ws,
        report_title="Student Outstanding Balances Report",
        subtitle=f"Academic Year: {academic_year or 'All'} | Class: {yr_label} | Includes Applicable Waivers & Fines | Phaltan, Maharashtra | Generated: {date.today()}",
        end_col="M"
    )

    headers = [
        "Student Code", "Student Name", "Year", "Gender", "Category", "Mobile",
        "Applicable Fee (₹)", "Fee Paid (₹)", "Fee Balance (₹)", "1st Yr Arrears (₹)",
        "Fines Total (₹)", "Fines Paid (₹)", "Net Total Due (₹)"
    ]
    for c_idx, h in enumerate(headers, 1):
        ws.cell(row=header_row, column=c_idx, value=h)
    style_row(ws[header_row], fill=HEADER_FILL, font=HEADER_FONT, alignment=Alignment(horizontal="center"))

    row_idx = header_row + 1
    tot_fee = Decimal("0.00")
    tot_paid = Decimal("0.00")
    tot_fee_bal = Decimal("0.00")
    tot_y1_bal = Decimal("0.00")
    tot_fines = Decimal("0.00")
    tot_fines_paid = Decimal("0.00")
    tot_overall_due = Decimal("0.00")

    for s in students:
        # Fee heads
        applicable = sum([quantize_amount(h.net_due) for h in s.fee_heads], Decimal("0.00"))
        fee_paid = sum([quantize_amount(h.paid_amount) for h in s.fee_heads], Decimal("0.00"))
        fee_bal = sum([quantize_amount(h.balance) for h in s.fee_heads], Decimal("0.00"))

        # Year 1 arrears (if student in 2nd year or beyond)
        y1_bal = Decimal("0.00")
        if s.current_year >= 2:
            y1_bal = sum([quantize_amount(h.balance) for h in s.fee_heads if getattr(h.fee_head, 'year_of_study', 1) == 1], Decimal("0.00"))

        # Fines
        active_fines = [f for f in s.fines if f.status != "WAIVED"]
        fines_amt = sum([quantize_amount(f.amount) for f in active_fines], Decimal("0.00"))
        fines_p = sum([quantize_amount(f.paid_amount) for f in active_fines], Decimal("0.00"))
        fines_bal = sum([quantize_amount(f.balance) for f in active_fines], Decimal("0.00"))

        net_due = quantize_amount(fee_bal + fines_bal)

        tot_fee += applicable
        tot_paid += fee_paid
        tot_fee_bal += fee_bal
        tot_y1_bal += y1_bal
        tot_fines += fines_amt
        tot_fines_paid += fines_p
        tot_overall_due += net_due

        yr_str = "2nd Year" if s.current_year == 2 else "1st Year" if s.current_year == 1 else "Passed Out"

        row_vals = [
            s.student_code, s.full_name, yr_str, s.gender, s.category, s.mobile_number or "N/A",
            float(applicable), float(fee_paid), float(fee_bal), float(y1_bal),
            float(fines_amt), float(fines_p), float(net_due)
        ]
        for c_idx, val in enumerate(row_vals, 1):
            ws.cell(row=row_idx, column=c_idx, value=val)
        style_row(ws[row_idx], font=NORMAL_FONT)
        for c in ["G", "H", "I", "J", "K", "L", "M"]:
            ws[f"{c}{row_idx}"].number_format = "#,##0.00"
        row_idx += 1

    total_vals = [
        "TOTAL", "", "", "", "", "",
        float(tot_fee), float(tot_paid), float(tot_fee_bal), float(tot_y1_bal),
        float(tot_fines), float(tot_fines_paid), float(tot_overall_due)
    ]
    for c_idx, val in enumerate(total_vals, 1):
        ws.cell(row=row_idx, column=c_idx, value=val)
    style_row(ws[row_idx], fill=TOTAL_FILL, font=BOLD_FONT)
    for c in ["G", "H", "I", "J", "K", "L", "M"]:
        ws[f"{c}{row_idx}"].number_format = "#,##0.00"

    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or '')) for cell in col if not type(cell).__name__ == "MergedCell")
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
    ws.column_dimensions["A"].width = max(ws.column_dimensions["A"].width or 0, 16)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def export_scholarships_excel(
    db: Session,
    status: Optional[str] = None,
    search: Optional[str] = None,
    ids: Optional[List[int]] = None
) -> io.BytesIO:
    query = db.query(ScholarshipCredit).join(Student, ScholarshipCredit.student_id == Student.id)
    if ids is not None and len(ids) > 0:
        query = query.filter(ScholarshipCredit.id.in_(ids))
    else:
        if search:
            s = f"%{search.strip()}%"
            from sqlalchemy import or_
            query = query.filter(or_(
                Student.full_name.ilike(s),
                Student.student_code.ilike(s),
                ScholarshipCredit.scholarship_name.ilike(s),
                ScholarshipCredit.sanction_order_no.ilike(s)
            ))

    credits = query.order_by(ScholarshipCredit.id.desc()).all()

    # Apply status filter if not already filtered by exact IDs
    filtered = []
    for sc in credits:
        amt = quantize_amount(sc.amount)
        rec = quantize_amount(getattr(sc, 'received_amount', None) or (amt if getattr(sc, 'status', None) == 'RECEIVED' else Decimal("0.00")))
        rem = quantize_amount(max(Decimal("0.00"), amt - rec))
        if rec <= Decimal("0.00"):
            st = "NOT_RECEIVED"
        elif rec >= amt:
            st = "RECEIVED"
        else:
            st = "PARTIALLY_RECEIVED"

        if (ids is None or len(ids) == 0) and status:
            stat_filter = status.upper().strip()
            if stat_filter in ["PARTIAL", "PARTIALLY_RECEIVED"] and st != "PARTIALLY_RECEIVED":
                continue
            elif stat_filter == "RECEIVED" and st != "RECEIVED":
                continue
            elif stat_filter in ["NOT_RECEIVED", "PENDING"] and st != "NOT_RECEIVED":
                continue

        filtered.append({
            "sc": sc,
            "amt": amt,
            "rec": rec,
            "rem": rem,
            "status": st
        })

    wb = Workbook()
    ws = wb.active
    ws.title = "Scholarship Claims"

    stat_label = (status or "ALL CLAIMS").replace("_", " ").title()
    header_row = add_college_excel_header(
        ws,
        report_title="Government Scholarships & DBT Claims Report",
        subtitle=f"Filter: {stat_label} | Total Claims: {len(filtered)} | Phaltan, Maharashtra | Generated: {date.today()}",
        end_col="M"
    )

    headers = [
        "Sr. No.", "Student Code", "Student Full Name", "Year / Class", "Academic Year",
        "Category", "Fee Head", "Scholarship Scheme", "Sanction Order #",
        "Sanctioned Amount (₹)", "Received Amount (₹)", "Remaining Due (₹)", "Status"
    ]
    for c_idx, h in enumerate(headers, 1):
        ws.cell(row=header_row, column=c_idx, value=h)
    style_row(ws[header_row], fill=HEADER_FILL, font=HEADER_FONT, alignment=Alignment(horizontal="center"))

    row_idx = header_row + 1
    tot_sanctioned = Decimal("0.00")
    tot_received = Decimal("0.00")
    tot_remaining = Decimal("0.00")

    for idx, item in enumerate(filtered, 1):
        sc = item["sc"]
        s = sc.student
        amt = item["amt"]
        rec = item["rec"]
        rem = item["rem"]
        st = item["status"]

        tot_sanctioned += amt
        tot_received += rec
        tot_remaining += rem

        yr_str = "2nd Year" if getattr(s, 'current_year', 1) == 2 else "1st Year" if getattr(s, 'current_year', 1) == 1 else "Passed Out"
        status_display = "Received" if st == "RECEIVED" else "Partially Received" if st == "PARTIALLY_RECEIVED" else "Not Received"

        row_vals = [
            idx,
            s.student_code if s else "N/A",
            s.full_name if s else "Unknown",
            yr_str,
            s.academic_year if s else "N/A",
            s.category if s else "N/A",
            sc.fee_head.name if sc.fee_head else "Tuition / General",
            sc.scholarship_name,
            sc.sanction_order_no or "Pending",
            float(amt),
            float(rec),
            float(rem),
            status_display
        ]

        for c_idx, val in enumerate(row_vals, 1):
            ws.cell(row=row_idx, column=c_idx, value=val)
        style_row(ws[row_idx], font=NORMAL_FONT)
        for c in ["J", "K", "L"]:
            ws[f"{c}{row_idx}"].number_format = "#,##0.00"
        row_idx += 1

    total_vals = [
        "TOTAL", "", "", "", "", "", "", "", "",
        float(tot_sanctioned), float(tot_received), float(tot_remaining), ""
    ]
    for c_idx, val in enumerate(total_vals, 1):
        ws.cell(row=row_idx, column=c_idx, value=val)
    style_row(ws[row_idx], fill=TOTAL_FILL, font=BOLD_FONT)
    for c in ["J", "K", "L"]:
        ws[f"{c}{row_idx}"].number_format = "#,##0.00"

    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or '')) for cell in col if not type(cell).__name__ == "MergedCell")
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
