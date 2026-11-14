import os
import re
import sys
import json
import shutil
import zipfile
import hashlib
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "backend" / "app" / "config.py"
PACKAGE_JSON_PATH = ROOT / "frontend" / "package.json"
RELEASES_DIR = ROOT / "releases"


def get_current_version() -> str:
    content = CONFIG_PATH.read_text(encoding="utf-8")
    m = re.search(r'VERSION:\s*str\s*=\s*"([^"]+)"', content)
    if m:
        return m.group(1)
    return "1.0.0"


def update_version(new_version: str):
    # 1. Update backend config.py
    cfg_text = CONFIG_PATH.read_text(encoding="utf-8")
    updated_cfg = re.sub(
        r'VERSION:\s*str\s*=\s*"[^"]+"',
        f'VERSION: str = "{new_version}"',
        cfg_text
    )
    CONFIG_PATH.write_text(updated_cfg, encoding="utf-8")

    # 2. Update frontend package.json
    if PACKAGE_JSON_PATH.exists():
        pkg = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
        pkg["version"] = new_version
        PACKAGE_JSON_PATH.write_text(json.dumps(pkg, indent=2), encoding="utf-8")

    print(f"[*] Updated system version to: v{new_version}")


def build_frontend():
    print("\n" + "=" * 60)
    print(" 1. Building React Frontend...")
    print("=" * 60)
    frontend_dir = ROOT / "frontend"
    cmd = "npm run build"
    subprocess.run(cmd, cwd=frontend_dir, check=True, shell=True)


def build_executable():
    print("\n" + "=" * 60)
    print(" 2. Compiling PyInstaller Windows Executable...")
    print("=" * 60)
    build_script = ROOT / "build_exe.py"
    subprocess.run([sys.executable, str(build_script)], cwd=ROOT, check=True)


def calculate_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def package_release_zip(version: str) -> Path:
    print("\n" + "=" * 60)
    print(" 3. Packaging Release Archive (Excluding Local User Data)...")
    print("=" * 60)

    dist_app_dir = ROOT / "dist" / "FeeManagementSystem"
    if not dist_app_dir.exists():
        raise FileNotFoundError(f"Directory {dist_app_dir} not found. Run build first.")

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)
    zip_filename = f"FeeManagementSystem-v{version}-windows.zip"
    zip_path = RELEASES_DIR / zip_filename

    if zip_path.exists():
        zip_path.unlink()

    # Excluded files to protect client privacy & avoid shipping blank databases
    EXCLUDED_EXTENSIONS = {".db", ".db-wal", ".db-shm", ".sqlite", ".log"}
    EXCLUDED_NAMES = {".env", "fees.db", "__pycache__"}

    total_files = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file in dist_app_dir.rglob("*"):
            if file.is_file():
                if file.suffix.lower() in EXCLUDED_EXTENSIONS or file.name in EXCLUDED_NAMES:
                    print(f"    [Skipped user file] {file.name}")
                    continue
                # Relative path inside zip
                rel_path = file.relative_to(dist_app_dir)
                zf.write(file, arcname=str(rel_path))
                total_files += 1

    size_mb = round(zip_path.stat().st_size / (1024 * 1024), 2)
    sha256 = calculate_sha256(zip_path)

    print(f"\n[+] Created Release Archive:")
    print(f"    Path:    {zip_path}")
    print(f"    Size:    {size_mb} MB ({total_files} files bundled)")
    print(f"    SHA-256: {sha256}")

    return zip_path


def main():
    print("=" * 65)
    print("  STUDENT FEE MANAGEMENT SYSTEM — OTA RELEASE AUTOMATION TOOL")
    print("=" * 65)

    current_ver = get_current_version()
    print(f"Current Version in codebase: v{current_ver}")

    if len(sys.argv) > 1:
        target_ver = sys.argv[1].lstrip("vV")
    else:
        try:
            choice = input(f"Enter new release version (Press Enter to keep v{current_ver}): ").strip()
            target_ver = choice.lstrip("vV") if choice else current_ver
        except (KeyboardInterrupt, EOFError):
            print("\nAborted.")
            return

    # 1. Update codebase version
    update_version(target_ver)

    # 2. Build Frontend
    build_frontend()

    # 3. Build Executable
    build_executable()

    # 4. Package Release Zip
    zip_path = package_release_zip(target_ver)

    # 5. Instructions / GitHub CLI publishing
    print("\n" + "=" * 65)
    print(f" SUCCESS: Release v{target_ver} is ready for publishing!")
    print("=" * 65)
    print("\nTo publish this release to GitHub:")
    print(f"Option A (Automatic via GitHub CLI):")
    print(f'  gh release create v{target_ver} "{zip_path}" --title "Fee Management System v{target_ver}" --notes "Release notes for v{target_ver}"')
    print("\nOption B (Manual via Browser):")
    print(f"  1. Go to: https://github.com/Shrey-211/fee-management-system/releases/new")
    print(f"  2. Tag: v{target_ver}")
    print(f"  3. Title: Release v{target_ver}")
    print(f"  4. Attach binary: {zip_path}")
    print(f"  5. Click 'Publish release'")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()

