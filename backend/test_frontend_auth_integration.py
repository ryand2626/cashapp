#!/usr/bin/env python3
"""
Frontend-Backend Authentication Integration Testing for Fynlo POS
Tests authentication flow as would be used by the iOS frontend
"""

import asyncio
import json
import sys
from pathlib import Path
import httpx
from typing import Dict, Any

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

class FrontendAuthIntegrationTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.test_results = []
        self.user_sessions = {}
        
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "data": data
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if data and isinstance(data, dict) and len(str(data)) < 300:
            print(f"    Response: {json.dumps(data, indent=2, default=str)}")
    
    async def simulate_ios_login_flow(self, email: str, password: str, device_info: Dict[str, Any] = None):
        """Simulate iOS app login flow"""
        try:
            # Prepare login request as iOS would send it
            login_payload = {
                "email": email,
                "password": password
            }
            
            # Add device info if provided (future enhancement)
            if device_info:
                login_payload["device_info"] = device_info
            
            # iOS would send these headers
            headers = {
                "User-Agent": "FynloPOS/1.0 iOS/17.0",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Device-Type": "iOS",
                "X-App-Version": "1.0.0"
            }
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{self.api_url}/auth/login",
                    json=login_payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Validate response format expected by iOS
                    if self.validate_ios_login_response(data):
                        user_data = data["data"]
                        session_info = {
                            "token": user_data["access_token"],
                            "user": user_data["user"],
                            "login_time": data.get("timestamp"),
                            "expires_in": 30 * 60  # 30 minutes
                        }
                        
                        self.user_sessions[email] = session_info
                        return True, data
                    else:
                        return False, {"error": "Invalid response format"}
                else:
                    error_data = {}
                    try:
                        error_data = response.json()
                    except:
                        error_data = {"error": response.text}
                    return False, error_data
                    
        except Exception as e:
            return False, {"error": str(e)}
    
    def validate_ios_login_response(self, response_data: Dict[str, Any]) -> bool:
        """Validate that login response matches iOS expectations"""
        required_fields = {
            "success": bool,
            "data": dict,
            "message": str
        }
        
        # Check top-level structure
        for field, expected_type in required_fields.items():
            if field not in response_data:
                return False
            if not isinstance(response_data[field], expected_type):
                return False
        
        # Check data structure
        data = response_data["data"]
        required_data_fields = {
            "access_token": str,
            "token_type": str,
            "user": dict
        }
        
        for field, expected_type in required_data_fields.items():
            if field not in data:
                return False
            if not isinstance(data[field], expected_type):
                return False
        
        # Check user structure
        user = data["user"]
        required_user_fields = ["id", "email", "first_name", "last_name", "role"]
        
        for field in required_user_fields:
            if field not in user:
                return False
        
        return True
    
    async def test_ios_login_scenarios(self):
        """Test various iOS login scenarios"""
        test_cases = [
            {
                "name": "Platform Owner Login",
                "email": "admin@fynlo.com",
                "password": "admin123",
                "expected_role": "platform_owner"
            },
            {
                "name": "Restaurant Manager Login", 
                "email": "manager@fynlo.com",
                "password": "manager123",
                "expected_role": "restaurant_owner"
            },
            {
                "name": "Employee Login",
                "email": "employee@fynlo.com", 
                "password": "employee123",
                "expected_role": "employee"
            }
        ]
        
        successful_logins = 0
        
        for test_case in test_cases:
            success, response_data = await self.simulate_ios_login_flow(
                test_case["email"], 
                test_case["password"]
            )
            
            if success:
                user_role = response_data["data"]["user"]["role"]
                if user_role == test_case["expected_role"]:
                    self.log_test(f"iOS Login - {test_case['name']}", True, 
                                f"Login successful with correct role: {user_role}")
                    successful_logins += 1
                else:
                    self.log_test(f"iOS Login - {test_case['name']}", False, 
                                f"Wrong role: expected {test_case['expected_role']}, got {user_role}")
            else:
                self.log_test(f"iOS Login - {test_case['name']}", False, 
                            f"Login failed: {response_data.get('error', 'Unknown error')}")
        
        return successful_logins == len(test_cases)
    
    async def test_ios_authenticated_requests(self):
        """Test authenticated requests as iOS would make them"""
        if not self.user_sessions:
            self.log_test("iOS Authenticated Requests", False, "No active sessions available")
            return False
        
        # Test requests that iOS app would typically make
        test_endpoints = [
            {
                "method": "GET",
                "endpoint": "/auth/me",
                "name": "Get User Profile",
                "all_roles": True
            },
            {
                "method": "GET", 
                "endpoint": "/orders/today",
                "name": "Get Today's Orders",
                "all_roles": True
            },
            {
                "method": "GET",
                "endpoint": "/restaurants/",
                "name": "Get Restaurants",
                "admin_only": True
            }
        ]
        
        successful_requests = 0
        total_expected = 0
        
        for session_email, session_info in self.user_sessions.items():
            token = session_info["token"]
            user_role = session_info["user"]["role"]
            
            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": "FynloPOS/1.0 iOS/17.0",
                "Accept": "application/json",
                "X-Device-Type": "iOS"
            }
            
            for endpoint_test in test_endpoints:
                should_test = (
                    endpoint_test.get("all_roles") or
                    (endpoint_test.get("admin_only") and user_role in ["platform_owner", "restaurant_owner"])
                )
                
                if should_test:
                    total_expected += 1
                    
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            if endpoint_test["method"] == "GET":
                                response = await client.get(
                                    f"{self.api_url}{endpoint_test['endpoint']}", 
                                    headers=headers
                                )
                            else:
                                response = await client.request(
                                    endpoint_test["method"],
                                    f"{self.api_url}{endpoint_test['endpoint']}", 
                                    headers=headers
                                )
                            
                            if response.status_code in [200, 201]:
                                self.log_test(f"iOS Request - {endpoint_test['name']} ({user_role})", True,
                                            f"Request successful: {response.status_code}")
                                successful_requests += 1
                            else:
                                self.log_test(f"iOS Request - {endpoint_test['name']} ({user_role})", False,
                                            f"Request failed: {response.status_code}")
                                
                    except Exception as e:
                        self.log_test(f"iOS Request - {endpoint_test['name']} ({user_role})", False,
                                    f"Request error: {e}")
        
        return successful_requests == total_expected
    
    async def test_ios_logout_flow(self):
        """Test iOS logout flow"""
        if not self.user_sessions:
            self.log_test("iOS Logout Flow", False, "No active sessions available")
            return False
        
        # Test logout with one session
        test_email = list(self.user_sessions.keys())[0]
        session_info = self.user_sessions[test_email]
        token = session_info["token"]
        
        headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "FynloPOS/1.0 iOS/17.0",
            "Accept": "application/json"
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Perform logout
                logout_response = await client.post(f"{self.api_url}/auth/logout", headers=headers)
                
                if logout_response.status_code == 200:
                    logout_data = logout_response.json()
                    
                    # Validate logout response format
                    if logout_data.get("success"):
                        # Test that token is invalidated
                        test_response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                        
                        if test_response.status_code == 401:
                            self.log_test("iOS Logout Flow", True, 
                                        "Logout successful and token invalidated")
                            return True
                        else:
                            self.log_test("iOS Logout Flow", False, 
                                        f"Token still valid after logout: {test_response.status_code}")
                            return False
                    else:
                        self.log_test("iOS Logout Flow", False, 
                                    "Logout response format invalid")
                        return False
                else:
                    self.log_test("iOS Logout Flow", False, 
                                f"Logout failed: {logout_response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("iOS Logout Flow", False, f"Logout error: {e}")
            return False
    
    async def test_ios_error_handling(self):
        """Test error handling from iOS perspective"""
        error_scenarios = [
            {
                "name": "Invalid Credentials",
                "email": "admin@fynlo.com",
                "password": "wrong_password",
                "expected_status": 401
            },
            {
                "name": "Nonexistent User",
                "email": "nonexistent@example.com", 
                "password": "any_password",
                "expected_status": 401
            },
            {
                "name": "Malformed Email",
                "email": "not_an_email",
                "password": "password",
                "expected_status": 422
            }
        ]
        
        correct_errors = 0
        
        for scenario in error_scenarios:
            success, response_data = await self.simulate_ios_login_flow(
                scenario["email"],
                scenario["password"]
            )
            
            if not success:
                # Check if error format is iOS-friendly
                if "error" in response_data:
                    error_info = response_data["error"]
                    has_code = isinstance(error_info, dict) and "code" in error_info
                    has_message = isinstance(error_info, dict) and "message" in error_info
                    
                    if has_code and has_message:
                        self.log_test(f"iOS Error - {scenario['name']}", True,
                                    f"Error properly formatted with code and message")
                        correct_errors += 1
                    else:
                        self.log_test(f"iOS Error - {scenario['name']}", False,
                                    "Error format not iOS-friendly")
                else:
                    self.log_test(f"iOS Error - {scenario['name']}", False,
                                "Error response missing error field")
            else:
                self.log_test(f"iOS Error - {scenario['name']}", False,
                            "Expected error but login succeeded")
        
        return correct_errors == len(error_scenarios)
    
    async def test_ios_token_refresh_handling(self):
        """Test how expired tokens are handled from iOS perspective"""
        if not self.user_sessions:
            self.log_test("iOS Token Refresh", False, "No active sessions available")
            return False
        
        # Create a short-lived token for testing
        try:
            from app.api.v1.endpoints.auth import create_access_token
            from datetime import timedelta
            
            short_token = create_access_token(
                data={"sub": "test-user"},
                expires_delta=timedelta(seconds=1)
            )
            
            # Wait for expiration
            await asyncio.sleep(2)
            
            headers = {
                "Authorization": f"Bearer {short_token}",
                "User-Agent": "FynloPOS/1.0 iOS/17.0"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                
                if response.status_code == 401:
                    error_data = response.json()
                    
                    # Check if error indicates token expiration
                    if ("expired" in str(error_data).lower() or 
                        "unauthorized" in str(error_data).lower()):
                        self.log_test("iOS Token Refresh", True,
                                    "Expired token properly rejected with clear error")
                        return True
                    else:
                        self.log_test("iOS Token Refresh", False,
                                    "Token expired but error message unclear")
                        return False
                else:
                    self.log_test("iOS Token Refresh", False,
                                f"Expired token accepted: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("iOS Token Refresh", False, f"Token refresh test error: {e}")
            return False
    
    async def test_ios_cors_compatibility(self):
        """Test CORS headers for iOS WebView compatibility"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Test preflight request that iOS WebView might make
                response = await client.options(
                    f"{self.api_url}/auth/login",
                    headers={
                        "Origin": "capacitor://localhost",  # Capacitor apps use this
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "Content-Type,Authorization"
                    }
                )
                
                # Check for appropriate CORS headers
                cors_headers = response.headers
                
                allows_origin = (
                    cors_headers.get("access-control-allow-origin") == "*" or
                    "capacitor" in cors_headers.get("access-control-allow-origin", "")
                )
                
                allows_methods = "POST" in cors_headers.get("access-control-allow-methods", "")
                allows_headers = "authorization" in cors_headers.get("access-control-allow-headers", "").lower()
                
                if allows_origin and allows_methods and allows_headers:
                    self.log_test("iOS CORS Compatibility", True,
                                "CORS headers support iOS WebView integration")
                    return True
                else:
                    self.log_test("iOS CORS Compatibility", False,
                                "CORS headers may block iOS WebView requests")
                    return False
                    
        except Exception as e:
            self.log_test("iOS CORS Compatibility", False, f"CORS test error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all frontend-backend authentication integration tests"""
        print("📱 Starting Frontend-Backend Authentication Integration Tests")
        print("=" * 65)
        
        # Test iOS login flows
        login_ok = await self.test_ios_login_scenarios()
        
        if login_ok:
            # Test authenticated requests
            await self.test_ios_authenticated_requests()
            
            # Test logout flow
            await self.test_ios_logout_flow()
        
        # Test error handling
        await self.test_ios_error_handling()
        
        # Test token expiration
        await self.test_ios_token_refresh_handling()
        
        # Test CORS compatibility
        await self.test_ios_cors_compatibility()
        
        # Summary
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"\n📊 Frontend Integration Test Results")
        print("=" * 45)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if failed == 0:
            print("\n🎉 All frontend-backend integration tests passed!")
            print("\n✅ iOS App Integration Ready:")
            print("   - Authentication flow compatible")
            print("   - Response formats match iOS expectations") 
            print("   - Error handling iOS-friendly")
            print("   - Token management working")
            print("   - CORS headers configured")
        else:
            print(f"\n⚠️ {failed} test(s) failed. Check integration issues above.")
        
        return failed == 0

async def main():
    """Main integration test runner"""
    print("Starting frontend-backend authentication integration tests...")
    print("Testing authentication flow from iOS app perspective.")
    print()
    
    tester = FrontendAuthIntegrationTester()
    success = await tester.run_all_tests()
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)