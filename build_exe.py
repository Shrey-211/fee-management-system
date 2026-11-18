import subprocess
import sys
import shutil
import zipfile
import time
from pathlib import Path
from clean_db import clean_database

def kill_running_app():
    try:
        subprocess.run(["taskkill", "/F", "/IM", "FeeManagementSystem.exe"], 
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)
    except Exception:
        pass

def build():
    root = Path(__file__).resolve().parent
    print(f"Building FeeManagementSystem executable from {root}...")

    # Terminate any running instances so files are not locked
    kill_running_app()

    # 1. Ensure frontend is built
    dist_dir = root / "frontend" / "dist"
    print("Building latest frontend production bundle...")
    subprocess.run(["npm", "run", "build"], cwd=root / "frontend", check=True, shell=True)

    # 2. PyInstaller build command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name=FeeManagementSystem",
        "--onedir",
        "--console",
        "--noconfirm",
        "--clean",
        f"--icon={root / 'assets' / 'app_icon.ico'}",
        f"--add-data={root / 'frontend' / 'dist'};frontend/dist",
        f"--add-data={root / 'backend' / 'app'};backend/app",
        f"--add-data={root / 'backend' / 'data'};backend/data",
        f"--add-data={root / 'assets'};assets",
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
    res = subprocess.run(cmd, cwd=root)
    if res.returncode != 0:
        print("\nPyInstaller build failed with code:", res.returncode)
        return False

    dist_app = root / "dist" / "FeeManagementSystem"
    print("\nExecutable built successfully at:", dist_app / "FeeManagementSystem.exe")

    # 3. Ensure data directory with clean production database exists next to the exe
    target_data = dist_app / "data"
    target_data.mkdir(parents=True, exist_ok=True)
    target_backups = dist_app / "backups"
    target_backups.mkdir(parents=True, exist_ok=True)

    # Clean old runtime WAL/SHM and old backups
    for f in target_data.glob("fees.db-*"):
        f.unlink(missing_ok=True)
    for f in target_backups.glob("*.db"):
        f.unlink(missing_ok=True)

    src_db = root / "backend" / "data" / "fees.db"
    dest_db = target_data / "fees.db"
    if src_db.exists():
        backup_src = root / "backend" / "data" / "fees.db.dev_backup"
        try:
            shutil.copy2(src_db, backup_src)
            clean_database(src_db)
            print(f"Copying clean production database ({src_db.stat().st_size} bytes) to {dest_db}...")
            shutil.copy2(src_db, dest_db)
        finally:
            if backup_src.exists():
                shutil.copy2(backup_src, src_db)
                backup_src.unlink(missing_ok=True)
                print("Restored active development database.")

    # 4. Remove intermediate build/ artifacts so users don't mistake them for the executable
    intermediate_exe = root / "build" / "FeeManagementSystem" / "FeeManagementSystem.exe"
    if intermediate_exe.exists():
        try:
            intermediate_exe.unlink()
            print("Cleaned up misleading intermediate file: build/FeeManagementSystem/FeeManagementSystem.exe")
        except Exception:
            pass

    # 5. Create a convenient root-level launcher
    launcher_bat = root / "Launch_FeeManagementSystem.bat"
    launcher_content = (
        "@echo off\r\n"
        "title Fee Management System Launcher\r\n"
        "cd /d \"%~dp0\"\r\n"
        "if exist \"dist\\FeeManagementSystem\\FeeManagementSystem.exe\" (\r\n"
        "    start \"\" \"dist\\FeeManagementSystem\\FeeManagementSystem.exe\"\r\n"
        ") else (\r\n"
        "    python entrypoint.py\r\n"
        ")\r\n"
    )
    launcher_bat.write_text(launcher_content, encoding="utf-8")
    print(f"Created root launcher shortcut: {launcher_bat.name}")

    # 6. Package a clean release zip
    releases_dir = root / "releases"
    releases_dir.mkdir(parents=True, exist_ok=True)
    zip_path = releases_dir / "FeeManagementSystem-v1.1.0-windows.zip"
    print(f"Creating release package: {zip_path.name}...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in dist_app.rglob('*'):
            arcname = file.relative_to(root / "dist")
            zipf.write(file, arcname)
    print(f"Release package ready: {zip_path} ({round(zip_path.stat().st_size / (1024*1024), 2)} MB)")

    # 7. Compile Windows Setup Installer (.exe) with Inno Setup
    iscc_candidates = [
        Path(r"C:\Users\jadha\AppData\Local\Programs\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe"),
        Path(r"C:\Program Files\Inno Setup 6\ISCC.exe"),
    ]
    iscc = next((p for p in iscc_candidates if p.exists()), None)
    if iscc and (root / "installer.iss").exists():
        print(f"Compiling Windows Installer using Inno Setup ({iscc})...")
        res_iss = subprocess.run([str(iscc), "/Q", str(root / "installer.iss")], cwd=root)
        if res_iss.returncode == 0:
            setup_exe = releases_dir / "FeeManagementSystem_1.1.0.exe"
            root_setup = root / "FeeManagementSystem_1.1.0.exe"

            # Remove any previous or other build exe files
            for old_exe in list(root.glob("*.exe")) + list(releases_dir.glob("*.exe")):
                if old_exe.resolve() not in [setup_exe.resolve(), root_setup.resolve()]:
                    try:
                        old_exe.unlink()
                        print(f"Removed previous installer: {old_exe.name}")
                    except Exception as e:
                        print(f"Could not remove {old_exe.name}: {e}")

            try:
                shutil.copy2(setup_exe, root_setup)
            except Exception as e:
                print(f"Could not copy to root: {e}")

            print(f"Windows Setup Installer ready: {setup_exe} ({round(setup_exe.stat().st_size / (1024*1024), 2)} MB)")
            print(f"Root installer ready: {root_setup}")

    print("\n=======================================================")
    print(" BUILD & PACKAGING COMPLETE!")
    print(f" Setup Installer (.exe): FeeManagementSystem_1.1.0.exe")
    print(f" Standalone App Folder:  dist/FeeManagementSystem/FeeManagementSystem.exe")
    print(f" Release Zip:            releases/FeeManagementSystem-v1.1.0-windows.zip")
    print("=======================================================")
    return True

if __name__ == "__main__":
    build()
