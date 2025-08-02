"""
Enhanced Exception Handling for Fynlo POS
iOS-friendly error management with detailed error information
"""

from typing import Any, Dict, Optional, List
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError
import logging
import traceback
import uuid

from app.core.config import settings # Import settings
from app.core.responses import APIResponseHelper, ErrorCodes


logger = logging.getLogger(__name__)


class FynloException(Exception):
    """Base exception class for Fynlo POS specific errors"""
    
    def __init__(
        self,
        message: str,
        error_code: str = ErrorCodes.INTERNAL_ERROR,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = 500
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationException(FynloException):
    """Authentication related exceptions"""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code=ErrorCodes.INVALID_CREDENTIALS,
            details=details,
            status_code=401
        )


class AuthorizationException(FynloException):
    """Authorization related exceptions"""
    
    def __init__(self, message: str = "Access denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_code=ErrorCodes.FORBIDDEN,
            details=details,
            status_code=403
        )


class ValidationException(FynloException):
    """Validation related exceptions"""
    
    def __init__(
        self,
        message: str = "Validation failed",
        field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        validation_details = details or {}
        if field:
            validation_details["field"] = field
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.VALIDATION_ERROR,
            details=validation_details,
            status_code=422
        )


class ResourceNotFoundException(FynloException):
    """Resource not found exceptions"""
    
    def __init__(
        self,
        resource: str = "Resource",
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        message = f"{resource} not found"
        if resource_id:
            message += f" (ID: {resource_id})"
            
        resource_details = details or {}
        if resource_id:
            resource_details["resource_id"] = resource_id
        resource_details["resource_type"] = resource
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.NOT_FOUND,
            details=resource_details,
            status_code=404
        )


class ConflictException(FynloException):
    """Resource conflict exceptions"""
    
    def __init__(
        self,
        message: str = "Resource conflict",
        conflicting_field: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        conflict_details = details or {}
        if conflicting_field:
            conflict_details["conflicting_field"] = conflicting_field
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.CONFLICT,
            details=conflict_details,
            status_code=409
        )


class BusinessLogicException(FynloException):
    """Business logic related exceptions"""
    
    def __init__(
        self,
        message: str,
        error_code: str = ErrorCodes.INVALID_ORDER_STATE,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            message=message,
            error_code=error_code,
            details=details,
            status_code=400
        )


class PaymentException(FynloException):
    """Payment processing exceptions"""
    
    def __init__(
        self,
        message: str = "Payment processing failed",
        payment_method: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        payment_details = details or {}
        if payment_method:
            payment_details["payment_method"] = payment_method
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.PAYMENT_FAILED,
            details=payment_details,
            status_code=400
        )


class ServiceUnavailableError(FynloException):
    """Service unavailable exceptions for critical infrastructure failures"""
    
    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        service_name: Optional[str] = None,
        retry_after: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        service_details = details or {}
        if service_name:
            service_details["service"] = service_name
        if retry_after:
            service_details["retry_after_seconds"] = retry_after
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.SERVICE_UNAVAILABLE,
            details=service_details,
            status_code=503
        )


