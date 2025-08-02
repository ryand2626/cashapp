#!/usr/bin/env python3
"""
Test script for Enhanced Error Handling
Tests comprehensive error handling and validation for iOS integration
"""

import asyncio
import json
from datetime import datetime, time

def test_exception_system():
    """Test the exception system"""
    print("🧪 Testing Exception System...")
    
    from app.core.exceptions import (
        FynloException, 
        ErrorCodes,
        AuthenticationException,
        ValidationException,
        BusinessLogicException
    )
    from app.core.responses import APIResponseHelper
    
    # Test 1: Basic FynloException
    print("\n1. Testing FynloException...")
    try:
        raise FynloException(
            message="Test error message",
            error_code=ErrorCodes.VALIDATION_ERROR,
            details={"field": "test_field", "value": "invalid_value"}
        )
    except FynloException as e:
        print(f"✅ Exception caught: {e.message}")
        print(f"   Error Code: {e.error_code}")
        print(f"   Details: {e.details}")
    
    # Test 2: Specific exception types
    print("\n2. Testing specific exception types...")
    try:
        raise AuthenticationException("Invalid credentials")
    except AuthenticationException as e:
        print(f"✅ AuthenticationException: {e.message}")
    
    # Test 3: Response generation from exception
    print("\n3. Testing error response generation...")
    try:
        raise ValidationException(
            message="Validation failed",
            details={"errors": ["Field required", "Invalid format"]}
        )
    except FynloException as e:
        response = APIResponseHelper.error(
            message=e.message,
            error_code=e.error_code,
            details=e.details,
            status_code=e.status_code
        )
        print(f"✅ Error response generated:")
        print(f"   Success: {response.get('success')}")
        print(f"   Message: {response.get('message')}")
        print(f"   Error: {response.get('error', {}).get('code')}")

def test_validation_system():
    """Test the validation system"""
    print("\n🔍 Testing Validation System...")
    
    from app.core.validation import (
        BusinessValidator,
        ValidationResult,
        validate_order_or_raise,
        validate_status_transition_or_raise
    )
    
    # Test 1: Order validation
    print("\n1. Testing order validation...")
    
    # Valid order
    valid_order = {
        "items": [
            {
                "product_id": "123",
                "quantity": 2,
                "unit_price": 10.50,
                "total_price": 21.00
            }
        ],
        "order_type": "dine_in",
        "table_number": "T5"
    }
    
    valid_products = [
        {
            "id": "123",
            "price": 10.50,
            "stock_tracking": True,
            "stock_quantity": 10
        }
    ]
    
    result = BusinessValidator.validate_order_creation(valid_order, valid_products)
    if result.is_valid:
        print("✅ Valid order passed validation")
    else:
        print(f"❌ Valid order failed: {[e.message for e in result.errors]}")
    
    # Invalid order
    invalid_order = {
        "items": [
            {
                "product_id": "999",  # Non-existent product
                "quantity": -1,       # Invalid quantity
                "unit_price": 5.00,   # Price mismatch
                "total_price": -5.00
            }
        ],
        "order_type": "invalid_type",  # Invalid order type
        "table_number": ""             # Missing table for dine-in
    }
    
    result = BusinessValidator.validate_order_creation(invalid_order, valid_products)
    if not result.is_valid:
        print(f"✅ Invalid order correctly rejected ({len(result.errors)} errors):")
        for error in result.errors:
            print(f"   - {error.field}: {error.message}")
    else:
        print("❌ Invalid order incorrectly passed validation")
    
    # Test 2: Status transition validation
    print("\n2. Testing status transition validation...")
    
    # Valid transition
    result = BusinessValidator.validate_order_status_transition("pending", "confirmed")
    if result.is_valid:
        print("✅ Valid transition (pending → confirmed) allowed")
    
    # Invalid transition
    result = BusinessValidator.validate_order_status_transition("completed", "pending")
    if not result.is_valid:
        print(f"✅ Invalid transition (completed → pending) rejected: {result.errors[0].message}")
    
    # Test 3: Exception raising
    print("\n3. Testing validation exception raising...")
    try:
        validate_order_or_raise(invalid_order, valid_products)
        print("❌ Should have raised exception")
    except Exception as e:
        print(f"✅ Exception raised: {e}")

