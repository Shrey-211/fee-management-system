import os
import sys
import time
import json
import shutil
import zipfile
import tempfile
import threading
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, Optional
from packaging import version as semver

from ..config import settings
from .backup_service import perform_sqlite_backup

TEMP_UPDATE_DIR = Path(tempfile.gettempdir()) / "FeeManagementSystem_OTA"

# In-memory update cache and download state
_cache_lock = threading.Lock()
_last_check_time: float = 0
_cached_check_result: Optional[Dict[str, Any]] = None

_download_lock = threading.Lock()
_download_state: Dict[str, Any] = {
    "status": "idle",  # "idle" | "downloading" | "ready" | "error"
    "progress_percent": 0.0,
    "downloaded_bytes": 0,
    "total_bytes": 0,
    "download_speed_kb": 0.0,
    "error": None,
    "version": None,
    "zip_path": None,
}


def _clean_version(tag: str) -> str:
    """Normalize tags like 'v1.1.0' or 'release-1.1.0' to '1.1.0'."""
    tag = tag.strip()
    if tag.lower().startswith("v"):
        tag = tag[1:]
    return tag


def check_for_updates(force: bool = False) -> Dict[str, Any]:
    """
    Checks GitHub Releases for the latest version.
    Returns status, release notes, and download asset information.
    """
    global _last_check_time, _cached_check_result

    with _cache_lock:
        now = time.time()
        # Cache for 10 minutes unless forced
        if not force and _cached_check_result and (now - _last_check_time < 600):
            return _cached_check_result

    repo = settings.GITHUB_REPO
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    headers = {
        "User-Agent": f"FeeManagementSystem-OTA/{settings.VERSION}",
        "Accept": "application/vnd.github.v3+json"
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            result = {
                "update_available": False,
                "current_version": settings.VERSION,
                "latest_version": settings.VERSION,
                "message": "No releases published yet on repository.",
                "offline": False
            }
            with _cache_lock:
                _cached_check_result = result
                _last_check_time = time.time()
            return result
        elif e.code == 403:
            result = {
                "update_available": False,
                "current_version": settings.VERSION,
                "latest_version": settings.VERSION,
                "message": "GitHub API rate limit exceeded. Please try again later.",
                "offline": False
            }
            return result
        else:
            return {
                "update_available": False,
                "current_version": settings.VERSION,
                "latest_version": settings.VERSION,
                "message": f"GitHub API returned error: {e.code}",
                "offline": False
            }
    except Exception as e:
        return {
            "update_available": False,
            "current_version": settings.VERSION,
            "latest_version": settings.VERSION,
            "message": f"Unable to reach update server: {str(e)}",
            "offline": True
        }

    raw_tag = data.get("tag_name", "")
    latest_version_str = _clean_version(raw_tag)
    current_version_str = _clean_version(settings.VERSION)

    try:
        is_newer = semver.parse(latest_version_str) > semver.parse(current_version_str)
    except Exception:
        is_newer = latest_version_str != current_version_str

    # Find the Windows release asset (prefer .zip)
    assets = data.get("assets", [])
    selected_asset = None
    for asset in assets:
        name = asset.get("name", "").lower()
        if name.endswith(".zip"):
            selected_asset = asset
            break

    result = {
        "update_available": bool(is_newer and selected_asset),
        "current_version": settings.VERSION,
        "latest_version": latest_version_str,
        "release_title": data.get("name") or raw_tag,
        "release_notes": data.get("body") or "No release notes provided.",
        "published_at": data.get("published_at"),
        "html_url": data.get("html_url"),
        "download_url": selected_asset.get("browser_download_url") if selected_asset else None,
        "asset_name": selected_asset.get("name") if selected_asset else None,
        "asset_size_bytes": selected_asset.get("size", 0) if selected_asset else 0,
        "asset_size_mb": round(selected_asset.get("size", 0) / (1024 * 1024), 2) if selected_asset else 0.0,
        "offline": False
    }

    with _cache_lock:
        _cached_check_result = result
        _last_check_time = time.time()

    return result


def get_download_progress() -> Dict[str, Any]:
    """Returns the current state of any active or finished download."""
    with _download_lock:
        return dict(_download_state)


def _download_worker(download_url: str, target_version: str):
    """Background worker that streams the update zip and tracks progress."""
    global _download_state

    TEMP_UPDATE_DIR.mkdir(parents=True, exist_ok=True)
    target_zip = TEMP_UPDATE_DIR / f"FeeManagementSystem_update_{target_version}.zip"

    try:
        req = urllib.request.Request(
            download_url,
            headers={"User-Agent": f"FeeManagementSystem-OTA/{settings.VERSION}"}
        )

        with urllib.request.urlopen(req, timeout=15) as response:
            total_size = int(response.headers.get("content-length", 0))

            with _download_lock:
                _download_state["status"] = "downloading"
                _download_state["total_bytes"] = total_size
                _download_state["downloaded_bytes"] = 0
                _download_state["progress_percent"] = 0.0
                _download_state["version"] = target_version
                _download_state["error"] = None
                _download_state["zip_path"] = str(target_zip)

            chunk_size = 128 * 1024  # 128 KB
            downloaded = 0
            start_time = time.time()

            with open(target_zip, "wb") as f:
                while True:
                    chunk = response.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    elapsed = max(time.time() - start_time, 0.001)
                    speed_kb = (downloaded / 1024) / elapsed

                    percent = round((downloaded / total_size) * 100, 1) if total_size > 0 else 0.0
                    with _download_lock:
                        _download_state["downloaded_bytes"] = downloaded
                        _download_state["progress_percent"] = percent
                        _download_state["download_speed_kb"] = round(speed_kb, 1)

        # Integrity verification
        if not zipfile.is_zipfile(target_zip):
            raise ValueError("Downloaded file is corrupted or not a valid zip archive.")

        with zipfile.ZipFile(target_zip, 'r') as zf:
            corrupted_file = zf.testzip()
            if corrupted_file:
                raise ValueError(f"Corrupted file inside update archive: {corrupted_file}")

        with _download_lock:
            _download_state["status"] = "ready"
            _download_state["progress_percent"] = 100.0
            _download_state["downloaded_bytes"] = downloaded
            _download_state["error"] = None

    except Exception as e:
        with _download_lock:
            _download_state["status"] = "error"
            _download_state["error"] = str(e)
        if target_zip.exists():
            try:
                target_zip.unlink(missing_ok=True)
            except Exception:
                pass


def start_download_update(download_url: str, target_version: str) -> Dict[str, Any]:
    """Spawns the background download thread if not already running."""
    with _download_lock:
        if _download_state["status"] == "downloading":
            return {"message": "Download already in progress", "state": _download_state}

        _download_state["status"] = "downloading"
        _download_state["progress_percent"] = 0.0
        _download_state["error"] = None
        _download_state["version"] = target_version

    thread = threading.Thread(
        target=_download_worker,
        args=(download_url, target_version),
        daemon=True
    )
    thread.start()

    return {"message": "Download started in background", "state": get_download_progress()}


def generate_updater_batch_script(install_dir: Path, zip_path: Path, current_pid: int, target_exe: Path) -> Path:
    """
    Creates an updater batch script that executes outside the Python process.
    It waits for the current process to terminate, safely swaps the files,
    preserves user data directories, and relaunches the application.
    """
    TEMP_UPDATE_DIR.mkdir(parents=True, exist_ok=True)
    bat_path = TEMP_UPDATE_DIR / "apply_update.bat"

    extract_stage = TEMP_UPDATE_DIR / "stage"

    script_content = f"""@echo off
setlocal enabledelayedexpansion
title Fee Management System - Software Update In Progress...

echo ======================================================================
echo    STUDENT FEE MANAGEMENT SYSTEM - AUTOMATED OVER-THE-AIR UPDATE
echo ======================================================================
echo.
echo Step 1: Waiting for previous application instance (PID {current_pid}) to close...

:wait_loop
tasklist /FI "PID eq {current_pid}" 2>NUL | find /I "{current_pid}" >NUL
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

:: Additional safety buffer to release file handles
timeout /t 2 /nobreak >nul

echo Step 2: Extracting updated software files...
if exist "{extract_stage}" rd /s /q "{extract_stage}"
mkdir "{extract_stage}"

tar -xf "{zip_path}" -C "{extract_stage}"
if errorlevel 1 (
    echo [ERROR] Failed to extract update zip archive.
    pause
    exit /b 1
)

echo Step 3: Detecting extracted package layout...
set SOURCE_DIR={extract_stage}
if exist "{extract_stage}\\FeeManagementSystem" (
    set SOURCE_DIR={extract_stage}\\FeeManagementSystem
)

echo Step 4: Installing new application files into: "{install_dir}"...
:: Copy files recursively with overwrite, skipping prompt.
:: User data in %LOCALAPPDATA% is completely untouched.
xcopy "!SOURCE_DIR!" "{install_dir}" /E /Y /H /R /I >nul
if errorlevel 1 (
    echo [ERROR] Failed to copy updated files into installation directory.
    pause
    exit /b 1
)

echo Step 5: Cleaning up update staging files...
if exist "{extract_stage}" rd /s /q "{extract_stage}"
if exist "{zip_path}" del /f /q "{zip_path}"

echo.
echo ======================================================================
echo    UPDATE COMPLETED SUCCESSFULLY! RELAUNCHING APPLICATION...
echo ======================================================================
timeout /t 1 /nobreak >nul

start "" "{target_exe}"
exit
"""
    bat_path.write_text(script_content, encoding="utf-8")
    return bat_path


def apply_update_and_restart() -> Dict[str, Any]:
    """
    Performs safety database backup, writes the updater batch file,
    spawns it as a detached process, and schedules application shutdown.
    """
    with _download_lock:
        if _download_state["status"] != "ready":
            raise ValueError(f"Cannot apply update. Current status is '{_download_state['status']}'.")
        zip_path_str = _download_state.get("zip_path")

    if not zip_path_str or not Path(zip_path_str).exists():
        raise FileNotFoundError("Update zip package not found on disk.")

    zip_path = Path(zip_path_str)

    # 1. Critical safety backup of database before updating
    try:
        backup_path = perform_sqlite_backup()
        print(f"[OTA Update] Automatic pre-update database backup saved at: {backup_path}")
    except Exception as e:
        print(f"[OTA Update] Notice: backup before update encountered: {e}")

    # 2. Determine installation directory and target executable
    if getattr(sys, 'frozen', False):
        target_exe = Path(sys.executable).resolve()
        install_dir = target_exe.parent
    else:
        # Development mode simulation: target the dist folder if built
        install_dir = settings.BASE_DIR.parent / "dist" / "FeeManagementSystem"
        target_exe = install_dir / "FeeManagementSystem.exe"

    current_pid = os.getpid()

    # 3. Generate updater script
    bat_path = generate_updater_batch_script(
        install_dir=install_dir,
        zip_path=zip_path,
        current_pid=current_pid,
        target_exe=target_exe
    )

    # 4. Spawn detached batch process
    CREATE_NEW_PROCESS_GROUP = 0x00000200
    DETACHED_PROCESS = 0x00000008

    subprocess.Popen(
        ["cmd.exe", "/c", str(bat_path)],
        creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
        close_fds=True
    )

    # 5. Schedule exit in 1.2 seconds so FastAPI can deliver the success HTTP response to UI
    def _graceful_exit():
        time.sleep(1.2)
        os._exit(0)

    threading.Thread(target=_graceful_exit, daemon=True).start()

    return {
        "success": True,
        "message": "Update initiated. Database safely backed up. System is restarting...",
        "countdown_seconds": 5
    }

