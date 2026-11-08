from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.reminder import EmailTemplate, ReminderLog
from ..models.user import User
from ..schemas.reminder import (
    EmailTemplateCreate, EmailTemplateUpdate, EmailTemplateResponse,
    SendReminderRequest, TestEmailRequest
)
from ..auth import get_current_user, require_accountant_or_admin
from ..services.email_service import dispatch_reminder_to_student, send_smtp_email

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])

@router.get("/templates", response_model=List[EmailTemplateResponse])
def get_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(EmailTemplate).all()

@router.post("/templates", response_model=EmailTemplateResponse)
def create_template(
    tmpl_in: EmailTemplateCreate,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    tmpl = EmailTemplate(
        name=tmpl_in.name.strip(),
        subject=tmpl_in.subject.strip(),
        body_template=tmpl_in.body_template,
        is_default=tmpl_in.is_default
    )
    if tmpl_in.is_default:
        db.query(EmailTemplate).update({EmailTemplate.is_default: False})

    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.put("/templates/{template_id}", response_model=EmailTemplateResponse)
def update_template(
    template_id: int,
    tmpl_in: EmailTemplateUpdate,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    tmpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if tmpl_in.subject is not None:
        tmpl.subject = tmpl_in.subject.strip()
    if tmpl_in.body_template is not None:
        tmpl.body_template = tmpl_in.body_template
    if tmpl_in.is_default is not None:
        if tmpl_in.is_default:
            db.query(EmailTemplate).filter(EmailTemplate.id != template_id).update({EmailTemplate.is_default: False})
        tmpl.is_default = tmpl_in.is_default

    db.commit()
    db.refresh(tmpl)
    return tmpl

@router.post("/send")
def send_reminders(
    req: SendReminderRequest,
    current_user: User = Depends(require_accountant_or_admin),
    db: Session = Depends(get_db)
):
    if not req.student_ids:
        raise HTTPException(status_code=400, detail="No students selected for reminder")

    results = []
    due_date = req.target_due_date or "Within 7 Days"
    for s_id in req.student_ids:
        try:
            log = dispatch_reminder_to_student(
                db=db,
                student_id=s_id,
                template_id=req.template_id,
                due_date=due_date
            )
            results.append({
                "student_id": s_id,
                "status": log.status,
                "recipient": log.recipient_email,
                "error": log.error_message
            })
        except Exception as e:
            results.append({
                "student_id": s_id,
                "status": "FAILED",
                "error": str(e)
            })

    return {
        "total_dispatched": len(results),
        "successful": sum(1 for r in results if r["status"] == "SENT"),
        "failed": sum(1 for r in results if r["status"] == "FAILED"),
        "details": results
    }

@router.get("/logs")
def get_reminder_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = db.query(ReminderLog).order_by(ReminderLog.sent_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "student_id": l.student_id,
            "student_name": l.student.full_name if l.student else "Unknown",
            "student_code": l.student.student_code if l.student else "N/A",
            "recipient_email": l.recipient_email,
            "subject": l.subject,
            "sent_at": l.sent_at,
            "status": l.status,
            "error_message": l.error_message
        }
        for l in logs
    ]

@router.post("/test")
def test_smtp_configuration(
    test_req: TestEmailRequest,
    current_user: User = Depends(require_accountant_or_admin)
):
    smtp_override = {
        "host": test_req.smtp_host,
        "port": test_req.smtp_port,
        "username": test_req.smtp_username,
        "password": test_req.smtp_password,
        "from_email": test_req.smtp_from_email,
        "from_name": test_req.smtp_from_name
    }
    res = send_smtp_email(
        to_email=test_req.test_email,
        subject="Test Notification — Student Fee Management System",
        body_text="This is a test notification confirming your SMTP email configuration is operating properly.",
        smtp_override=smtp_override
    )
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["error"])
    return {"message": f"Test email sent successfully to {test_req.test_email}"}

