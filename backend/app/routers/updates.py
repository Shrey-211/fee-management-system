from typing import Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from ..auth import get_current_user, require_accountant_or_admin
from ..models.user import User
from ..services.update_service import (
    check_for_updates,
    get_download_progress,
    start_download_update,
    apply_update_and_restart
)

router = APIRouter(prefix="/api/system/update", tags=["System Updates"])


class DownloadRequest(BaseModel):
    download_url: str
    target_version: str


@router.get("/check")
def check_update_endpoint(
    force: bool = Query(False),
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Checks GitHub Releases for any new updates.
    Returns version diff, release notes, and download URL if available.
    """
    return check_for_updates(force=force)


@router.get("/progress")
def get_progress_endpoint(
    user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns current download and verification status.
    """
    return get_download_progress()


@router.post("/download")
def download_update_endpoint(
    req: DownloadRequest,
    user: User = Depends(require_accountant_or_admin)
) -> Dict[str, Any]:
    """
    Triggers streaming download of update archive in the background.
    """
    if not req.download_url:
        raise HTTPException(status_code=400, detail="Missing download_url in request")
    
    return start_download_update(req.download_url, req.target_version)


@router.post("/apply")
def apply_update_endpoint(
    user: User = Depends(require_accountant_or_admin)
) -> Dict[str, Any]:
    """
    Applies the downloaded update, creates database snapshot,
    launches the external updater script, and restarts the application.
    """
    try:
        return apply_update_and_restart()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Update failed to execute: {str(e)}")

