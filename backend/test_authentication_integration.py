#!/usr/bin/env python3
"""
Authentication Integration Testing for Fynlo POS
Comprehensive end-to-end testing of JWT authentication flow
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from datetime import datetime, timedelta
import httpx
import jwt as jwt_lib

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.core.config import settings
from app.core.database import SessionLocal, User
from app.api.v1.endpoints.auth import create_access_token, authenticate_user

class AuthenticationTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.test_results = []
        self.test_users = {}
        self.tokens = {}
        
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
        if data and isinstance(data, dict) and len(str(data)) < 200:
            print(f"    Data: {json.dumps(data, indent=2, default=str)}")
    
    async def test_server_connectivity(self):
        """Test basic server connectivity"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/")
                if response.status_code == 200:
                    self.log_test("Server Connectivity", True, f"Server running at {self.base_url}")
                    return True
                else:
                    self.log_test("Server Connectivity", False, f"Server returned {response.status_code}")
                    return False
        except Exception as e:
            self.log_test("Server Connectivity", False, f"Server not accessible: {e}")
            return False
    
    def test_database_users(self):
        """Test that authentication users exist in database"""
        try:
            db = SessionLocal()
            
            # Test users that should exist
            test_accounts = [
                ("admin@fynlo.com", "platform_owner"),
                ("manager@fynlo.com", "restaurant_owner"), 
                ("employee@fynlo.com", "employee")
            ]
            
            all_users_exist = True
            for email, expected_role in test_accounts:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    self.test_users[expected_role] = {
                        "email": email,
                        "password": email.split("@")[0] + "123",  # admin123, manager123, etc.
                        "role": user.role,
                        "user_id": str(user.id),
                        "restaurant_id": str(user.restaurant_id) if user.restaurant_id else None
                    }
                    self.log_test(f"Database User - {expected_role}", True, 
                                f"Found user: {email} with role: {user.role}")
                else:
                    self.log_test(f"Database User - {expected_role}", False, 
                                f"User not found: {email}")
                    all_users_exist = False
            
            db.close()
            return all_users_exist
            
        except Exception as e:
            self.log_test("Database Users Check", False, f"Database error: {e}")
            return False
    
    def test_token_generation(self):
        """Test JWT token generation functionality"""
        try:
            # Test token creation
            test_payload = {"sub": "test-user-id", "role": "employee"}
            token = create_access_token(data=test_payload)
            
            if token and len(token) > 50:
                self.log_test("Token Generation", True, f"Token created (length: {len(token)})")
                
                # Test token decoding
                try:
                    decoded = jwt_lib.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                    if decoded.get("sub") == "test-user-id":
                        self.log_test("Token Validation", True, "Token decodes correctly")
                        return True
                    else:
                        self.log_test("Token Validation", False, "Token payload incorrect")
                        return False
                except Exception as e:
                    self.log_test("Token Validation", False, f"Token decode failed: {e}")
                    return False
            else:
                self.log_test("Token Generation", False, "Token creation failed")
                return False
                
        except Exception as e:
            self.log_test("Token Generation", False, f"Token generation error: {e}")
            return False
    
    def test_password_authentication(self):
        """Test password-based authentication"""
        try:
            db = SessionLocal()
            
            # Test correct credentials
            user = authenticate_user(db, "admin@fynlo.com", "admin123")
            if user and user.email == "admin@fynlo.com":
                self.log_test("Password Authentication - Valid", True, "Correct credentials accepted")
            else:
                self.log_test("Password Authentication - Valid", False, "Valid credentials rejected")
                db.close()
                return False
            
            # Test incorrect credentials
            user = authenticate_user(db, "admin@fynlo.com", "wrongpassword")
            if user is None:
                self.log_test("Password Authentication - Invalid", True, "Invalid credentials rejected")
            else:
                self.log_test("Password Authentication - Invalid", False, "Invalid credentials accepted")
                db.close()
                return False
            
            # Test non-existent user
            user = authenticate_user(db, "nonexistent@fynlo.com", "password")
            if user is None:
                self.log_test("Password Authentication - Nonexistent", True, "Nonexistent user rejected")
            else:
                self.log_test("Password Authentication - Nonexistent", False, "Nonexistent user accepted")
                db.close()
                return False
            
            db.close()
            return True
            
        except Exception as e:
            self.log_test("Password Authentication", False, f"Authentication test error: {e}")
            return False
    
    async def test_login_endpoint(self):
        """Test the login API endpoint"""
        try:
            login_success_count = 0
            
            for role, user_data in self.test_users.items():
                login_payload = {
                    "email": user_data["email"],
                    "password": user_data["password"]
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{self.api_url}/auth/login",
                        json=login_payload
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success") and "data" in data and "access_token" in data["data"]:
                            self.tokens[role] = data["data"]["access_token"]
                            self.log_test(f"Login Endpoint - {role}", True, 
                                        f"Login successful for {user_data['email']}")
                            login_success_count += 1
                        else:
                            self.log_test(f"Login Endpoint - {role}", False, 
                                        f"Invalid response format for {user_data['email']}")
                    else:
                        error_msg = response.text
                        try:
                            error_data = response.json()
                            error_msg = error_data.get("message", error_msg)
                        except:
                            pass
                        self.log_test(f"Login Endpoint - {role}", False, 
                                    f"Login failed for {user_data['email']}: {error_msg}")
            
            return login_success_count == len(self.test_users)
            
        except Exception as e:
            self.log_test("Login Endpoint", False, f"Login endpoint error: {e}")
            return False
    
    async def test_protected_endpoints(self):
        """Test access to protected endpoints with different roles"""
        if not self.tokens:
            self.log_test("Protected Endpoints", False, "No authentication tokens available")
            return False
        
        try:
            # Test endpoints that require authentication
            protected_endpoints = [
                ("/auth/me", "GET", "all"),  # All authenticated users
                ("/users/", "GET", "admin"),  # Admin only
                ("/restaurants/", "GET", "admin"),  # Admin only
                ("/orders/", "GET", "all"),  # All authenticated users
            ]
            
            results = {}
            
            for endpoint, method, required_role in protected_endpoints:
                endpoint_results = {}
                
                for role, token in self.tokens.items():
                    headers = {"Authorization": f"Bearer {token}"}
                    
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        if method == "GET":
                            response = await client.get(f"{self.api_url}{endpoint}", headers=headers)
                        else:
                            response = await client.request(method, f"{self.api_url}{endpoint}", headers=headers)
                        
                        # Determine if access should be allowed
                        should_allow = (required_role == "all" or 
                                      role == "platform_owner" or 
                                      (required_role == "admin" and role in ["platform_owner", "restaurant_owner"]))
                        
                        if should_allow:
                            success = response.status_code in [200, 201]
                            endpoint_results[role] = "✅ ALLOWED" if success else f"❌ FAILED ({response.status_code})"
                        else:
                            success = response.status_code in [401, 403]
                            endpoint_results[role] = "✅ DENIED" if success else f"❌ ALLOWED ({response.status_code})"
                
                results[f"{method} {endpoint}"] = endpoint_results
                
                # Check if all role-based access worked correctly
                all_correct = all("✅" in result for result in endpoint_results.values())
                self.log_test(f"Protected Endpoint - {method} {endpoint}", all_correct, 
                            f"Role-based access control", endpoint_results)
            
            return all(all("✅" in result for result in endpoint_results.values()) 
                      for endpoint_results in results.values())
            
        except Exception as e:
            self.log_test("Protected Endpoints", False, f"Protected endpoint test error: {e}")
            return False
    
    async def test_token_expiration(self):
        """Test token expiration handling"""
        try:
            # Create a token with very short expiration
            short_lived_token = create_access_token(
                data={"sub": "test-user"}, 
                expires_delta=timedelta(seconds=1)
            )
            
            # Wait for token to expire
            time.sleep(2)
            
            # Try to use expired token
            headers = {"Authorization": f"Bearer {short_lived_token}"}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                
                if response.status_code == 401:
                    self.log_test("Token Expiration", True, "Expired token correctly rejected")
                    return True
                else:
                    self.log_test("Token Expiration", False, f"Expired token accepted: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("Token Expiration", False, f"Token expiration test error: {e}")
            return False
    
    async def test_logout_functionality(self):
        """Test logout functionality and token blacklisting"""
        if "employee" not in self.tokens:
            self.log_test("Logout Functionality", False, "No employee token available")
            return False
        
        try:
            token = self.tokens["employee"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Test that token works before logout
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                if response.status_code != 200:
                    self.log_test("Logout Functionality", False, "Token not working before logout test")
                    return False
                
                # Perform logout
                response = await client.post(f"{self.api_url}/auth/logout", headers=headers)
                if response.status_code == 200:
                    self.log_test("Logout Request", True, "Logout request successful")
                else:
                    self.log_test("Logout Request", False, f"Logout failed: {response.status_code}")
                    return False
                
                # Test that token is blacklisted after logout
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                if response.status_code == 401:
                    self.log_test("Token Blacklisting", True, "Token correctly blacklisted after logout")
                    return True
                else:
                    self.log_test("Token Blacklisting", False, f"Token still valid after logout: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("Logout Functionality", False, f"Logout test error: {e}")
            return False
    
    async def test_user_info_endpoint(self):
        """Test the /auth/me endpoint for user information"""
        if not self.tokens:
            self.log_test("User Info Endpoint", False, "No authentication tokens available")
            return False
        
        try:
            success_count = 0
            
            for role, token in self.tokens.items():
                headers = {"Authorization": f"Bearer {token}"}
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if (data.get("success") and "data" in data and 
                            "email" in data["data"] and "role" in data["data"]):
                            
                            user_info = data["data"]
                            expected_email = self.test_users[role]["email"]
                            
                            if user_info["email"] == expected_email:
                                self.log_test(f"User Info - {role}", True, 
                                            f"Correct user info returned for {expected_email}")
                                success_count += 1
                            else:
                                self.log_test(f"User Info - {role}", False, 
                                            f"Wrong user info: expected {expected_email}, got {user_info['email']}")
                        else:
                            self.log_test(f"User Info - {role}", False, 
                                        f"Invalid response format for {role}")
                    else:
                        self.log_test(f"User Info - {role}", False, 
                                    f"User info request failed: {response.status_code}")
            
            return success_count == len(self.tokens)
            
        except Exception as e:
            self.log_test("User Info Endpoint", False, f"User info test error: {e}")
            return False
    
    async def test_cors_headers(self):
        """Test CORS headers for frontend integration"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Test preflight request
                response = await client.options(
                    f"{self.api_url}/auth/login",
                    headers={
                        "Origin": "http://localhost:3000",
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "Content-Type"
                    }
                )
                
                cors_headers = response.headers
                has_cors = (
                    "access-control-allow-origin" in cors_headers or
                    "access-control-allow-methods" in cors_headers
                )
                
                if has_cors:
                    self.log_test("CORS Headers", True, "CORS headers present for frontend integration")
                    return True
                else:
                    self.log_test("CORS Headers", False, "CORS headers missing - may block frontend")
                    return False
                    
        except Exception as e:
            self.log_test("CORS Headers", False, f"CORS test error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all authentication integration tests"""
        print("🔐 Starting Authentication Integration Tests")
        print("=" * 55)
        
        # Basic connectivity
        server_ok = await self.test_server_connectivity()
        if not server_ok:
            print("\n❌ Server not running. Please start the backend server:")
            print("   python -m uvicorn app.main:app --reload")
            return False
        
        # Database and user setup
        users_ok = self.test_database_users()
        if not users_ok:
            print("\n⚠️ Database users missing. Please run database setup:")
            print("   python setup_database.py")
        
        # Core authentication tests
        token_ok = self.test_token_generation()
        password_ok = self.test_password_authentication()
        
        # API endpoint tests
        if users_ok:
            await self.test_login_endpoint()
            await self.test_protected_endpoints()
            await self.test_user_info_endpoint()
            await self.test_token_expiration()
            await self.test_logout_functionality()
        
        # Integration tests
        await self.test_cors_headers()
        
        # Summary
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"\n📊 Authentication Test Results")
        print("=" * 40)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if failed == 0:
            print("\n🎉 All authentication tests passed!")
            print("\n✅ Ready for frontend integration:")
            print("   - JWT token generation working")
            print("   - Role-based access control validated")
            print("   - Login/logout flow functional")
            print("   - Protected endpoints secured")
        else:
            print(f"\n⚠️ {failed} test(s) failed. Review issues above.")
        
        return failed == 0

async def main():
    """Main test runner"""
    print("Starting authentication integration tests...")
    print("Ensure backend server is running and database is set up.")
    print()
    
    tester = AuthenticationTester()
    success = await tester.run_all_tests()
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)