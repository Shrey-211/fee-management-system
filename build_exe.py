import subprocess
import sys
import shutil
from pathlib import Path

def build():
    root = Path(__file__).resolve().parent
    print(f"Building FeeManagementSystem executable from {root}...")

    # Ensure frontend is built
    dist_dir = root / "frontend" / "dist"
    if not dist_dir.exists():
        print("Frontend dist not found. Building frontend first...")
        subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True, shell=True)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=FeeManagementSystem",
        "--onedir",
        "--console",
        "--noconfirm",
        "--clean",
        f"--add-data={root / 'frontend' / 'dist'};frontend/dist",
        f"--add-data={root / 'backend' / 'app'};backend/app",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.websockets",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespans",
        "--hidden-import=uvicorn.lifespans.on",
        "--hidden-import=bcrypt",
        "--hidden-import=openpyxl",
        "--hidden-import=jwt",
        "--hidden-import=dotenv",
        "--hidden-import=sqlalchemy.dialects.sqlite",
        str(root / "entrypoint.py")
    ]

    print("Running PyInstaller command...")
    print(" ".join(cmd))
    res = subprocess.run(cmd, cwd=root)
    if res.returncode == 0:
        print("\nSUCCESS! Executable built at: dist/FeeManagementSystem/FeeManagementSystem.exe")
    else:
        print("\nPyInstaller build failed with code:", res.returncode)

if __name__ == "__main__":
    build()