class InventoryException(FynloException):
    """Inventory related exceptions"""
    
    def __init__(
        self,
        message: str = "Insufficient stock",
        product_id: Optional[str] = None,
        requested_quantity: Optional[int] = None,
        available_quantity: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        inventory_details = details or {}
        if product_id:
            inventory_details["product_id"] = product_id
        if requested_quantity is not None:
            inventory_details["requested_quantity"] = requested_quantity
        if available_quantity is not None:
            inventory_details["available_quantity"] = available_quantity
            
        super().__init__(
            message=message,
            error_code=ErrorCodes.INSUFFICIENT_STOCK,
            details=inventory_details,
            status_code=400
        )


async def fynlo_exception_handler(request: Request, exc: FynloException) -> JSONResponse:
    """Handle Fynlo specific exceptions"""
    
    # Log the exception for debugging
    error_id = str(uuid.uuid4())
    logger.error(
        f"FynloException [{error_id}]: {exc.error_code} - {exc.message}",
        extra={
            "error_id": error_id,
            "error_code": exc.error_code,
            "details": exc.details,
            "request_path": request.url.path,
            "request_method": request.method
        }
    )
    
    # Add error_id to details for tracking
    response_details = {"error_id": error_id}
    if settings.ERROR_DETAIL_ENABLED:
        response_details.update(exc.details)
    
    return APIResponseHelper.error(
        message=exc.message if settings.ERROR_DETAIL_ENABLED else "An application error occurred.",
        error_code=exc.error_code,
        details=response_details,
        status_code=exc.status_code
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle FastAPI HTTP exceptions with standardized format"""
    
    error_id = str(uuid.uuid4())
    logger.error(
        f"HTTPException [{error_id}]: {exc.status_code} - {exc.detail}",
        extra={
            "error_id": error_id,
            "status_code": exc.status_code,
            "request_path": request.url.path,
            "request_method": request.method
        }
    )
    
    # Map common HTTP status codes to error codes
    error_code_mapping = {
        400: ErrorCodes.VALIDATION_ERROR,
        401: ErrorCodes.UNAUTHORIZED,
        403: ErrorCodes.FORBIDDEN,
        404: ErrorCodes.NOT_FOUND,
        409: ErrorCodes.CONFLICT,
        422: ErrorCodes.VALIDATION_ERROR,
        500: ErrorCodes.INTERNAL_ERROR
    }
    
    error_code = error_code_mapping.get(exc.status_code, ErrorCodes.INTERNAL_ERROR)
    
    generic_messages = {
        400: "Bad request.",
        401: "Unauthorized.",
        403: "Forbidden.",
        404: "Resource not found.",
        422: "Validation error.",
        500: "Internal server error."
    }

    response_message = str(exc.detail)
    response_details = {"error_id": error_id}

    if not settings.ERROR_DETAIL_ENABLED:
        response_message = generic_messages.get(exc.status_code, "An error occurred.")
        # For validation (422) or bad request (400) specifically,
        # we might want a slightly more indicative generic message if details are hidden.
        if exc.status_code == 422:
            response_message = "Request validation failed. Please check your input."
        elif exc.status_code == 400:
             response_message = "Invalid request format or data."
    elif isinstance(exc.detail, dict): # If detail is a dict, pass it along in debug mode
        response_details.update(exc.detail)


    return APIResponseHelper.error(
        message=response_message,
        error_code=error_code,
        details=response_details,
        status_code=exc.status_code
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation exceptions with detailed field information"""
    
    error_id = str(uuid.uuid4())
    
    # Parse validation errors into iOS-friendly format
    validation_errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        validation_errors.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    logger.error(
        f"ValidationException [{error_id}]: Request validation failed",
        extra={
            "error_id": error_id,
            "validation_errors": validation_errors,
            "request_path": request.url.path,
            "request_method": request.method
        }
    )
    
    if settings.ERROR_DETAIL_ENABLED:
        return APIResponseHelper.validation_error(
            message="Request validation failed",
            errors=validation_errors # Detailed errors
        )
    else:
        # In production (or when ERROR_DETAIL_ENABLED=false), return a generic validation error
        # The detailed errors are still logged.
        return APIResponseHelper.error(
            message="Request validation failed. Please check your input.",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"error_id": error_id}, # Only error_id, no specific field details
            status_code=422
        )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions with error tracking"""
    
    error_id = str(uuid.uuid4())
    
    # Log full traceback for debugging
    logger.error(
        f"UnhandledException [{error_id}]: {type(exc).__name__} - {str(exc)}",
        extra={
            "error_id": error_id,
            "exception_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
            "request_path": request.url.path,
            "request_method": request.method
        }
    )
    
    # The message is already generic. Ensure no other details are leaked.
    # The error_id is important for tracking.
    response_message = "An unexpected error occurred. Please try again later."
    if settings.ERROR_DETAIL_ENABLED:
        # Optionally, provide a bit more context in dev/debug mode, but still avoid full trace in response
        response_message = f"An unexpected error of type {type(exc).__name__} occurred."

    return APIResponseHelper.internal_error(
        message=response_message,
        error_id=error_id
        # No other details should be sent to the client for general exceptions
    )


def register_exception_handlers(app):
    """Register all exception handlers with the FastAPI app"""
    
    app.add_exception_handler(FynloException, fynlo_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)


# iOS-specific error utilities
class iOSErrorHelper:
    """Helper functions for iOS-specific error handling"""
    
    @staticmethod
    def invalid_credentials() -> AuthenticationException:
        """Standard invalid credentials error for iOS"""
        return AuthenticationException(
            message="Invalid email or password",
            details={"suggestion": "Please check your credentials and try again"}
        )
    
    @staticmethod
    def token_expired() -> AuthenticationException:
        """Standard token expired error for iOS"""
        return AuthenticationException(
            message="Your session has expired",
            details={
                "error_code": ErrorCodes.TOKEN_EXPIRED,
                "suggestion": "Please log in again"
            }
        )
    
    @staticmethod
    def insufficient_permissions() -> AuthorizationException:
        """Standard insufficient permissions error for iOS"""
        return AuthorizationException(
            message="You don't have permission to perform this action",
            details={"suggestion": "Contact your manager for access"}
        )
    
    @staticmethod
    def order_modification_denied(order_status: str) -> BusinessLogicException:
        """Standard order modification error for iOS"""
        return BusinessLogicException(
            message=f"Cannot modify order in '{order_status}' status",
            error_code=ErrorCodes.ORDER_CANNOT_BE_MODIFIED,
            details={
                "current_status": order_status,
                "suggestion": "Contact kitchen staff if changes are needed"
            }
        )
    
    @staticmethod
    def product_not_available(product_name: str) -> InventoryException:
        """Standard product availability error for iOS"""
        return InventoryException(
            message=f"'{product_name}' is currently unavailable",
            details={
                "product_name": product_name,
                "suggestion": "Please select an alternative item"
            }
        )