import smtplib
from decimal import Decimal
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from ..config import settings
from ..models.student import Student
from ..models.reminder import EmailTemplate, ReminderLog
from .fee_engine import quantize_amount


DEFAULT_TEMPLATE_SUBJECT = "Urgent: Pending Fee Dues Notice - {college_name}"
DEFAULT_TEMPLATE_BODY = """Dear {student_name} (Roll No: {student_code}),

This is an official communication from the College Accounts Office regarding your outstanding fee dues.

Current Total Outstanding: ₹{total_due}

Summary of Dues:
{fee_breakdown}

Target Payment Date: {due_date}

Please visit the Fee Counter (Mr. Shrikant's office) to clear your outstanding dues and obtain an official physical receipt.

Regards,
{sender_name}
{college_name}
"""

def interpolate_template(template_str: str, student: Student, due_date: str = "Immediate") -> str:
    # Compute dues
    total_fee_due = sum([quantize_amount(h.balance) for h in student.fee_heads], Decimal("0.00"))
    total_fine_due = sum([quantize_amount(f.balance) for f in student.fines if f.status != "WAIVED"], Decimal("0.00"))
    net_due = quantize_amount(total_fee_due + total_fine_due)

    breakdown_lines = []
    for h in student.fee_heads:
        if h.balance > 0:
            breakdown_lines.append(f" - {h.fee_head.name}: ₹{quantize_amount(h.balance):,.2f}")
    for f in student.fines:
        if f.status != "WAIVED" and f.balance > 0:
            breakdown_lines.append(f" - Fine ({f.event_name}): ₹{quantize_amount(f.balance):,.2f}")

    if not breakdown_lines:
        breakdown_lines.append(" - No pending fee heads (Residual: ₹0.00)")

    breakdown_text = "\n".join(breakdown_lines)

    replacements = {
        "{student_name}": student.full_name,
        "{student_code}": student.student_code,
        "{total_due}": f"{net_due:,.2f}",
        "{fee_breakdown}": breakdown_text,
        "{due_date}": due_date,
        "{college_name}": settings.COLLEGE_NAME,
        "{sender_name}": settings.SMTP_FROM_NAME or "Accounts Officer"
    }

    result = template_str
    for k, v in replacements.items():
        result = result.replace(k, str(v))
    return result


def sanitize_email_header(val: Any) -> str:
    if val is None:
        return ""
    return str(val).replace("\r", "").replace("\n", "").strip()

def send_smtp_email(
    to_email: str,
    subject: str,
    body_text: str,
    smtp_override: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    host = (smtp_override.get("host") if smtp_override else None) or settings.SMTP_HOST
    port = (smtp_override.get("port") if smtp_override else None) or settings.SMTP_PORT
    username = (smtp_override.get("username") if smtp_override else None) or settings.SMTP_USERNAME
    password = (smtp_override.get("password") if smtp_override else None) or settings.SMTP_PASSWORD
    from_email = (smtp_override.get("from_email") if smtp_override else None) or settings.SMTP_FROM_EMAIL
    from_name = (smtp_override.get("from_name") if smtp_override else None) or settings.SMTP_FROM_NAME

    if not host or not username or not password:
        return {
            "success": False,
            "error": "SMTP server or credentials are not configured in Settings."
        }

    clean_from_name = sanitize_email_header(from_name)
    clean_from_email = sanitize_email_header(from_email)
    clean_to_email = sanitize_email_header(to_email)
    clean_subject = sanitize_email_header(subject)

    msg = MIMEMultipart()
    msg['From'] = f"{clean_from_name} <{clean_from_email}>"
    msg['To'] = clean_to_email
    msg['Subject'] = clean_subject
    msg.attach(MIMEText(body_text, 'plain'))

    try:
        server = smtplib.SMTP(host, int(port), timeout=10)
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        return {"success": True, "error": None}
    except Exception as e:
        return {"success": False, "error": str(e)}


def dispatch_reminder_to_student(
    db: Session,
    student_id: int,
    template_id: Optional[int] = None,
    due_date: str = "Immediate"
) -> ReminderLog:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    if not student.email_address:
        log = ReminderLog(
            student_id=student.id,
            recipient_email="N/A",
            subject="No Email Address Found",
            status="FAILED",
            error_message="Student profile does not contain an email address."
        )
        db.add(log)
        db.commit()
        return log

    template = None
    if template_id:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        template = db.query(EmailTemplate).filter(EmailTemplate.is_default == True).first()

    subj_raw = template.subject if template else DEFAULT_TEMPLATE_SUBJECT
    body_raw = template.body_template if template else DEFAULT_TEMPLATE_BODY

    subject = interpolate_template(subj_raw, student, due_date)
    body = interpolate_template(body_raw, student, due_date)

    res = send_smtp_email(to_email=student.email_address, subject=subject, body_text=body)

    log = ReminderLog(
        student_id=student.id,
        recipient_email=student.email_address,
        subject=subject,
        status="SENT" if res["success"] else "FAILED",
        error_message=res["error"]
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

