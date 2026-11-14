import os
import secrets
from pathlib import Path
from dotenv import load_dotenv, set_key
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Ensure .env exists with a secure cryptographic SECRET_KEY
if not ENV_PATH.exists():
    ENV_PATH.touch(mode=0o600, exist_ok=True)

load_dotenv(ENV_PATH)

def get_or_create_secret_key() -> str:
    key = os.getenv("SECRET_KEY")
    if not key:
        key = secrets.token_urlsafe(32)
        try:
            set_key(str(ENV_PATH), "SECRET_KEY", key)
        except Exception:
            pass
    return key

_secret_key = get_or_create_secret_key()

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="allow")
    APP_NAME: str = "Student Fee Management System"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Cryptographic Secret
    SECRET_KEY: str = _secret_key

    # CORS Allowed Origins
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    # Database
    DATA_DIR: Path = BASE_DIR / "data"
    BACKUP_DIR: Path = BASE_DIR / "backups"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'data' / 'fees.db'}"

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

