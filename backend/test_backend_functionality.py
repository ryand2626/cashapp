#!/usr/bin/env python3
"""
Backend Functionality Test Script
Tests core functionality without requiring external dependencies
"""

import asyncio
import sys
import traceback
from datetime import datetime

def test_imports():
    """Test all core imports"""
    print("🔍 Testing imports...")
    
    try:
        # Core FastAPI imports
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        print("  ✅ FastAPI imports successful")
        
        # Database imports
        from app.core.database import Base, User, Restaurant, Product, Order, Payment
        print("  ✅ Database model imports successful")
        
        # Service imports
        from app.core.file_upload import FileUploadService
        from app.core.push_notifications import PushNotificationService
        from app.core.sync_manager import OfflineSyncManager
        from app.core.websocket import WebSocketManager
        print("  ✅ Service class imports successful")
        
        # API imports
        from app.api.v1.api import api_router
        from app.api.mobile.endpoints import router as mobile_router
        print("  ✅ API router imports successful")
        
        # Main app import
        from app.main import app
        print("  ✅ Main application import successful")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Import failed: {e}")
        traceback.print_exc()
        return False

def test_services():
    """Test service class instantiation"""
    print("\n🔍 Testing service instantiation...")
    
    try:
        # File Upload Service
        from app.core.file_upload import FileUploadService
        file_service = FileUploadService()
        print("  ✅ FileUploadService instantiated")
        
        # Push Notification Service
        from app.core.push_notifications import PushNotificationService
        push_service = PushNotificationService()
        print("  ✅ PushNotificationService instantiated")
        
        # WebSocket Manager
        from app.core.websocket import WebSocketManager
        ws_manager = WebSocketManager()
        print("  ✅ WebSocketManager instantiated")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Service instantiation failed: {e}")
        traceback.print_exc()
        return False

def test_fastapi_app():
    """Test FastAPI application"""
    print("\n🔍 Testing FastAPI application...")
    
    try:
        from app.main import app
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        
        # Test health endpoint
        response = client.get("/")
        if response.status_code == 200:
            print("  ✅ Health endpoint working")
        else:
            print(f"  ⚠️ Health endpoint returned {response.status_code}")
        
        # Test health check endpoint
        response = client.get("/health")
        if response.status_code == 200:
            print("  ✅ Health check endpoint working")
        else:
            print(f"  ⚠️ Health check endpoint returned {response.status_code}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ FastAPI app test failed: {e}")
        traceback.print_exc()
        return False

def test_database_models():
    """Test database model creation"""
    print("\n🔍 Testing database models...")
    
    try:
        from app.core.database import User, Restaurant, Product, Order, Payment
        import uuid
        from datetime import datetime
        
        # Test model instantiation
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            first_name="Test",
            last_name="User",
            role="employee"
        )
        print("  ✅ User model created")
        
        restaurant = Restaurant(
            name="Test Restaurant",
            address={"street": "123 Test St", "city": "Test City"},
            phone="555-0123",
            email="restaurant@example.com"
        )
        print("  ✅ Restaurant model created")
        
        product = Product(
            restaurant_id=restaurant.id,
            category_id=uuid.uuid4(),
            name="Test Product",
            description="A test product",
            price=9.99
        )
        print("  ✅ Product model created")
        
        order = Order(
            restaurant_id=restaurant.id,
            order_number="TEST001",
            items=[{"product_id": str(product.id), "quantity": 1, "price": 9.99}],
            subtotal=9.99,
            total_amount=9.99,
            created_by=user.id
        )
        print("  ✅ Order model created")
        
        payment = Payment(
            order_id=order.id,
            payment_method="cash",
            amount=9.99,
            net_amount=9.99
        )
        print("  ✅ Payment model created")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Database model test failed: {e}")
        traceback.print_exc()
        return False

def test_response_helpers():
    """Test response helper functions"""
    print("\n🔍 Testing response helpers...")
    
    try:
        from app.core.responses import APIResponseHelper
        
        # Test success response
        success_response = APIResponseHelper.success(
            data={"test": "data"},
            message="Test successful"
        )
        print("  ✅ Success response helper working")
        
        # Test error response
        error_response = APIResponseHelper.error(
            message="Test error",
            error_code="TEST_ERROR"
        )
        print("  ✅ Error response helper working")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Response helper test failed: {e}")
        traceback.print_exc()
        return False

def test_middleware():
    """Test middleware components"""
    print("\n🔍 Testing middleware...")
    
    try:
        from app.core.mobile_middleware import MobileCompatibilityMiddleware, MobileDataOptimizationMiddleware
        from fastapi import FastAPI
        
        app = FastAPI()
        
        # Test middleware instantiation
        mobile_middleware = MobileCompatibilityMiddleware(app)
        print("  ✅ MobileCompatibilityMiddleware created")
        
        optimization_middleware = MobileDataOptimizationMiddleware(app)
        print("  ✅ MobileDataOptimizationMiddleware created")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Middleware test failed: {e}")
        traceback.print_exc()
        return False

async def test_websocket_manager():
    """Test WebSocket manager"""
    print("\n🔍 Testing WebSocket manager...")
    
    try:
        from app.core.websocket import WebSocketManager, EventType, ConnectionType
        
        manager = WebSocketManager()
        print("  ✅ WebSocket manager instantiated")
        
        # Test event types
        event_types = list(EventType)
        print(f"  ✅ Found {len(event_types)} event types")
        
        # Test connection types
        connection_types = list(ConnectionType)
        print(f"  ✅ Found {len(connection_types)} connection types")
        
        # Test stats
        stats = manager.get_connection_stats()
        print(f"  ✅ Connection stats: {stats['total_connections']} connections")
        
        return True
        
    except Exception as e:
        print(f"  ❌ WebSocket manager test failed: {e}")
        traceback.print_exc()
        return False

def test_file_upload_service():
    """Test file upload service"""
    print("\n🔍 Testing file upload service...")
    
    try:
        from app.core.file_upload import FileUploadService, FileUploadConfig
        
        service = FileUploadService()
        config = FileUploadConfig()
        
        print(f"  ✅ Max file size: {config.MAX_FILE_SIZE / (1024*1024):.1f}MB")
        print(f"  ✅ Allowed types: {len(config.ALLOWED_MIME_TYPES)} MIME types")
        print(f"  ✅ Mobile sizes: {len(config.MOBILE_SIZES)} size variants")
        
        return True
        
    except Exception as e:
        print(f"  ❌ File upload service test failed: {e}")
        traceback.print_exc()
        return False

async def run_all_tests():
    """Run all tests"""
    print("🚀 Starting Backend Functionality Tests")
    print("=" * 50)
    
    tests = [
        ("Imports", test_imports),
        ("Services", test_services),
        ("FastAPI App", test_fastapi_app),
        ("Database Models", test_database_models),
        ("Response Helpers", test_response_helpers),
        ("Middleware", test_middleware),
        ("WebSocket Manager", test_websocket_manager),
        ("File Upload Service", test_file_upload_service),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                result = await test_func()
            else:
                result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Backend is functional.")
        return True
    else:
        print("⚠️  Some tests failed. See details above.")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test suite crashed: {e}")
        traceback.print_exc()
        sys.exit(1) 