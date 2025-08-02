"""
Employee Management API endpoints for Fynlo POS Backend
Handles employee CRUD operations, scheduling, time tracking, and performance metrics
"""

from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db, User
from app.core.responses import APIResponseHelper
from app.core.auth import get_current_user
from app.core.onboarding_helper import OnboardingHelper
from app.models.employee import EmployeeProfile, Schedule, Shift, TimeEntry, PerformanceMetric
from app.schemas.employee_schemas import (
    EmployeeCreateRequest, EmployeeUpdateRequest, EmployeeResponse,
    ScheduleCreateRequest, ScheduleUpdateRequest, ScheduleResponse,
    ShiftResponse, TimeEntryResponse, PerformanceMetricResponse
)
from app.services.employee_service import EmployeeService
from app.middleware.rate_limit_middleware import limiter

router = APIRouter()

# Initialize employee service
employee_service = EmployeeService()

@router.get("/", response_model=List[EmployeeResponse])
async def get_employees(
    restaurant_id: Optional[int] = Query(None, description="Filter by restaurant ID"),
    role: Optional[str] = Query(None, description="Filter by employee role"),
    active: Optional[bool] = Query(True, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all employees with optional filtering"""
    
    # Check if user needs onboarding (no restaurant)
    onboarding_response = OnboardingHelper.handle_onboarding_response(
        user=current_user,
        resource_type="employees",
        endpoint_requires_restaurant=True
    )
    if onboarding_response:
        return onboarding_response
    
    try:
        employees = await employee_service.get_employees(
            db=db,
            restaurant_id=restaurant_id,
            role=role,
            active=active,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=employees,
            message=f"Retrieved {len(employees)} employees"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve employees: {str(e)}",
            status_code=500
        )

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific employee by ID"""
    try:
        employee = await employee_service.get_employee_by_id(
            db=db,
            employee_id=employee_id,
            current_user=current_user
        )
        if not employee:
            return APIResponseHelper.error(
                message="Employee not found",
                status_code=404
            )
        return APIResponseHelper.success(
            data=employee,
            message="Employee retrieved successfully"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve employee: {str(e)}",
            status_code=500
        )

@router.post("/", response_model=EmployeeResponse)
async def create_employee(
    employee_data: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new employee"""
    try:
        employee = employee_service.create_employee(
            db=db,
            employee_data=employee_data,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=employee,
            message="Employee created successfully",
            status_code=201
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to create employee: {str(e)}",
            status_code=500
        )

@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update employee information"""
    try:
        employee = employee_service.update_employee(
            db=db,
            employee_id=employee_id,
            employee_data=employee_data,
            current_user=current_user
        )
        if not employee:
            return APIResponseHelper.error(
                message="Employee not found",
                status_code=404
            )
        return APIResponseHelper.success(
            data=employee,
            message="Employee updated successfully"
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to update employee: {str(e)}",
            status_code=500
        )

@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete employee (soft delete - marks as inactive)"""
    try:
        success = employee_service.delete_employee(
            db=db,
            employee_id=employee_id,
            current_user=current_user
        )
        if not success:
            return APIResponseHelper.error(
                message="Employee not found",
                status_code=404
            )
        return APIResponseHelper.success(
            message="Employee deactivated successfully"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to delete employee: {str(e)}",
            status_code=500
        )

# Schedule Management Endpoints

@router.get("/{employee_id}/schedules", response_model=List[ScheduleResponse])
async def get_employee_schedules(
    employee_id: int,
    start_date: Optional[date] = Query(None, description="Filter schedules from this date"),
    end_date: Optional[date] = Query(None, description="Filter schedules to this date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employee schedules with optional date filtering"""
    try:
        schedules = employee_service.get_employee_schedules(
            db=db,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=schedules,
            message=f"Retrieved {len(schedules)} schedules"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve schedules: {str(e)}",
            status_code=500
        )

@router.post("/{employee_id}/schedules", response_model=ScheduleResponse)
async def create_employee_schedule(
    employee_id: int,
    schedule_data: ScheduleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new schedule for employee"""
    try:
        schedule = employee_service.create_schedule(
            db=db,
            employee_id=employee_id,
            schedule_data=schedule_data,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=schedule,
            message="Schedule created successfully",
            status_code=201
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to create schedule: {str(e)}",
            status_code=500
        )

@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update existing schedule"""
    try:
        schedule = employee_service.update_schedule(
            db=db,
            schedule_id=schedule_id,
            schedule_data=schedule_data,
            current_user=current_user
        )
        if not schedule:
            return APIResponseHelper.error(
                message="Schedule not found",
                status_code=404
            )
        return APIResponseHelper.success(
            data=schedule,
            message="Schedule updated successfully"
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to update schedule: {str(e)}",
            status_code=500
        )

@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete schedule"""
    try:
        success = employee_service.delete_schedule(
            db=db,
            schedule_id=schedule_id,
            current_user=current_user
        )
        if not success:
            return APIResponseHelper.error(
                message="Schedule not found",
                status_code=404
            )
        return APIResponseHelper.success(
            message="Schedule deleted successfully"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to delete schedule: {str(e)}",
            status_code=500
        )

# Time Tracking Endpoints

@router.post("/{employee_id}/clock-in")
async def clock_in(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock in employee for their shift"""
    try:
        shift = employee_service.clock_in(
            db=db,
            employee_id=employee_id,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=shift,
            message="Clocked in successfully"
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to clock in: {str(e)}",
            status_code=500
        )

@router.post("/{employee_id}/clock-out")
async def clock_out(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock out employee from their shift"""
    try:
        shift = employee_service.clock_out(
            db=db,
            employee_id=employee_id,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=shift,
            message="Clocked out successfully"
        )
    except ValueError as e:
        return APIResponseHelper.error(
            message=str(e),
            status_code=400
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to clock out: {str(e)}",
            status_code=500
        )

@router.get("/{employee_id}/shifts", response_model=List[ShiftResponse])
async def get_employee_shifts(
    employee_id: int,
    start_date: Optional[date] = Query(None, description="Filter shifts from this date"),
    end_date: Optional[date] = Query(None, description="Filter shifts to this date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employee work shifts with optional date filtering"""
    try:
        shifts = employee_service.get_employee_shifts(
            db=db,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=shifts,
            message=f"Retrieved {len(shifts)} shifts"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve shifts: {str(e)}",
            status_code=500
        )

# Performance Metrics Endpoints

@router.get("/{employee_id}/performance", response_model=List[PerformanceMetricResponse])
async def get_employee_performance(
    employee_id: int,
    start_date: Optional[date] = Query(None, description="Filter metrics from this date"),
    end_date: Optional[date] = Query(None, description="Filter metrics to this date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employee performance metrics"""
    try:
        metrics = employee_service.get_performance_metrics(
            db=db,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=metrics,
            message=f"Retrieved {len(metrics)} performance metrics"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve performance metrics: {str(e)}",
            status_code=500
        )

# Bulk Operations for Restaurant Dashboard

@router.get("/restaurant/{restaurant_id}/summary")
async def get_restaurant_employee_summary(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employee summary for restaurant dashboard"""
    try:
        summary = employee_service.get_restaurant_employee_summary(
            db=db,
            restaurant_id=restaurant_id,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=summary,
            message="Employee summary retrieved successfully"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve employee summary: {str(e)}",
            status_code=500
        )

@router.get("/restaurant/{restaurant_id}/schedules/week")
async def get_weekly_schedule(
    restaurant_id: int,
    week_start: Optional[date] = Query(None, description="Start date of the week"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get weekly schedule for all restaurant employees"""
    try:
        schedule = employee_service.get_weekly_schedule(
            db=db,
            restaurant_id=restaurant_id,
            week_start=week_start,
            current_user=current_user
        )
        return APIResponseHelper.success(
            data=schedule,
            message="Weekly schedule retrieved successfully"
        )
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve weekly schedule: {str(e)}",
            status_code=500
        )