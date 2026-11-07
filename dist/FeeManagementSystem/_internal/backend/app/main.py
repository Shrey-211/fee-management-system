import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .config import settings
from .seed import seed_database
from .services.backup_service import perform_sqlite_backup
from .routers import (
    auth, students, fees, payments, fines, 
    batches, scholarships, reports, reminders, settings as settings_router
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Offline-First Student Fee Management System for Single PC / Local Network"
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(fees.router)
app.include_router(payments.router)
app.include_router(fines.router)
app.include_router(batches.router)
app.include_router(scholarships.router)
app.include_router(reports.router)
app.include_router(reminders.router)
app.include_router(settings_router.router)

@app.on_event("startup")
def on_startup():
    print(f"Starting {settings.APP_NAME} in offline mode...")
    seed_database()
    try:
        perform_sqlite_backup()
    except Exception as e:
        print(f"Startup backup notice: {e}")

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "mode": "offline-local",
        "version": settings.VERSION
    }

# Check for compiled React frontend static files
# When packaged as EXE or in production, frontend is built in ../frontend/dist or bundled sys._MEIPASS
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    frontend_dist = Path(sys._MEIPASS) / "frontend" / "dist"

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str, request: Request):
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return None
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def index():
        return {
            "message": "Student Fee Management System Backend API is active.",
            "docs": "/docs",
            "frontend_status": "Vite dev server running on port 5173 or not yet built."
        }
