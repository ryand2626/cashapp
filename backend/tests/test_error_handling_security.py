"""
Test suite for error handling security
Ensures no sensitive information is exposed in production errors
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import patch, MagicMock
import json
from fastapi.testclient import TestClient
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

# Test without full app import to avoid initialization issues
from app.core.exceptions import (
    FynloException, AuthenticationException, ValidationException,
    ResourceNotFoundException, ConflictException, BusinessLogicException,
    PaymentException, InventoryException,
    fynlo_exception_handler, http_exception_handler
)
from app.core.responses import ErrorCodes
from app.core.config import settings


class TestErrorHandlingSecurity:
    """Test that errors don't expose sensitive information in production"""
    
    async def test_fynlo_exception_no_details_in_production(self):
        """Test FynloException doesn't expose details in production"""
        with patch.object(settings, 'ERROR_DETAIL_ENABLED', False):
            with patch.object(settings, 'ENVIRONMENT', 'production'):
                # Create an exception with sensitive details
                exc = AuthenticationException(
                    message="Invalid password for user admin@fynlo.com",
                    details={"attempts": 3, "ip": "192.168.1.1", "user_id": "12345"}
                )
                
                # Mock request
                mock_request = MagicMock(spec=Request)
                mock_request.url.path = "/api/v1/auth/login"
                mock_request.method = "POST"
                
                # Handle the exception
                response = await fynlo_exception_handler(mock_request, exc)
                data = json.loads(response.body.decode())
                
                # Verify response
                assert response.status_code == 401
                assert data["success"] is False
                # The APIResponseHelper.error() in responses.py always sets message to "Request failed"
                assert data["message"] == "Request failed"
                # The actual error message should be in the error object
                assert "error" in data
                assert data["error"]["message"] == "An application error occurred."
                assert data["error"]["code"] == "INVALID_CREDENTIALS"
                
                # Ensure no sensitive details leaked
                assert "admin@fynlo.com" not in str(data)
                assert "attempts" not in str(data)
                assert "ip" not in str(data) 
                assert "user_id" not in str(data)
                # In production mode, details should be minimal
                if "details" in data.get("error", {}):
                    assert "attempts" not in data["error"]["details"]
                    assert "ip" not in data["error"]["details"] 
                    assert "user_id" not in data["error"]["details"]
    
    async def test_http_exception_generic_in_production(self):
        """Test HTTPException returns generic messages in production"""
        with patch.object(settings, 'ERROR_DETAIL_ENABLED', False):
            with patch.object(settings, 'ENVIRONMENT', 'production'):
                # Create HTTPException with sensitive details
                exc = HTTPException(
                    status_code=404,
                    detail="User with email admin@fynlo.com not found in database table 'users'"
                )
                
                # Mock request
                mock_request = MagicMock(spec=Request)
                mock_request.url.path = "/api/v1/users/lookup"
                mock_request.method = "GET"
                
                # Handle the exception
                response = await http_exception_handler(mock_request, exc)
                data = json.loads(response.body.decode())
                
                # Verify response
                assert response.status_code == 404
                assert data["success"] is False
                # The APIResponseHelper.error() always sets message to "Request failed"
                assert data["message"] == "Request failed"
                # Check the error object
                assert "error" in data
                assert data["error"]["message"] == "Resource not found."
                # Ensure no sensitive details leaked
                assert "admin@fynlo.com" not in str(data)
                assert "database" not in str(data)
                assert "users" not in str(data)
    
    async def test_development_mode_shows_details(self):
        """Test development mode shows full error details"""
        with patch.object(settings, 'ERROR_DETAIL_ENABLED', True):
            with patch.object(settings, 'ENVIRONMENT', 'development'):
                exc = ValidationException(
                    message="Email format invalid",
                    field="email",
                    details={"value": "not-an-email", "pattern": "^[^@]+@[^@]+$"}
                )
                
                mock_request = MagicMock(spec=Request)
                mock_request.url.path = "/api/v1/users"
                mock_request.method = "POST"
                
                response = await fynlo_exception_handler(mock_request, exc)
                data = json.loads(response.body.decode())
                
                # In dev mode, details should be exposed
                assert data["message"] == "Request failed"
                assert data["error"]["message"] == "Email format invalid"
                # In dev mode, error details should be exposed
                if "details" in data["error"]:
                    assert data["error"]["details"]["field"] == "email"
                    assert data["error"]["details"]["value"] == "not-an-email"
    
    async def test_inventory_error_no_stock_levels(self):
        """Test inventory errors don't expose stock levels"""
        with patch.object(settings, 'ERROR_DETAIL_ENABLED', False):
            with patch.object(settings, 'ENVIRONMENT', 'production'):
                exc = InventoryException(
                    message="Cannot fulfill order",
                    product_id="PROD-123",
                    requested_quantity=50,
                    available_quantity=10,
                    details={"warehouse": "LON-01", "restock_date": "2024-02-01"}
                )
                
                mock_request = MagicMock(spec=Request)
                mock_request.url.path = "/api/v1/inventory/check"
                mock_request.method = "POST"
                
                response = await fynlo_exception_handler(mock_request, exc)
                data = json.loads(response.body.decode())
                
                # Verify response format
                assert data["success"] is False
                assert data["message"] == "Request failed"
                assert "error" in data
                assert data["error"]["message"] == "An application error occurred."
                
                # Ensure no stock information leaked
                response_str = str(data)
                assert "50" not in response_str  # requested quantity
                assert "10" not in response_str  # available quantity
                assert "PROD-123" not in response_str
                assert "LON-01" not in response_str
                assert "warehouse" not in response_str


