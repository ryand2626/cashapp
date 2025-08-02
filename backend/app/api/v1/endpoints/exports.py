"""
Export API endpoints for Fynlo POS - Portal export functionality
TEMPORARILY DISABLED DUE TO MISSING DEPENDENCIES
"""

from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db, User
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.middleware.rate_limit_middleware import limiter, PORTAL_EXPORT_RATE

router = APIRouter()

@router.get("/menu/{restaurant_id}/export")
@limiter.limit(PORTAL_EXPORT_RATE)
async def export_menu_disabled(
    request: Request,
    restaurant_id: str,
    format: str = Query("json", regex="^(json|csv|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Temporarily disabled endpoint - maintains original signature"""
    return APIResponseHelper.error(
        message="Export functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )

@router.get("/reports/{restaurant_id}/export")
@limiter.limit(PORTAL_EXPORT_RATE)
async def export_report_disabled(
    request: Request,
    restaurant_id: str,
    report_type: str = Query(..., regex="^(sales|inventory|staff|customers|financial)$"),
    format: str = Query("json", regex="^(json|csv|pdf)$"),
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Temporarily disabled endpoint - maintains original signature"""
    return APIResponseHelper.error(
        message="Export functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )

@router.post("/menu/{restaurant_id}/import")
@limiter.limit(PORTAL_EXPORT_RATE)
async def import_menu_disabled(
    request: Request,
    restaurant_id: str,
    file_content: dict,  # JSON content from request body
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Temporarily disabled endpoint - maintains original signature"""
    return APIResponseHelper.error(
        message="Import functionality is temporarily unavailable. Please try again later.",
        status_code=503
    )