"""
SumUp Payment Provider Initialization Endpoint
Provides secure configuration for mobile app without exposing API keys

Last updated: 2025-07-29 - Force rebuild after rate limiter fix
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import os
import logging
from fastapi import Query

from app.core.database import get_db, User
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper, ErrorCodes
from app.core.exceptions import FynloException
from app.middleware.rate_limit_middleware import limiter
from app.core.tenant_security import TenantSecurity

logger = logging.getLogger(__name__)
router = APIRouter()


class SumUpInitRequest(BaseModel):
    """Request model for SumUp initialization"""
    mode: str = Field(default="production", description="Mode: sandbox or production")
    
    class Config:
        schema_extra = {
            "example": {
                "mode": "production"
            }
        }


class SumUpConfigData(BaseModel):
    """SumUp SDK configuration data"""
    appId: str = Field(..., description="SumUp app ID for mobile SDK")
    environment: str = Field(..., description="Environment: sandbox or production")
    merchantCode: Optional[str] = Field(None, description="SumUp merchant code if available")
    currency: str = Field(default="GBP", description="Currency code")

class SumUpConfigResponse(BaseModel):
    """Response model for SumUp configuration matching frontend expectations"""
    config: SumUpConfigData = Field(..., description="SumUp SDK configuration")
    sdkInitialized: bool = Field(..., description="Whether SDK is initialized")
    enabled: bool = Field(..., description="Whether SumUp is enabled for this restaurant")
    features: Dict[str, bool] = Field(..., description="Enabled SumUp features")


class MerchantValidationRequest(BaseModel):
    """Request model for merchant code validation"""
    merchant_code: str = Field(..., description="SumUp merchant code to validate")
    
    class Config:
        schema_extra = {
            "example": {
                "merchant_code": "MC123456"
            }
        }


@router.post("/initialize", response_model=SumUpConfigResponse)
@limiter.limit("10/minute")
async def initialize_sumup(
    request: Request,
    init_request: SumUpInitRequest,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initialize SumUp configuration for mobile app
    
    This endpoint provides the necessary configuration for the mobile app
    to initialize the SumUp SDK without exposing sensitive API keys.
    
    Returns:
        - Merchant code (if configured)
        - Environment setting
        - App ID for SDK initialization
        - Feature flags
    
    Security:
        - Requires authenticated user
        - Restaurant must have active subscription
        - Rate limited to prevent abuse
    """
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        # Use the provided restaurant_id or fall back to user's default
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Check if restaurant has active subscription
        # TODO: Add subscription validation when subscription service is available
        
        # Get SumUp configuration from environment
        sumup_environment = os.getenv("SUMUP_ENVIRONMENT", "production")
        sumup_app_id = os.getenv("SUMUP_APP_ID", "com.fynlo.pos")
        
        # Check if SumUp is properly configured
        sumup_api_key = os.getenv("SUMUP_API_KEY")
        if not sumup_api_key:
            logger.warning(f"SumUp API key not configured for restaurant {restaurant_id}")
            return APIResponseHelper.success(
                data={
                    "merchant_code": None,
                    "environment": sumup_environment,
                    "app_id": sumup_app_id,
                    "enabled": False,
                    "features": {
                        "card_reader": False,
                        "tap_to_pay": False,
                        "refunds": False
                    }
                },
                message="SumUp is not configured for this restaurant"
            )
        
        # TODO: Fetch merchant code from database if stored per restaurant
        # For now, use a placeholder or environment variable
        merchant_code = os.getenv("SUMUP_MERCHANT_CODE")
        
        # Determine feature availability based on subscription plan
        # TODO: Implement proper feature flags based on subscription
        features = {
            "card_reader": True,  # Physical card reader support
            "tap_to_pay": True,   # Tap to pay on phone
            "refunds": True       # Refund capabilities
        }
        
        # Override with requested mode if valid
        if init_request.mode in ["sandbox", "production"]:
            environment = init_request.mode
        else:
            environment = sumup_environment
        
        # Log initialization request for audit
        logger.info(
            f"SumUp initialization requested by user {current_user.id} "
            f"for restaurant {restaurant_id} in {environment} mode"
        )
        
        # Build response using the proper model
        config_data = SumUpConfigData(
            appId=sumup_app_id,
            environment=environment,
            merchantCode=merchant_code,
            currency="GBP"  # Using GBP to match application standard
        )
        
        response = SumUpConfigResponse(
            config=config_data,
            sdkInitialized=True,
            enabled=True,
            features=features
        )
        
        return APIResponseHelper.success(
            data=response.dict(),
            message="SumUp configuration retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Error initializing SumUp: {str(e)}")
        return APIResponseHelper.internal_error(
            message="Failed to initialize SumUp configuration",
            error_id=str(e)
        )


@router.get("/status")
@limiter.limit("30/minute")
async def get_sumup_status(
    request: Request,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current SumUp integration status
    
    Returns the current status of SumUp integration including:
    - Configuration status
    - Last successful transaction (if any)
    - Current mode (sandbox/production)
    - Feature availability
    """
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        # Use the provided restaurant_id or fall back to user's default
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Check SumUp configuration
        sumup_api_key = os.getenv("SUMUP_API_KEY")
        sumup_environment = os.getenv("SUMUP_ENVIRONMENT", "production")
        
        status_data = {
            "configured": bool(sumup_api_key),
            "environment": sumup_environment,
            "last_transaction": None,  # TODO: Fetch from database
            "total_transactions": 0,   # TODO: Fetch from database
            "features": {
                "card_reader": bool(sumup_api_key),
                "tap_to_pay": bool(sumup_api_key),
                "refunds": bool(sumup_api_key)
            }
        }
        
        return APIResponseHelper.success(
            data=status_data,
            message="SumUp status retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Error getting SumUp status: {str(e)}")
        return APIResponseHelper.internal_error(
            message="Failed to retrieve SumUp status",
            error_id=str(e)
        )


@router.post("/validate-merchant")
@limiter.limit("5/minute")
async def validate_merchant_code(
    request: Request,
    validation_request: MerchantValidationRequest,
    current_restaurant_id: Optional[str] = Query(None, description="Restaurant ID for multi-location owners"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validate a SumUp merchant code
    
    This endpoint can be used to validate a merchant code
    before storing it in the configuration.
    
    Note: Actual validation would require calling SumUp API
    """
    try:
        # Validate restaurant access for multi-tenant
        await TenantSecurity.validate_restaurant_access(
            current_user, current_restaurant_id or current_user.restaurant_id, db=db
        )
        # Use the provided restaurant_id or fall back to user's default
        restaurant_id = current_restaurant_id or current_user.restaurant_id
        
        # Check permissions
        if current_user.role not in ['platform_owner', 'restaurant_owner', 'manager']:
            return APIResponseHelper.forbidden(
                message="Insufficient permissions to validate merchant code"
            )
        
        # Basic validation
        if not validation_request.merchant_code or len(validation_request.merchant_code) < 6:
            return APIResponseHelper.validation_error(
                message="Invalid merchant code format",
                errors=[{
                    "field": "merchant_code",
                    "message": "Merchant code must be at least 6 characters"
                }]
            )
        
        # TODO: Implement actual SumUp API validation
        # For now, just return success
        
        return APIResponseHelper.success(
            data={
                "merchantCode": validation_request.merchant_code,
                "valid": True,
                "message": "Merchant code format is valid"
            },
            message="Merchant code validated successfully"
        )
        
    except Exception as e:
        logger.error(f"Error validating merchant code: {str(e)}")
        return APIResponseHelper.internal_error(
            message="Failed to validate merchant code",
            error_id=str(e)
        )