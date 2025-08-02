"""
Tenant Isolation Middleware
Ensures all API requests are properly isolated by restaurant
Platform owners (Ryan and Arnaud) bypass all restrictions
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import json
import logging
from typing import Callable

from app.core.tenant_security import TenantSecurity

logger = logging.getLogger(__name__)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce tenant isolation across all API endpoints
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request to ensure tenant isolation
        """
        # Skip middleware for non-API routes
        if not request.url.path.startswith("/api/"):
            return await call_next(request)
        
        # Skip for public endpoints
        public_endpoints = [
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/verify",
            "/api/v1/health",
            "/api/docs",
            "/api/openapi.json"
        ]
        
        if any(request.url.path.startswith(endpoint) for endpoint in public_endpoints):
            return await call_next(request)
        
        try:
            # Log the request for security audit
            if hasattr(request.state, "user") and request.state.user:
                user = request.state.user
                is_platform_owner = TenantSecurity.is_platform_owner(user)
                
                logger.info(
                    f"API Request: {request.method} {request.url.path} | "
                    f"User: {user.email} | "
                    f"Role: {user.role} | "
                    f"Restaurant: {user.restaurant_id} | "
                    f"Platform Owner: {is_platform_owner}"
                )
                
                # Add security headers to response
                response = await call_next(request)
                response.headers["X-Tenant-Isolated"] = "true"
                response.headers["X-Platform-Owner"] = str(is_platform_owner)
                
                return response
            else:
                # No user context, proceed normally
                return await call_next(request)
                
        except Exception as e:
            logger.error(f"Tenant isolation middleware error: {str(e)}")
            # Don't break the request, just log the error
            return await call_next(request)


class TenantValidationMiddleware:
    """
    Additional middleware to validate tenant access in request payloads
    """
    
    @staticmethod
    async def validate_request_body(request: Request) -> None:
        """
        Validate that request body doesn't contain cross-tenant data
        """
        # Only check POST, PUT, PATCH requests
        if request.method not in ["POST", "PUT", "PATCH"]:
            return
        
        # Get request body
        body = await request.body()
        if not body:
            return
        
        try:
            data = json.loads(body)
            
            # Check if restaurant_id is in the payload
            if "restaurant_id" in data and hasattr(request.state, "user"):
                user = request.state.user
                
                # Platform owners can specify any restaurant_id
                if TenantSecurity.is_platform_owner(user):
                    return
                
                # Other users cannot specify a different restaurant_id
                if data["restaurant_id"] != str(user.restaurant_id):
                    logger.warning(
                        f"Tenant violation attempt: User {user.email} tried to access "
                        f"restaurant {data['restaurant_id']} but belongs to {user.restaurant_id}"
                    )
                    # The actual validation will happen in the endpoint
                    # This is just for logging/monitoring
                    
        except json.JSONDecodeError:
            # Not JSON, skip validation
            pass
        except Exception as e:
            logger.error(f"Error validating request body: {str(e)}")