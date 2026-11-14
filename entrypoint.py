import os
import sys
import time
import socket
import json
import urllib.request
import webbrowser
import threading
import subprocess
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
        s.settimeout(0.5)
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

def find_pid_on_port(port: int = 8000):
    try:
        output = subprocess.check_output(f"netstat -ano -p tcp | findstr :{port}", shell=True, text=True)
        for line in output.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in parts[3].upper():
                return int(parts[-1])
    except Exception:
        pass
    return None

def kill_process_by_pid(pid: int):
    try:
        subprocess.run(f"taskkill /PID {pid} /F", shell=True, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
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
            print("Notice: Fee Management System is ALREADY running at http://127.0.0.1:8000")
            print("Opening active session in your browser...")
            print("=" * 65)
            webbrowser.open("http://127.0.0.1:8000")
            print("To stop the running instance and start fresh, type 'restart'.")
            try:
                choice = input("Press [Enter] to exit this launcher, or type 'restart': ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                choice = ""
            if choice == "restart":
                pid = find_pid_on_port(8000)
                if pid and pid != os.getpid():
                    print(f"Terminating existing process (PID {pid})...")
                    kill_process_by_pid(pid)
                    time.sleep(1)
                else:
                    return
            else:
                return
        else:
            # Port is occupied by a stale/unresponsive process
            pid = find_pid_on_port(8000)
            if pid and pid != os.getpid():
                print(f"Notice: Port 8000 is occupied by an orphaned process (PID {pid}).")
                print("Automatically clearing port 8000 to start cleanly...")
                kill_process_by_pid(pid)
                time.sleep(1)
            else:
                print("ERROR: Port 8000 is occupied by another process on your computer.")
                print("Please close the conflicting application and try again.")
                print("=" * 65)
                input("Press Enter to exit...")
                return

    print("Status: Starting offline local server at http://127.0.0.1:8000...")
    print("Press Ctrl+C in this console to safely shut down the application.")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    try:
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
    except OSError as e:
        if "10048" in str(e):
            print("\nNotice: Port 8000 was already acquired. Opening browser...")
            webbrowser.open("http://127.0.0.1:8000")
            try:
                input("Press Enter to exit...")
            except (EOFError, KeyboardInterrupt):
                pass
        else:
            raise

if __name__ == "__main__":
    main()
