import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from ..config import settings

def perform_sqlite_backup() -> str:
    """
    Safely creates a consistent snapshot of the SQLite database using
    the native SQLite online backup API, even while transactions are occurring.
    """
    db_file = settings.DATA_DIR / "fees.db"
    if not db_file.exists():
        return ""

    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    backup_filename = f"fees_backup_{timestamp}.db"
    dest_path = settings.BACKUP_DIR / backup_filename

    # Perform online snapshot
    src_conn = sqlite3.connect(str(db_file), timeout=30)
    dest_conn = sqlite3.connect(str(dest_path), timeout=30)
    with dest_conn:
        src_conn.backup(dest_conn)
    dest_conn.close()
    src_conn.close()

    # Clean old backups older than 30 days
    cleanup_old_backups(days=30)
    return str(dest_path)


def cleanup_old_backups(days: int = 30):
    cutoff = datetime.now() - timedelta(days=days)
    for f in settings.BACKUP_DIR.glob("fees_backup_*.db"):
        try:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            if mtime < cutoff:
                f.unlink(missing_ok=True)
        except Exception:
            pass


def list_backups() -> List[Dict[str, Any]]:
    backups = []
    for f in sorted(settings.BACKUP_DIR.glob("fees_backup_*.db"), reverse=True):
        stat = f.stat()
        backups.append({
            "filename": f.name,
            "filepath": str(f),
            "size_kb": round(stat.st_size / 1024, 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        })
    return backups

