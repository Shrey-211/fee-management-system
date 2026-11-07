import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="allow")
    APP_NAME: str = "Student Fee Management System"
    VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database
    DATA_DIR: Path = BASE_DIR / "data"
    BACKUP_DIR: Path = BASE_DIR / "backups"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'fees.db'}"

    # Cash Counter Thresholds
    CASH_ALERT_THRESHOLD_LOW: float = 40000.0
    CASH_ALERT_THRESHOLD_HIGH: float = 50000.0

    # Default Academic Year
    DEFAULT_ACADEMIC_YEAR: str = "2026-2027"

    # SMTP Configuration (Stored locally, configurable in UI)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "accounts@college.edu"
    SMTP_FROM_NAME: str = "College Fee Administration"
    SMTP_USE_TLS: bool = True

settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
