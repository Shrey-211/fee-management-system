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

# Determine persistent user data directory vs application installation directory
if getattr(sys, 'frozen', False):
    # Running as compiled PyInstaller executable on Windows
    APP_INSTALL_DIR = Path(sys.executable).resolve().parent
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        USER_DATA_DIR = Path(local_app_data) / "FeeManagementSystem"
    else:
        USER_DATA_DIR = Path.home() / ".FeeManagementSystem"
else:
    # Development mode - project root directory
    APP_INSTALL_DIR = BASE_DIR.parent
    USER_DATA_DIR = BASE_DIR

# Ensure persistent directories exist
DATA_DIR = USER_DATA_DIR / "data"
BACKUP_DIR = USER_DATA_DIR / "backups"
DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

# Seamless migration: if migrating from older app bundle where DB was in BASE_DIR / data
if USER_DATA_DIR != BASE_DIR:
    old_db = BASE_DIR / "data" / "fees.db"
    new_db = DATA_DIR / "fees.db"
    if old_db.exists() and not new_db.exists():
        try:
            shutil.copy2(old_db, new_db)
            print(f"[Migration] Copied existing database from {old_db} to {new_db}")
        except Exception as e:
            print(f"[Migration] Warning copying old database: {e}")

    old_env = BASE_DIR / ".env"
    new_env = USER_DATA_DIR / ".env"
    if old_env.exists() and not new_env.exists():
        try:
            shutil.copy2(old_env, new_env)
        except Exception:
            pass

ENV_PATH = USER_DATA_DIR / ".env"

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
    GITHUB_REPO: str = "Shrey-211/fee-management-system"

    # Application Paths
    BASE_DIR: Path = BASE_DIR
    APP_INSTALL_DIR: Path = APP_INSTALL_DIR
    USER_DATA_DIR: Path = USER_DATA_DIR
    DATA_DIR: Path = DATA_DIR
    BACKUP_DIR: Path = BACKUP_DIR
    ENV_PATH: Path = ENV_PATH

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
    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'fees.db'}"

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

