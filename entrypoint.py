import os
import sys
import time
import socket
import json
import urllib.request
import webbrowser
import threading
from pathlib import Path
import uvicorn

# Handle PyInstaller sys._MEIPASS path resolution
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent

# Ensure backend package can be imported
sys.path.insert(0, str(BASE_DIR))

from backend.app.main import app

def is_port_in_use(port: int = 8000) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def check_existing_instance(port: int = 8000) -> bool:
    try:
        req = urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1.5)
        if req.status == 200:
            data = json.loads(req.read().decode())
            return "Student Fee Management System" in data.get("app_name", "")
    except Exception:
        return False
    return False

def open_browser():
    """Wait for server to bind and open default web browser."""
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")

def main():
    print("=" * 65)
    print("      STUDENT FEE MANAGEMENT SYSTEM — OFFLINE EDITION")
    print("               Mr. Shrikant's Office Station")
    print("=" * 65)

    if is_port_in_use(8000):
        if check_existing_instance(8000):
            print("Notice: The Fee Management System is ALREADY running!")
            print("Opening your active session in the browser: http://127.0.0.1:8000")
            print("=" * 65)
            webbrowser.open("http://127.0.0.1:8000")
            input("Press Enter to close this launcher (the server will remain running)...")
            return
        else:
            print("ERROR: Port 8000 is occupied by another process on your computer.")
            print("Please close the process using port 8000 and try again.")
            print("=" * 65)
            input("Press Enter to exit...")
            return

    print("Status: Starting offline local server at http://127.0.0.1:8000...")
    print("Default Admin Login: admin / admin123")
    print("Press Ctrl+C in this console to safely shut down the application.")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()


