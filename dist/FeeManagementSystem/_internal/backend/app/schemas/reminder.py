from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body_template: str
    is_default: bool = False

class EmailTemplateUpdate(BaseModel):
    subject: Optional[str] = None
    body_template: Optional[str] = None
    is_default: Optional[bool] = None

class EmailTemplateResponse(BaseModel):
    id: int
    name: str
    subject: str
    body_template: str
    is_default: bool
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SendReminderRequest(BaseModel):
    student_ids: List[int]
    template_id: Optional[int] = None
    custom_subject: Optional[str] = None
    custom_body: Optional[str] = None
    target_due_date: Optional[str] = None

class TestEmailRequest(BaseModel):
    test_email: str
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    use_tls: Optional[bool] = True

