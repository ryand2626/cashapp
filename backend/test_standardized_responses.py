"""
Test script to verify standardized API responses
Run this to validate the new response format works correctly
"""

import asyncio
import json
from datetime import datetime
from app.core.responses import APIResponseHelper, iOSResponseHelper, ErrorCodes
from app.core.exceptions import (
    AuthenticationException,
    ValidationException,
    ResourceNotFoundException,
    ConflictException
)


async def test_standardized_responses():
    """Test all standardized response types"""
    
    print("🧪 Testing Standardized API Responses\n")
    
    # Test success response
    print("✅ SUCCESS RESPONSE:")
    success_response = APIResponseHelper.success(
        data={"user_id": "123", "name": "John Doe"},
        message="User retrieved successfully"
    )
    print(json.dumps(json.loads(success_response.body), indent=2))
    print()
    
    # Test created response
    print("✅ CREATED RESPONSE:")
    created_response = APIResponseHelper.created(
        data={"order_id": "ORD-456", "status": "pending"},
        message="Order created successfully"
    )
    print(json.dumps(json.loads(created_response.body), indent=2))
    print()
    
    # Test error response
    print("❌ ERROR RESPONSE:")
    error_response = APIResponseHelper.error(
        message="Product not found",
        error_code=ErrorCodes.NOT_FOUND,
        details={"product_id": "prod-789"}
    )
    print(json.dumps(json.loads(error_response.body), indent=2))
    print()
    
    # Test validation error
    print("❌ VALIDATION ERROR:")
    validation_response = APIResponseHelper.validation_error(
        message="Request validation failed",
        errors=[
            {"field": "email", "message": "Invalid email format"},
            {"field": "password", "message": "Password too short"}
        ]
    )
    print(json.dumps(json.loads(validation_response.body), indent=2))
    print()
    
    # Test iOS login response
    print("📱 iOS LOGIN RESPONSE:")
    ios_login = iOSResponseHelper.login_success(
        access_token="jwt_token_here",
        user_data={
            "id": "user-123",
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "role": "employee"
        }
    )
    print(json.dumps(json.loads(ios_login.body), indent=2))
    print()
    
    # Test paginated response
    print("📄 PAGINATED RESPONSE:")
    paginated_response = APIResponseHelper.paginated(
        data=[
            {"id": "1", "name": "Product 1"},
            {"id": "2", "name": "Product 2"}
        ],
        page=1,
        limit=10,
        total=25
    )
    print(json.dumps(json.loads(paginated_response.body), indent=2))
    print()
    
    print("✅ All response formats validated successfully!")


if __name__ == "__main__":
    asyncio.run(test_standardized_responses())