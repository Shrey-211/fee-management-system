import os
from typing import Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from dotenv import set_key
from ..database import get_db
from ..models.user import User
from ..models.audit import AuditLog
from ..config import settings
from ..auth import require_admin
from ..services.backup_service import perform_sqlite_backup, list_backups
from ..services.audit_service import log_audit

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SmtpConfigUpdate(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    smtp_from_email: str
    smtp_from_name: str
    use_tls: bool = True

@router.get("/backups")
def get_backup_list(admin: User = Depends(require_admin)) -> List[Dict[str, Any]]:
    return list_backups()

@router.post("/backups/create")
def create_backup_now(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    dest = perform_sqlite_backup()
    if not dest:
        raise HTTPException(status_code=500, detail="Database file not found to backup")
    
    log_audit(
        db,
        action="CREATE_BACKUP",
        entity_name="backups",
        user_id=admin.id,
        details={"backup_filepath": dest}
    )
    db.commit()
    return {"message": "Backup created successfully", "filepath": dest}

@router.get("/backups/download/{filename}")
def download_backup_file(
    filename: str, 
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".db"):
        raise HTTPException(status_code=400, detail="Invalid backup file format")

    file_path = (settings.BACKUP_DIR / safe_name).resolve()
    backup_dir_resolved = settings.BACKUP_DIR.resolve()

    if not file_path.is_relative_to(backup_dir_resolved) or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    log_audit(
        db,
        action="DOWNLOAD_BACKUP",
        entity_name="backups",
        user_id=admin.id,
        details={"filename": safe_name}
    )
    db.commit()

    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type="application/x-sqlite3"
    )

@router.get("/smtp")
def get_smtp_settings(admin: User = Depends(require_admin)):
    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_username": settings.SMTP_USERNAME,
        "smtp_from_email": settings.SMTP_FROM_EMAIL,
        "smtp_from_name": settings.SMTP_FROM_NAME,
        "smtp_use_tls": settings.SMTP_USE_TLS,
        "is_configured": bool(settings.SMTP_HOST and settings.SMTP_USERNAME)
    }

@router.post("/smtp")
def update_smtp_settings(
    cfg: SmtpConfigUpdate, 
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    # Sanitize inputs against CRLF
    def clean_str(val: str) -> str:
        return str(val).replace("\r", "").replace("\n", "").strip()

    host = clean_str(cfg.smtp_host)
    username = clean_str(cfg.smtp_username)
    from_email = clean_str(cfg.smtp_from_email)
    from_name = clean_str(cfg.smtp_from_name)
    password = clean_str(cfg.smtp_password)

    settings.SMTP_HOST = host
    settings.SMTP_PORT = cfg.smtp_port
    settings.SMTP_USERNAME = username
    settings.SMTP_PASSWORD = password
    settings.SMTP_FROM_EMAIL = from_email
    settings.SMTP_FROM_NAME = from_name
    settings.SMTP_USE_TLS = cfg.use_tls

    # Safely update .env without truncating other configuration keys
    env_path = str(settings.ENV_PATH)
    try:
        set_key(env_path, "SMTP_HOST", host)
        set_key(env_path, "SMTP_PORT", str(cfg.smtp_port))
        set_key(env_path, "SMTP_USERNAME", username)
        set_key(env_path, "SMTP_PASSWORD", password)
        set_key(env_path, "SMTP_FROM_EMAIL", from_email)
        set_key(env_path, "SMTP_FROM_NAME", from_name)
        set_key(env_path, "SMTP_USE_TLS", "true" if cfg.use_tls else "false")
    except Exception as e:
        print(f"Warning: could not persist SMTP config to .env: {e}")

    log_audit(
        db,
        action="UPDATE_SMTP_SETTINGS",
        entity_name="settings",
        user_id=admin.id,
        details={"smtp_host": host, "smtp_port": cfg.smtp_port, "from_email": from_email}
    )
    db.commit()

    return {"message": "SMTP configuration updated successfully"}

@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_name": l.entity_name,
            "entity_id": l.entity_id,
            "details": l.details,
            "timestamp": l.timestamp
        }
        for l in logs
    ]


