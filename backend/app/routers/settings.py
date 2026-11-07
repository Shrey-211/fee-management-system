import os
from typing import Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..config import settings
from ..auth import require_admin
from ..services.backup_service import perform_sqlite_backup, list_backups

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
def create_backup_now(admin: User = Depends(require_admin)):
    dest = perform_sqlite_backup()
    if not dest:
        raise HTTPException(status_code=500, detail="Database file not found to backup")
    return {"message": "Backup created successfully", "filepath": dest}

@router.get("/backups/download/{filename}")
def download_backup_file(filename: str, admin: User = Depends(require_admin)):
    file_path = settings.BACKUP_DIR / filename
    if not file_path.exists() or not filename.endswith(".db"):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(
        path=str(file_path),
        filename=filename,
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
def update_smtp_settings(cfg: SmtpConfigUpdate, admin: User = Depends(require_admin)):
    settings.SMTP_HOST = cfg.smtp_host
    settings.SMTP_PORT = cfg.smtp_port
    settings.SMTP_USERNAME = cfg.smtp_username
    settings.SMTP_PASSWORD = cfg.smtp_password
    settings.SMTP_FROM_EMAIL = cfg.smtp_from_email
    settings.SMTP_FROM_NAME = cfg.smtp_from_name
    settings.SMTP_USE_TLS = cfg.use_tls

    # Save to .env
    env_path = settings.DATA_DIR.parent / ".env"
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(f"SMTP_HOST={cfg.smtp_host}\n")
        f.write(f"SMTP_PORT={cfg.smtp_port}\n")
        f.write(f"SMTP_USERNAME={cfg.smtp_username}\n")
        f.write(f"SMTP_PASSWORD={cfg.smtp_password}\n")
        f.write(f"SMTP_FROM_EMAIL={cfg.smtp_from_email}\n")
        f.write(f"SMTP_FROM_NAME={cfg.smtp_from_name}\n")
        f.write(f"SMTP_USE_TLS={'true' if cfg.use_tls else 'false'}\n")

    return {"message": "SMTP configuration updated successfully"}
