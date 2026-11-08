from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..auth import get_current_user
from ..services.report_service import (
    generate_daily_collection_report,
    export_daily_collection_excel,
    export_outstanding_dues_excel
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("/daily")
def get_daily_collection_data(
    report_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return generate_daily_collection_report(
        db, report_date=report_date, start_date=start_date, end_date=end_date
    )

@router.get("/daily/excel")
def download_daily_collection_excel(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    s_date = start_date or date.today()
    e_date = end_date or date.today()
    excel_stream = export_daily_collection_excel(db, s_date, e_date)
    filename = f"fee_collection_{s_date}_to_{e_date}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/outstanding/excel")
def download_outstanding_excel(
    academic_year: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    excel_stream = export_outstanding_dues_excel(db, academic_year=academic_year)
    filename = f"outstanding_fee_balances_{date.today()}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

