"""
Platform Settings API Endpoints
Admin-only endpoints for managing platform-wide configurations
"""
from datetime import datetime # Added missing import
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
import logging # Added for logging in new endpoints
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db, User
from app.core.exceptions import (
    FynloException,
    PaymentException,
    ResourceNotFoundException,
    ValidationException
)
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.services.platform_service import PlatformSettingsService
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

router = APIRouter()

# Pydantic models for requests/responses
class PlatformSettingRequest(BaseModel):
    config_value: Any
    change_reason: Optional[str] = None

class RestaurantOverrideRequest(BaseModel):
    override_value: Any
    requires_approval: bool = False

class FeatureFlagRequest(BaseModel):
    is_enabled: bool
    rollout_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    target_restaurants: Optional[List[str]] = None

class BulkUpdateRequest(BaseModel):
    updates: Dict[str, Any]
    change_reason: Optional[str] = None

class ServiceChargeConfigRequest(BaseModel):
    enabled: bool
    rate: float = Field(..., ge=0, le=100)
    description: str = Field(..., max_length=255)
    currency: str # Should ideally be an Enum, e.g., Literal['GBP', 'USD', 'EUR']

class ServiceChargeConfigResponse(BaseModel):
    service_charge: ServiceChargeConfigRequest

def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensure user has admin privileges for platform settings"""
    # TODO: Implement proper role-based access control
    # For now, check if user has admin role or specific permissions
    if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for platform settings"
        )
    return current_user

@router.get("/settings")
async def get_platform_settings(
    category: Optional[str] = Query(None, description="Filter by category"),
    include_sensitive: bool = Query(False, description="Include sensitive settings"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get all platform settings (admin only)"""
    try:
        service = PlatformSettingsService(db)
        settings = await service.get_platform_settings(
            category=category,
            include_sensitive=include_sensitive
        )
        
        return APIResponseHelper.success(
            data=settings,
            message=f"Retrieved {len(settings)} platform settings"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
# Service Charge Specific Endpoints
@router.get(
    "/service-charge",
    response_model=ServiceChargeConfigResponse,
    summary="Get service charge configuration",
    tags=["Platform Settings", "Service Charge"]
)
async def get_service_charge_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Retrieve the current platform service charge configuration."""
    try:
        service = PlatformSettingsService(db)
        config = await service.get_service_charge_config()
        return config # FastAPI will wrap this in the response_model
    except Exception as e:
        logging.error(f"Error retrieving service charge configuration: {e}", exc_info=True)
        raise FynloException(message="Failed to retrieve service charge configuration")
@router.put(
    "/service-charge",
    response_model=ServiceChargeConfigResponse,
    summary="Update service charge configuration",
    tags=["Platform Settings", "Service Charge"]
)
async def update_service_charge_configuration(
    request: ServiceChargeConfigRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Update the platform service charge configuration."""
    try:
        service = PlatformSettingsService(db)
        # The service method expects a dictionary, so we convert the Pydantic model
        success = await service.update_service_charge_config(
            config_data=request.dict(),
            updated_by=str(current_user.id) # Assuming user ID is a UUID or string
        )
        if not success:
            # This case might be tricky if partial updates occurred.
            # The service method tries to update all and returns True if all succeed.
            # If it returns False, it implies one or more updates failed but didn't raise an exception (e.g. key not found).
            raise FynloException(message="Failed to update some service charge settings")
        # Fetch the updated configuration to return
        updated_config = await service.get_service_charge_config()
        return updated_config
    except ValueError as e: # Catch validation errors from the service layer
        raise ValidationException(message=str(e))
    except Exception as e:
        logging.error(f"Error updating service charge configuration: {e}", exc_info=True)
        raise FynloException(message="Failed to update service charge configuration")
@router.get("/settings/{config_key}")
async def get_platform_setting(
    config_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get a specific platform setting by key"""
    try:
        service = PlatformSettingsService(db)
        setting = await service.get_platform_setting(config_key)
        
        if not setting:
            raise ResourceNotFoundException(
                resource="Platform setting",
                message=f"Platform setting '{config_key}' not found"
            )
        
        return APIResponseHelper.success(
            data=setting,
            message=f"Retrieved platform setting '{config_key}'"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/settings/{config_key}")
async def update_platform_setting(
    config_key: str,
    request: PlatformSettingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user),
    http_request: Request = None
):
    """Update a platform setting (admin only)"""
    try:
        service = PlatformSettingsService(db)
        
        success = await service.update_platform_setting(
            config_key=config_key,
            config_value=request.config_value,
            updated_by=str(current_user.id),
            change_reason=request.change_reason,
            change_source="admin_api"
        )
        
        if not success:
            raise ResourceNotFoundException(
                resource="Platform setting",
                message=f"Platform setting '{config_key}' not found"
            )
        
        # Log the change for audit
        if http_request:
            # Create audit record with IP and user agent
            pass  # Already handled in service
        
        return APIResponseHelper.success(
            data={'config_key': config_key, 'updated': True},
            message=f"Platform setting '{config_key}' updated successfully"
        )
        
    except ValueError as e:
        raise ValidationException(message=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/settings/bulk-update")
async def bulk_update_platform_settings(
    request: BulkUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Bulk update multiple platform settings"""
    try:
        service = PlatformSettingsService(db)
        
        results = {}
        errors = {}
        
        for config_key, config_value in request.updates.items():
            try:
                success = await service.update_platform_setting(
                    config_key=config_key,
                    config_value=config_value,
                    updated_by=str(current_user.id),
                    change_reason=request.change_reason,
                    change_source="admin_bulk_api"
                )
                results[config_key] = success
            except Exception as e:
                errors[config_key] = str(e)
        
        response_data = {
            'successful_updates': len([k for k, v in results.items() if v]),
            'failed_updates': len(errors),
            'results': results,
            'errors': errors
        }
        
        if errors:
            return APIResponseHelper.success(
                data=response_data,
                message=f"Bulk update completed with {len(errors)} errors"
            )
        else:
            return APIResponseHelper.success(
                data=response_data,
                message=f"Successfully updated {len(results)} platform settings"
            )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/payment-fees")
async def get_payment_fees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get all payment processing fees"""
    try:
        service = PlatformSettingsService(db)
        fees = await service.get_payment_fees()
        
        return APIResponseHelper.success(
            data=fees,
            message="Retrieved payment processing fees"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/payment-fees/calculate")
async def calculate_payment_fee(
    payment_method: str,
    amount: float = Query(..., description="Transaction amount"),
    restaurant_id: Optional[str] = Query(None, description="Restaurant ID for overrides"),
    monthly_volume: Optional[float] = Query(None, description="Monthly volume for volume-based pricing"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Calculate effective payment fee for given parameters"""
    try:
        if amount <= 0:
            raise ValidationException(message="Amount must be positive")        
        service = PlatformSettingsService(db)
        fee_calculation = await service.calculate_effective_fee(
            payment_method=payment_method,
            amount=amount,
            restaurant_id=restaurant_id,
            monthly_volume=monthly_volume
        )
        
        return APIResponseHelper.success(
            data=fee_calculation,
            message=f"Calculated fee for {payment_method} payment"
        )
        
    except ValueError as e:
        raise ValidationException(message=str(e))
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/feature-flags")
async def get_feature_flags(
    restaurant_id: Optional[str] = Query(None, description="Filter for specific restaurant"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get all feature flags"""
    try:
        service = PlatformSettingsService(db)
        flags = await service.get_feature_flags(restaurant_id=restaurant_id)
        
        return APIResponseHelper.success(
            data=flags,
            message="Retrieved feature flags"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/feature-flags/{feature_key}")
async def update_feature_flag(
    feature_key: str,
    request: FeatureFlagRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Update a feature flag"""
    try:
        service = PlatformSettingsService(db)
        
        success = await service.update_feature_flag(
            feature_key=feature_key,
            is_enabled=request.is_enabled,
            rollout_percentage=request.rollout_percentage,
            target_restaurants=request.target_restaurants,
            updated_by=str(current_user.id)
        )
        
        if not success:
            raise ResourceNotFoundException(
                resource="Feature flag",
                message=f"Feature flag '{feature_key}' not found"
            )
        
        return APIResponseHelper.success(
            data={'feature_key': feature_key, 'is_enabled': request.is_enabled},
            message=f"Feature flag '{feature_key}' updated successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/audit-trail")
async def get_configuration_audit_trail(
    config_key: Optional[str] = Query(None, description="Filter by configuration key"),
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    limit: int = Query(100, description="Maximum number of records", le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get configuration change audit trail"""
    try:
        service = PlatformSettingsService(db)
        audit_trail = await service.get_audit_trail(
            config_key=config_key,
            entity_id=entity_id,
            limit=limit
        )
        
        return APIResponseHelper.success(
            data={
                'audit_records': audit_trail,
                'total_records': len(audit_trail)
            },
            message=f"Retrieved {len(audit_trail)} audit records"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/initialize-defaults")
async def initialize_default_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Initialize platform with default configurations"""
    try:
        service = PlatformSettingsService(db)
        success = await service.initialize_default_settings()
        
        if success:
            return APIResponseHelper.success(
                data={'initialized': True},
                message="Default platform settings initialized successfully"
            )
        else:
            raise FynloException(message="Failed to initialize default settings"
            )
        
    except Exception as e:
        raise FynloException(message=str(e))
# Restaurant override endpoints (for restaurant users)
@router.get("/restaurants/{restaurant_id}/effective-settings")
async def get_restaurant_effective_settings(
    restaurant_id: str,
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get effective settings for a restaurant (platform + overrides)"""
    try:
        # TODO: Verify user has access to this restaurant
        
        service = PlatformSettingsService(db)
        settings = await service.get_restaurant_effective_settings(
            restaurant_id=restaurant_id,
            category=category
        )
        
        return APIResponseHelper.success(
            data=settings,
            message=f"Retrieved effective settings for restaurant {restaurant_id}"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/restaurants/{restaurant_id}/overrides/{config_key}")
async def set_restaurant_override(
    restaurant_id: str,
    config_key: str,
    request: RestaurantOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set a restaurant override for a platform setting"""
    try:
        # TODO: Verify user has admin access to this restaurant
        
        service = PlatformSettingsService(db)
        
        success = await service.set_restaurant_override(
            restaurant_id=restaurant_id,
            config_key=config_key,
            override_value=request.override_value,
            created_by=str(current_user.id),
            requires_approval=request.requires_approval
        )
        
        if success:
            status_msg = "pending approval" if request.requires_approval else "active"
            return APIResponseHelper.success(
                data={
                    'restaurant_id': restaurant_id,
                    'config_key': config_key,
                    'status': status_msg
                },
                message=f"Restaurant override set successfully ({status_msg})"
            )
        else:
            raise FynloException(message="Failed to set restaurant override"
            )
        
    except ValueError as e:
        raise ValidationException(message=str(e))
    except Exception as e:
        raise FynloException(message=str(e))
# Public sync endpoint for mobile apps
@router.get("/sync/platform-config")
async def sync_platform_config(
    restaurant_id: Optional[str] = Query(None, description="Restaurant ID for targeted settings"),
    categories: Optional[str] = Query(None, description="Comma-separated categories"),
    db: Session = Depends(get_db)
):
    """Sync platform configuration for mobile apps (public endpoint with rate limiting)"""
    try:
        service = PlatformSettingsService(db)
        
        # Parse categories
        category_list = categories.split(',') if categories else None
        
        # Get platform settings and feature flags
        all_settings = {}
        
        if category_list:
            for category in category_list:
                settings = await service.get_platform_settings(category=category.strip())
                all_settings.update(settings)
        else:
            all_settings = await service.get_platform_settings()
        
        # Get feature flags
        feature_flags = await service.get_feature_flags(restaurant_id=restaurant_id)
        
        # Get restaurant-specific effective settings if restaurant_id provided
        effective_settings = {}
        if restaurant_id:
            effective_settings = await service.get_restaurant_effective_settings(restaurant_id)
        
        return APIResponseHelper.success(
            data={
                'platform_settings': all_settings,
                'feature_flags': feature_flags,
                'effective_settings': effective_settings,
                'sync_timestamp': datetime.utcnow().isoformat(),
                'restaurant_id': restaurant_id
            },
            message="Platform configuration synchronized"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/categories")
async def get_setting_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_user)
):
    """Get all available setting categories"""
    try:
        service = PlatformSettingsService(db)
        settings = await service.get_platform_settings()
        
        categories = set()
        for setting_data in settings.values():
            categories.add(setting_data['category'])
        
        return APIResponseHelper.success(
            data=sorted(list(categories)),
            message=f"Retrieved {len(categories)} setting categories"
        )
        
    except Exception as e:
        raise FynloException(message=str(e))