def test_business_logic_validation():
    """Test business logic validation"""
    print("\n💼 Testing Business Logic Validation...")
    
    from app.core.validation import BusinessValidator
    
    # Test 1: Payment validation
    print("\n1. Testing payment validation...")
    
    # Valid payment
    result = BusinessValidator.validate_payment_amount(
        order_total=25.50,
        payment_amount=25.50,
        payment_method="qr_code"
    )
    if result.is_valid:
        print("✅ Valid payment passed validation")
    
    # Invalid payment
    result = BusinessValidator.validate_payment_amount(
        order_total=25.50,
        payment_amount=20.00,  # Amount mismatch
        payment_method="invalid_method"  # Invalid method
    )
    if not result.is_valid:
        print(f"✅ Invalid payment rejected ({len(result.errors)} errors):")
        for error in result.errors:
            print(f"   - {error.field}: {error.message}")
    
    # Test 2: Business hours validation
    print("\n2. Testing business hours validation...")
    
    business_hours = {
        "monday": {"open": "09:00", "close": "21:00"},
        "tuesday": {"open": "09:00", "close": "21:00"}
    }
    
    # Valid time
    valid_time = datetime(2025, 6, 18, 12, 30)  # Assuming it's a Monday
    result = BusinessValidator.validate_business_hours(valid_time, business_hours)
    if result.is_valid:
        print("✅ Valid business hours check passed")
    
    # Invalid time (closed day)
    invalid_time = datetime(2025, 6, 21, 12, 30)  # Assuming it's a Saturday (not in business_hours)
    result = BusinessValidator.validate_business_hours(invalid_time, business_hours)
    if not result.is_valid:
        print(f"✅ Closed day correctly rejected: {result.errors[0].message}")
    
    # Test 3: Customer validation
    print("\n3. Testing customer validation...")
    
    # Valid customer
    valid_customer = {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+44 7700 900123"
    }
    
    result = BusinessValidator.validate_customer_data(valid_customer)
    if result.is_valid:
        print("✅ Valid customer data passed")
    
    # Invalid customer
    invalid_customer = {
        "first_name": "",  # Missing required field
        "last_name": "Doe",
        "email": "invalid-email",  # Invalid format
        "phone": "invalid-phone"   # Invalid format
    }
    
    result = BusinessValidator.validate_customer_data(invalid_customer)
    if not result.is_valid:
        print(f"✅ Invalid customer rejected ({len(result.errors)} errors):")
        for error in result.errors:
            print(f"   - {error.field}: {error.message}")

def test_ios_friendly_responses():
    """Test iOS-friendly error responses"""
    print("\n📱 Testing iOS-Friendly Responses...")
    
    from app.core.responses import APIResponseHelper, iOSErrorHelper
    from app.core.exceptions import ErrorCodes
    
    # Test 1: Standard error response
    print("\n1. Testing standard error response...")
    error_response = APIResponseHelper.error(
        message="Product not found",
        error_code=ErrorCodes.NOT_FOUND,
        details={"product_id": "123"},
        status_code=404
    )
    
    print("✅ Error response structure:")
    print(f"   Success: {error_response['success']}")
    print(f"   Message: {error_response['message']}")
    print(f"   Error Code: {error_response['error']['code']}")
    print(f"   Has timestamp: {'timestamp' in error_response}")
    
    # Test 2: iOS-specific error helpers
    print("\n2. Testing iOS-specific error helpers...")
    
    # Authentication errors
    auth_error = iOSErrorHelper.invalid_credentials()
    print(f"✅ Auth error: {auth_error['message']}")
    
    # Validation errors with field details
    validation_error = iOSErrorHelper.validation_failed(
        field_errors={
            "email": "Invalid email format",
            "password": "Password too short"
        }
    )
    print(f"✅ Validation error: {validation_error['message']}")
    print(f"   Field errors: {validation_error['error']['details']['field_errors']}")
    
    # Network/server errors
    server_error = iOSErrorHelper.server_error()
    print(f"✅ Server error: {server_error['message']}")

def test_error_tracking():
    """Test error tracking and logging"""
    print("\n📊 Testing Error Tracking...")
    
    from app.core.exceptions import FynloException, ErrorCodes
    import uuid
    
    # Test error ID generation
    try:
        raise FynloException(
            message="Test error for tracking",
            error_code=ErrorCodes.INTERNAL_ERROR,
            details={"test": True}
        )
    except FynloException as e:
        print(f"✅ Error ID generated: {e.error_id}")
        print(f"   Timestamp: {e.timestamp}")
        print(f"   Error code: {e.error_code}")

def main():
    """Run all error handling tests"""
    print("🚀 Fynlo POS Enhanced Error Handling Tests")
    print("=" * 60)
    
    try:
        test_exception_system()
        test_validation_system()
        test_business_logic_validation()
        test_ios_friendly_responses()
        test_error_tracking()
        
        print("\n" + "=" * 60)
        print("✅ Enhanced Error Handling Tests Completed")
        print("\nKey iOS Benefits:")
        print("📱 Consistent error response format")
        print("🔍 Field-level validation with specific error codes")
        print("🎯 User-friendly error messages")
        print("🆔 Unique error IDs for debugging")
        print("⚡ Comprehensive business logic validation")
        print("🛡️ Enhanced security with proper error handling")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running from the backend directory")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    main()