import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from .config import settings
from .seed import seed_database
from .services.backup_service import perform_sqlite_backup
from .routers import (
    auth, students, fees, payments, fines, 
    scholarships, reports, reminders, settings as settings_router
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Offline-First Student Fee Management System for Single PC / Local Network"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_labels = {
        "student_code": "Student ID / Roll Code",
        "full_name": "Full Student Name",
        "dob": "Date of Birth",
        "gender": "Gender",
        "category": "Caste / Social Category",
        "concession_type_id": "Special Concession Quota",
        "physical_receipt_no": "Manual Receipt Book #",
        "payment_date": "Receipt Date",
        "payment_mode": "Payment Mode",
        "fine_date": "Date Levied",
        "credit_date": "Credit Date",
        "event_name": "Event / Reason",
        "amount": "Amount",
        "base_amount": "Fee Amount",
        "old_password": "Current Password",
        "new_password": "New Password",
    }
    messages = []
    for err in exc.errors():
        loc = err.get("loc", [])
        raw_field = str(loc[-1]) if loc else "field"
        label = field_labels.get(raw_field, raw_field.replace("_", " ").title())
        err_type = str(err.get("type", "")).lower()
        msg = str(err.get("msg", ""))

        if "missing" in err_type or "required" in msg.lower():
            messages.append(f"'{label}' is required. Please fill in all required fields.")
        elif "date" in err_type or "date" in msg.lower():
            messages.append(f"'{label}' must be a valid date (or leave empty if optional).")
        elif "greater_than" in err_type or "greater than 0" in msg.lower():
            messages.append(f"'{label}' must be greater than 0.")
        else:
            messages.append(f"'{label}': {msg}")

    clean_detail = " | ".join(messages) if messages else "Invalid input. Please fill all required fields properly."
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": clean_detail, "errors": exc.errors()})
    )

# CORS Middleware with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security Response Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


# Include Routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(fees.router)
app.include_router(payments.router)
app.include_router(fines.router)
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
            raise HTTPException(status_code=404, detail="API endpoint not found")
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

