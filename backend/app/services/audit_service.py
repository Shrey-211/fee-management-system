import json
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy.orm import Session
from ..models.audit import AuditLog

def log_audit(
    db: Session,
    action: str,
    entity_name: str,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    details: Optional[dict[str, Any] | str] = None
) -> AuditLog:
    """
    Safely records an immutable audit log entry for significant system or financial actions.
    Does not call db.commit() directly, allowing it to commit atomically with the parent transaction.
    """
    if isinstance(details, dict):
        detail_str = json.dumps(details, default=str)
    elif details is not None:
        detail_str = str(details)
    else:
        detail_str = ""

    log_entry = AuditLog(
        user_id=user_id,
        action=action.upper().strip(),
        entity_name=entity_name,
        entity_id=entity_id,
        details=detail_str,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log_entry)
    return log_entry
