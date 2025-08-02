"""
POS Session Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
import uuid
from datetime import datetime

from app.core.database import get_db, PosSession, User
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.tenant_security import TenantSecurity

router = APIRouter()

# Pydantic models for POS Session
class PosSessionCreate(BaseModel):
    config_id: int
    name: Optional[str] = None

class PosSessionResponse(BaseModel):
    id: str
    name: str
    state: str  # 'opening_control' | 'opened' | 'closing_control' | 'closed'
    start_at: str
    stop_at: Optional[str] = None
    config_id: int
    config_name: str
    user_id: str
    user_name: str

@router.get("/sessions/current")
async def get_current_session(
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current active POS session"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Find the active session for this user
    active_session = db.query(PosSession).filter(
        and_(
            PosSession.user_id == current_user.id,
            PosSession.restaurant_id == restaurant_id,
            PosSession.state.in_(["opening_control", "opened"]),
            PosSession.is_active == True
        )
    ).first()
    
    if not active_session:
        return APIResponseHelper.success(
            data=None,
            message="No active POS session found"
        )
    
    session_data = {
        "id": str(active_session.id),
        "name": active_session.name,
        "state": active_session.state,
        "start_at": active_session.start_at.isoformat(),
        "stop_at": active_session.stop_at.isoformat() if active_session.stop_at else None,
        "config_id": active_session.config_id,
        "config_name": active_session.config_name,
        "user_id": str(active_session.user_id),
        "user_name": f"{current_user.first_name} {current_user.last_name}"
    }
    
    return APIResponseHelper.success(
        data=session_data,
        message="Current POS session retrieved successfully"
    )

@router.post("/sessions")
async def create_session(
    session_data: PosSessionCreate,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new POS session"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Check if user already has an active session
    existing_session = db.query(PosSession).filter(
        and_(
            PosSession.user_id == current_user.id,
            PosSession.restaurant_id == restaurant_id,
            PosSession.state.in_(["opening_control", "opened"]),
            PosSession.is_active == True
        )
    ).first()
    
    if existing_session:
        raise FynloException(
            error_code=ErrorCodes.BUSINESS_LOGIC_ERROR,
            detail="User already has an active POS session"
        )
    
    # Create new session
    new_session = PosSession(
        restaurant_id=restaurant_id,
        user_id=current_user.id,
        name=session_data.name or f"POS Session {datetime.utcnow().strftime('%H:%M')}",
        state="opening_control",
        config_id=session_data.config_id,
        config_name=f"POS Config {session_data.config_id}",
        session_data={}
    )
    
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    
    response_data = {
        "id": str(new_session.id),
        "name": new_session.name,
        "state": new_session.state,
        "start_at": new_session.start_at.isoformat(),
        "stop_at": None,
        "config_id": new_session.config_id,
        "config_name": new_session.config_name,
        "user_id": str(new_session.user_id),
        "user_name": f"{current_user.first_name} {current_user.last_name}"
    }
    
    return APIResponseHelper.success(
        data=response_data,
        message="POS session created successfully"
    )

@router.put("/sessions/{session_id}/state")
async def update_session_state(
    session_id: str,
    state: str,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update POS session state"""
    
    session = db.query(PosSession).filter(PosSession.id == session_id).first()
    
    if not session:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="POS session not found"
        )
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        str(session.restaurant_id), 
        db=db
    )
    
    # Check if user owns this session
    if session.user_id != current_user.id:
        raise FynloException(
            error_code=ErrorCodes.FORBIDDEN,
            detail="Not authorized to modify this session"
        )
    
    # Validate state transition
    valid_states = ["opening_control", "opened", "closing_control", "closed"]
    if state not in valid_states:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"Invalid state. Must be one of: {valid_states}"
        )
    
    session.state = state
    session.updated_at = datetime.utcnow()
    
    if state == "closed":
        session.stop_at = datetime.utcnow()
        session.is_active = False
    
    db.commit()
    db.refresh(session)
    
    response_data = {
        "id": str(session.id),
        "name": session.name,
        "state": session.state,
        "start_at": session.start_at.isoformat(),
        "stop_at": session.stop_at.isoformat() if session.stop_at else None,
        "config_id": session.config_id,
        "config_name": session.config_name,
        "user_id": str(session.user_id),
        "user_name": f"{current_user.first_name} {current_user.last_name}"
    }
    
    return APIResponseHelper.success(
        data=response_data,
        message=f"POS session state updated to {state}"
    )

@router.get("/sessions")
async def get_sessions(
    limit: int = 10,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get POS sessions for the current user"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    sessions = db.query(PosSession).filter(
        and_(
            PosSession.user_id == current_user.id,
            PosSession.restaurant_id == restaurant_id
        )
    ).order_by(PosSession.start_at.desc()).limit(limit).all()
    
    sessions_data = []
    for session in sessions:
        sessions_data.append({
            "id": str(session.id),
            "name": session.name,
            "state": session.state,
            "start_at": session.start_at.isoformat(),
            "stop_at": session.stop_at.isoformat() if session.stop_at else None,
            "config_id": session.config_id,
            "config_name": session.config_name,
            "user_id": str(session.user_id),
            "user_name": f"{current_user.first_name} {current_user.last_name}"
        })
    
    return APIResponseHelper.success(
        data=sessions_data,
        message=f"Retrieved {len(sessions_data)} POS sessions",
        meta={
            "total": len(sessions_data),
            "limit": limit
        }
    )