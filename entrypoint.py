import os
import sys
import time
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

def open_browser():
    """Wait for server to bind and open default web browser."""
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")

def main():
    print("=" * 65)
    print("      STUDENT FEE MANAGEMENT SYSTEM — OFFLINE EDITION")
    print("               Mr. Shrikant's Office Station")
    print("=" * 65)
    print("Status: Starting offline local server at http://127.0.0.1:8000...")
    print("Default Admin Login: admin / admin123")
    print("Press Ctrl+C in this console to safely shut down the application.")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    main()
