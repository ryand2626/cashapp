"""
Standardized API Response System for Fynlo POS
iOS-friendly response wrapper for consistent mobile app integration
"""

from typing import Any, Optional, Dict, List
from datetime import datetime
from pydantic import BaseModel
from fastapi import status
from fastapi.responses import JSONResponse


class APIResponse(BaseModel):
    """Standardized API response wrapper for iOS consumption"""
    success: bool
    data: Optional[Any] = None
    message: str = "Success"
    error: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses"""
    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool


class ErrorDetail(BaseModel):
    """Detailed error information"""
    code: str
    message: str
    field: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class APIResponseHelper:
    """Helper class for creating standardized API responses"""
    
    @staticmethod
    def success(
        data: Any = None,
        message: str = "Success",
        meta: Optional[Dict[str, Any]] = None,
        status_code: int = status.HTTP_200_OK
    ) -> JSONResponse:
        """Create successful response"""
        response_data = APIResponse(
            success=True,
            data=data,
            message=message,
            meta=meta,
            timestamp=datetime.utcnow()
        )
        
        return JSONResponse(
            status_code=status_code,
            content=response_data.model_dump(mode='json')
        )
    
    @staticmethod
    def created(
        data: Any = None,
        message: str = "Resource created successfully",
        meta: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """Create successful creation response"""
        return APIResponseHelper.success(
            data=data,
            message=message,
            meta=meta,
            status_code=status.HTTP_201_CREATED
        )
    
    @staticmethod
    def error(
        message: str,
        error_code: str = "GENERAL_ERROR",
        details: Optional[Dict[str, Any]] = None,
        field: Optional[str] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST
    ) -> JSONResponse:
        """Create error response"""
        error_detail = ErrorDetail(
            code=error_code,
            message=message,
            field=field,
            details=details
        )
        
        response_data = APIResponse(
            success=False,
            message="Request failed",
            error=error_detail.model_dump(),
            timestamp=datetime.utcnow()
        )
        
        return JSONResponse(
            status_code=status_code,
            content=response_data.model_dump(mode='json')
        )
    
    @staticmethod
    def validation_error(
        message: str = "Validation failed",
        errors: List[Dict[str, Any]] = None
    ) -> JSONResponse:
        """Create validation error response"""
        return APIResponseHelper.error(
            message=message,
            error_code="VALIDATION_ERROR",
            details={"validation_errors": errors or []},
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )
    
    @staticmethod
    def not_found(
        resource: str = "Resource",
        resource_id: Optional[str] = None
    ) -> JSONResponse:
        """Create not found error response"""
        message = f"{resource} not found"
        if resource_id:
            message += f" (ID: {resource_id})"
            
        return APIResponseHelper.error(
            message=message,
            error_code="NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    @staticmethod
    def unauthorized(message: str = "Authentication required") -> JSONResponse:
        """Create unauthorized error response"""
        return APIResponseHelper.error(
            message=message,
            error_code="UNAUTHORIZED",
            status_code=status.HTTP_401_UNAUTHORIZED
        )
    
    @staticmethod
    def forbidden(message: str = "Access denied") -> JSONResponse:
        """Create forbidden error response"""
        return APIResponseHelper.error(
            message=message,
            error_code="FORBIDDEN",
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def conflict(
        message: str = "Resource conflict",
        conflicting_field: Optional[str] = None
    ) -> JSONResponse:
        """Create conflict error response"""
        return APIResponseHelper.error(
            message=message,
            error_code="CONFLICT",
            field=conflicting_field,
            status_code=status.HTTP_409_CONFLICT
        )
    
    @staticmethod
    def internal_error(
        message: str = "Internal server error",
        error_id: Optional[str] = None
    ) -> JSONResponse:
        """Create internal server error response"""
        details = {"error_id": error_id} if error_id else None
        
        return APIResponseHelper.error(
            message=message,
            error_code="INTERNAL_ERROR",
            details=details,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    @staticmethod
    def paginated(
        data: List[Any],
        page: int,
        limit: int,
        total: int,
        message: str = "Success"
    ) -> JSONResponse:
        """Create paginated response"""
        pages = (total + limit - 1) // limit if total > 0 else 0
        
        pagination_meta = PaginationMeta(
            page=page,
            limit=limit,
            total=total,
            pages=pages,
            has_next=page < pages,
            has_prev=page > 1
        )
        
        return APIResponseHelper.success(
            data=data,
            message=message,
            meta={"pagination": pagination_meta.model_dump()}
        )


# iOS-specific response helpers
class iOSResponseHelper:
    """iOS-specific response helpers for enhanced mobile experience"""
    
    @staticmethod
    def login_success(
        access_token: str,
        user_data: Dict[str, Any],
        restaurant_data: Optional[Dict[str, Any]] = None
    ) -> JSONResponse:
        """Standardized login success response for iOS"""
        response_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_data
        }
        
        if restaurant_data:
            response_data["restaurant"] = restaurant_data
        
        return APIResponseHelper.success(
            data=response_data,
            message="Login successful"
        )
    
    @staticmethod
    def logout_success() -> JSONResponse:
        """Standardized logout response for iOS"""
        return APIResponseHelper.success(
            message="Logout successful"
        )
    
    @staticmethod
    def order_created(order_data: Dict[str, Any]) -> JSONResponse:
        """Standardized order creation response for iOS"""
        return APIResponseHelper.created(
            data=order_data,
            message="Order created successfully"
        )
    
    @staticmethod
    def payment_success(payment_data: Dict[str, Any]) -> JSONResponse:
        """Standardized payment success response for iOS"""
        return APIResponseHelper.success(
            data=payment_data,
            message="Payment processed successfully"
        )
    
    @staticmethod
    def menu_response(menu_data: Dict[str, Any]) -> JSONResponse:
        """Standardized menu response for iOS"""
        return APIResponseHelper.success(
            data=menu_data,
            message="Menu retrieved successfully",
            meta={
                "cache_duration": 600,  # 10 minutes
                "last_updated": datetime.utcnow().isoformat()
            }
        )


# Error code constants for consistency
class ErrorCodes:
    """Standardized error codes for iOS app handling"""
    
    # Authentication errors
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    TOKEN_INVALID = "TOKEN_INVALID"
    ACCOUNT_INACTIVE = "ACCOUNT_INACTIVE"
    
    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_FORMAT = "INVALID_FORMAT"
    
    # Resource errors
    NOT_FOUND = "NOT_FOUND"
    ALREADY_EXISTS = "ALREADY_EXISTS"
    CONFLICT = "CONFLICT"
    
    # Permission errors
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS"
    
    # Business logic errors
    ORDER_CANNOT_BE_MODIFIED = "ORDER_CANNOT_BE_MODIFIED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK"
    INVALID_ORDER_STATE = "INVALID_ORDER_STATE"
    
    # System errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"


# HTTP status code constants
class HTTPStatusCodes:
    """HTTP status codes for consistent API responses"""
    
    # Success
    OK = 200
    CREATED = 201
    ACCEPTED = 202
    NO_CONTENT = 204
    
    # Client errors
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    METHOD_NOT_ALLOWED = 405
    CONFLICT = 409
    UNPROCESSABLE_ENTITY = 422
    TOO_MANY_REQUESTS = 429
    
    # Server errors
    INTERNAL_SERVER_ERROR = 500
    BAD_GATEWAY = 502
    SERVICE_UNAVAILABLE = 503
    GATEWAY_TIMEOUT = 504