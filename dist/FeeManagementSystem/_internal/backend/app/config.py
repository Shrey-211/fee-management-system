import os
import secrets
from pathlib import Path
from dotenv import load_dotenv, set_key
from pydantic_settings import BaseSettings, SettingsConfigDict

import os
import sys
import shutil
import secrets
from pathlib import Path
from dotenv import load_dotenv, set_key
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

# Determine application roots:
# When packaged as a frozen PyInstaller executable, store user database and backups
# in a 'data' and 'backups' directory next to the executable, so user data persists cleanly.
if getattr(sys, 'frozen', False):
    APP_DIR = Path(sys.executable).resolve().parent
    DATA_DIR = APP_DIR / "data"
    BACKUP_DIR = APP_DIR / "backups"
    ENV_PATH = APP_DIR / ".env"
else:
    APP_DIR = BASE_DIR
    DATA_DIR = BASE_DIR / "data"
    BACKUP_DIR = BASE_DIR / "backups"
    ENV_PATH = BASE_DIR / ".env"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# If frozen executable and active database doesn't exist yet, copy initial database if bundled
db_file = DATA_DIR / "fees.db"
if not db_file.exists():
    # Check if bundled in PyInstaller _MEIPASS
    bundled_db = getattr(sys, '_MEIPASS', None)
    if bundled_db:
        candidate = Path(bundled_db) / "backend" / "data" / "fees.db"
        if candidate.exists():
            try:
                shutil.copy2(candidate, db_file)
            except Exception:
                pass
    # Or check if source database exists in project tree
    if not db_file.exists():
        src_candidate = BASE_DIR / "data" / "fees.db"
        if src_candidate.exists():
            try:
                shutil.copy2(src_candidate, db_file)
            except Exception:
                pass

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
    COLLEGE_NAME: str = "Krishna Foundation's Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan"
    COLLEGE_SHORT_NAME: str = "KF's SJNNIMS, Phaltan"
    COLLEGE_ADDRESS: str = "Phaltan, Dist. Satara, Maharashtra"
    COLLEGE_TAGLINE: str = "Approved by AICTE New Delhi & Affiliated to Shivaji University, Kolhapur"
    VERSION: str = "1.1.0"
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
    DATA_DIR: Path = DATA_DIR
    BACKUP_DIR: Path = BACKUP_DIR
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'fees.db'}"

    # Default Academic Year
    DEFAULT_ACADEMIC_YEAR: str = "2026-2027"

    # SMTP Configuration (Stored locally, configurable in UI)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "accounts@college.edu"
    SMTP_FROM_NAME: str = "KF's SJNNIMS Accounts Office"
    SMTP_USE_TLS: bool = True

settings = Settings()