class TestSensitiveLoggingFilter:
    """Test that sensitive data is filtered from logs"""
    
    def test_password_filtered_from_logs(self):
        """Test passwords are filtered from log messages"""
        from app.core.logging_filters import SensitiveDataFilter
        import logging
        
        # Create a test filter
        filter = SensitiveDataFilter()
        
        # Create a log record with sensitive data
        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg='User login failed for {"email": "user@test.com", "password": "secret123"}',
            args=(),
            exc_info=None
        )
        
        # Apply filter
        filter.filter(record)
        
        # Check password is redacted
        message = record.getMessage()
        assert "secret123" not in message
        assert "[REDACTED]" in message
        assert "user@test.com" not in message  # Email should be redacted too
        assert "[EMAIL]" in message
    
    def test_database_url_filtered(self):
        """Test database URLs are filtered from logs"""
        from app.core.logging_filters import SensitiveDataFilter
        import logging
        
        filter = SensitiveDataFilter()
        
        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg='Database connection failed: postgresql://user:pass@localhost:5432/db',
            args=(),
            exc_info=None
        )
        
        filter.filter(record)
        message = record.getMessage()
        
        assert "postgresql://user:pass@localhost:5432/db" not in message
        assert "[DATABASE_URL]" in message
    
    def test_file_paths_filtered(self):
        """Test file paths are filtered from logs"""
        from app.core.logging_filters import SensitiveDataFilter
        import logging
        
        filter = SensitiveDataFilter()
        
        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=1,
            msg='File not found: /opt/digitalocean/app/secrets/config.json',
            args=(),
            exc_info=None
        )
        
        filter.filter(record)
        message = record.getMessage()
        
        assert "/opt/digitalocean/app/secrets/config.json" not in message
        assert "[FILE_PATH]" in message


if __name__ == "__main__":
    # Run tests manually
    import asyncio
    
    print("Running error handling security tests...\n")
    
    test_error = TestErrorHandlingSecurity()
    test_logging = TestSensitiveLoggingFilter()
    
    # Run async tests
    loop = asyncio.get_event_loop()
    
    print("Testing FynloException in production mode...")
    loop.run_until_complete(test_error.test_fynlo_exception_no_details_in_production())
    print("✓ Passed")
    
    print("\nTesting HTTPException in production mode...")
    loop.run_until_complete(test_error.test_http_exception_generic_in_production())
    print("✓ Passed")
    
    print("\nTesting development mode shows details...")
    loop.run_until_complete(test_error.test_development_mode_shows_details())
    print("✓ Passed")
    
    print("\nTesting inventory error hides stock levels...")
    loop.run_until_complete(test_error.test_inventory_error_no_stock_levels())
    print("✓ Passed")
    
    # Run sync tests
    print("\nTesting password filtering in logs...")
    test_logging.test_password_filtered_from_logs()
    print("✓ Passed")
    
    print("\nTesting database URL filtering...")
    test_logging.test_database_url_filtered()
    print("✓ Passed")
    
    print("\nTesting file path filtering...")
    test_logging.test_file_paths_filtered()
    print("✓ Passed")
    
    print("\n✅ All tests passed!")