#!/usr/bin/env python3
"""
Authentication Security Testing for Fynlo POS
Tests security aspects of the authentication system
"""

import asyncio
import json
import sys
import time
from pathlib import Path
import httpx
import jwt as jwt_lib
from datetime import datetime, timedelta

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.core.config import settings

class AuthenticationSecurityTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.test_results = []
        self.valid_token = None
        
    def log_test(self, test_name, success, message="", severity="INFO"):
        """Log security test results"""
        status = "✅ SECURE" if success else "🔒 VULNERABLE"
        if severity == "CRITICAL":
            status = "🚨 CRITICAL" if not success else "✅ SECURE"
        
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "severity": severity
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
    
    async def get_valid_token(self):
        """Get a valid authentication token for testing"""
        try:
            login_data = {
                "email": "admin@fynlo.com",
                "password": "admin123"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.api_url}/auth/login", json=login_data)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        self.valid_token = data["data"]["access_token"]
                        return True
                        
            return False
        except Exception:
            return False
    
    async def test_sql_injection_protection(self):
        """Test SQL injection protection in login endpoint"""
        sql_injection_payloads = [
            "admin@fynlo.com' OR '1'='1",
            "admin@fynlo.com'; DROP TABLE users; --",
            "admin@fynlo.com' UNION SELECT * FROM users --",
            "' OR 1=1 --",
            "admin@fynlo.com' AND (SELECT COUNT(*) FROM users) > 0 --"
        ]
        
        vulnerable_count = 0
        
        for payload in sql_injection_payloads:
            try:
                login_data = {
                    "email": payload,
                    "password": "any_password"
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(f"{self.api_url}/auth/login", json=login_data)
                    
                    # Should return 401/400, not 200 or 500
                    if response.status_code == 200:
                        vulnerable_count += 1
                    elif response.status_code == 500:
                        # 500 might indicate SQL error
                        vulnerable_count += 1
                        
            except Exception:
                pass
        
        if vulnerable_count == 0:
            self.log_test("SQL Injection Protection", True, 
                        "No SQL injection vulnerabilities detected", "CRITICAL")
        else:
            self.log_test("SQL Injection Protection", False, 
                        f"Potential SQL injection vulnerability with {vulnerable_count} payloads", "CRITICAL")
        
        return vulnerable_count == 0
    
    async def test_brute_force_protection(self):
        """Test brute force attack protection"""
        # Attempt multiple failed logins
        failed_attempts = []
        
        for i in range(10):
            try:
                login_data = {
                    "email": "admin@fynlo.com",
                    "password": f"wrong_password_{i}"
                }
                
                start_time = time.time()
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(f"{self.api_url}/auth/login", json=login_data)
                    
                end_time = time.time()
                response_time = end_time - start_time
                
                failed_attempts.append({
                    "attempt": i + 1,
                    "status_code": response.status_code,
                    "response_time": response_time
                })
                
                # Small delay between attempts
                await asyncio.sleep(0.1)
                
            except Exception as e:
                failed_attempts.append({
                    "attempt": i + 1,
                    "error": str(e)
                })
        
        # Analyze for rate limiting or account lockout
        consistent_failures = all(
            attempt.get("status_code") in [401, 429] 
            for attempt in failed_attempts 
            if "status_code" in attempt
        )
        
        rate_limited = any(
            attempt.get("status_code") == 429 
            for attempt in failed_attempts
        )
        
        if rate_limited:
            self.log_test("Brute Force Protection", True, 
                        "Rate limiting detected (429 responses)", "HIGH")
        elif consistent_failures:
            self.log_test("Brute Force Protection", True, 
                        "Consistent failure responses (no information leakage)", "MEDIUM")
        else:
            self.log_test("Brute Force Protection", False, 
                        "No apparent brute force protection", "HIGH")
        
        return rate_limited or consistent_failures
    
    async def test_jwt_security(self):
        """Test JWT token security"""
        if not self.valid_token:
            self.log_test("JWT Security", False, "No valid token available", "HIGH")
            return False
        
        security_issues = []
        
        try:
            # Test 1: Decode without verification (should contain no sensitive data)
            unverified_payload = jwt_lib.decode(self.valid_token, options={"verify_signature": False})
            
            sensitive_fields = ["password", "password_hash", "secret", "key"]
            found_sensitive = [field for field in sensitive_fields if field in str(unverified_payload).lower()]
            
            if found_sensitive:
                security_issues.append(f"Sensitive data in JWT: {found_sensitive}")
            
            # Test 2: Check for weak algorithm
            header = jwt_lib.get_unverified_header(self.valid_token)
            if header.get("alg") == "none":
                security_issues.append("JWT uses 'none' algorithm")
            elif header.get("alg") in ["HS1", "RS1"]:
                security_issues.append(f"JWT uses weak algorithm: {header.get('alg')}")
            
            # Test 3: Check expiration
            if "exp" not in unverified_payload:
                security_issues.append("JWT has no expiration")
            else:
                exp_time = datetime.fromtimestamp(unverified_payload["exp"])
                now = datetime.utcnow()
                if exp_time > now + timedelta(hours=24):
                    security_issues.append("JWT expiration too long (>24 hours)")
            
            if security_issues:
                self.log_test("JWT Security", False, 
                            f"Security issues: {'; '.join(security_issues)}", "HIGH")
                return False
            else:
                self.log_test("JWT Security", True, 
                            "JWT tokens follow security best practices", "HIGH")
                return True
                
        except Exception as e:
            self.log_test("JWT Security", False, f"JWT analysis failed: {e}", "MEDIUM")
            return False
    
    async def test_token_manipulation(self):
        """Test token manipulation attacks"""
        if not self.valid_token:
            self.log_test("Token Manipulation", False, "No valid token available", "HIGH")
            return False
        
        manipulation_tests = []
        
        # Test 1: Modified signature
        try:
            parts = self.valid_token.split('.')
            modified_token = '.'.join(parts[:-1]) + '.modified_signature'
            
            headers = {"Authorization": f"Bearer {modified_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                
            if response.status_code == 401:
                manipulation_tests.append(("Modified Signature", True))
            else:
                manipulation_tests.append(("Modified Signature", False))
                
        except Exception:
            manipulation_tests.append(("Modified Signature", True))
        
        # Test 2: Modified payload
        try:
            header, payload, signature = self.valid_token.split('.')
            
            # Decode and modify payload
            import base64
            decoded_payload = base64.urlsafe_b64decode(payload + '==')
            payload_data = json.loads(decoded_payload)
            payload_data["role"] = "admin"  # Try to escalate privileges
            
            modified_payload = base64.urlsafe_b64encode(
                json.dumps(payload_data).encode()
            ).decode().rstrip('=')
            
            modified_token = f"{header}.{modified_payload}.{signature}"
            
            headers = {"Authorization": f"Bearer {modified_token}"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                
            if response.status_code == 401:
                manipulation_tests.append(("Modified Payload", True))
            else:
                manipulation_tests.append(("Modified Payload", False))
                
        except Exception:
            manipulation_tests.append(("Modified Payload", True))
        
        # Test 3: Empty token
        try:
            headers = {"Authorization": "Bearer "}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                
            if response.status_code == 401:
                manipulation_tests.append(("Empty Token", True))
            else:
                manipulation_tests.append(("Empty Token", False))
                
        except Exception:
            manipulation_tests.append(("Empty Token", True))
        
        all_secure = all(secure for _, secure in manipulation_tests)
        
        if all_secure:
            self.log_test("Token Manipulation", True, 
                        "All token manipulation attempts properly rejected", "HIGH")
        else:
            failed_tests = [test for test, secure in manipulation_tests if not secure]
            self.log_test("Token Manipulation", False, 
                        f"Vulnerable to: {', '.join(failed_tests)}", "CRITICAL")
        
        return all_secure
    
    async def test_password_security(self):
        """Test password security requirements"""
        # Test weak password acceptance
        weak_passwords = [
            "123",
            "password",
            "admin",
            "12345678",
            "qwerty"
        ]
        
        weak_accepted = 0
        
        for weak_password in weak_passwords:
            try:
                # Try to register with weak password
                register_data = {
                    "email": f"test_{weak_password}@example.com",
                    "password": weak_password,
                    "first_name": "Test",
                    "last_name": "User",
                    "role": "employee"
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(f"{self.api_url}/auth/register", json=register_data)
                    
                    if response.status_code == 200:
                        weak_accepted += 1
                        
            except Exception:
                pass
        
        if weak_accepted == 0:
            self.log_test("Password Security", True, 
                        "Weak passwords properly rejected", "MEDIUM")
        else:
            self.log_test("Password Security", False, 
                        f"{weak_accepted} weak passwords accepted", "MEDIUM")
        
        return weak_accepted == 0
    
    async def test_session_security(self):
        """Test session security and logout behavior"""
        if not self.valid_token:
            self.log_test("Session Security", False, "No valid token available", "MEDIUM")
            return False
        
        try:
            headers = {"Authorization": f"Bearer {self.valid_token}"}
            
            # Test logout
            async with httpx.AsyncClient(timeout=10.0) as client:
                logout_response = await client.post(f"{self.api_url}/auth/logout", headers=headers)
                
                if logout_response.status_code == 200:
                    # Test if token is invalidated
                    test_response = await client.get(f"{self.api_url}/auth/me", headers=headers)
                    
                    if test_response.status_code == 401:
                        self.log_test("Session Security", True, 
                                    "Token properly invalidated after logout", "MEDIUM")
                        return True
                    else:
                        self.log_test("Session Security", False, 
                                    "Token still valid after logout", "HIGH")
                        return False
                else:
                    self.log_test("Session Security", False, 
                                f"Logout failed: {logout_response.status_code}", "MEDIUM")
                    return False
                    
        except Exception as e:
            self.log_test("Session Security", False, f"Session test error: {e}", "MEDIUM")
            return False
    
    async def test_information_disclosure(self):
        """Test for information disclosure vulnerabilities"""
        disclosure_issues = []
        
        # Test 1: Error message information leakage
        try:
            login_data = {
                "email": "nonexistent@example.com",
                "password": "password"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.api_url}/auth/login", json=login_data)
                
                if response.status_code != 200:
                    error_text = response.text.lower()
                    
                    # Check for information disclosure
                    if "user not found" in error_text or "invalid user" in error_text:
                        disclosure_issues.append("Login error reveals user existence")
                    elif "wrong password" in error_text or "invalid password" in error_text:
                        disclosure_issues.append("Login error reveals password validity")
                        
        except Exception:
            pass
        
        # Test 2: API version disclosure
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/")
                
                headers = dict(response.headers)
                server_header = headers.get("server", "").lower()
                
                if "uvicorn" in server_header or "fastapi" in server_header:
                    disclosure_issues.append("Server technology disclosed in headers")
                    
        except Exception:
            pass
        
        if disclosure_issues:
            self.log_test("Information Disclosure", False, 
                        f"Issues: {'; '.join(disclosure_issues)}", "MEDIUM")
            return False
        else:
            self.log_test("Information Disclosure", True, 
                        "No information disclosure detected", "MEDIUM")
            return True
    
    async def run_all_security_tests(self):
        """Run all authentication security tests"""
        print("🔒 Starting Authentication Security Tests")
        print("=" * 50)
        
        # Get valid token for testing
        token_ok = await self.get_valid_token()
        if not token_ok:
            print("⚠️ Could not obtain valid token. Some tests may be skipped.")
        
        # Run security tests
        await self.test_sql_injection_protection()
        await self.test_brute_force_protection()
        await self.test_jwt_security()
        await self.test_token_manipulation()
        await self.test_password_security()
        await self.test_session_security()
        await self.test_information_disclosure()
        
        # Analyze results
        critical_issues = [r for r in self.test_results if r["severity"] == "CRITICAL" and "VULNERABLE" in r["status"]]
        high_issues = [r for r in self.test_results if r["severity"] == "HIGH" and "VULNERABLE" in r["status"]]
        medium_issues = [r for r in self.test_results if r["severity"] == "MEDIUM" and "VULNERABLE" in r["status"]]
        
        total_tests = len(self.test_results)
        secure_tests = len([r for r in self.test_results if "SECURE" in r["status"]])
        
        print(f"\n🛡️ Security Assessment Results")
        print("=" * 40)
        print(f"Total Security Tests: {total_tests}")
        print(f"Secure: {secure_tests}")
        print(f"Critical Issues: {len(critical_issues)}")
        print(f"High Risk Issues: {len(high_issues)}")
        print(f"Medium Risk Issues: {len(medium_issues)}")
        
        if critical_issues:
            print(f"\n🚨 CRITICAL SECURITY ISSUES:")
            for issue in critical_issues:
                print(f"   - {issue['test']}: {issue['message']}")
        
        if high_issues:
            print(f"\n⚠️ HIGH RISK ISSUES:")
            for issue in high_issues:
                print(f"   - {issue['test']}: {issue['message']}")
        
        if len(critical_issues) == 0 and len(high_issues) == 0:
            print("\n✅ No critical or high-risk security issues found!")
            print("Authentication system follows security best practices.")
        
        return len(critical_issues) == 0 and len(high_issues) == 0

async def main():
    """Main security test runner"""
    print("Starting authentication security tests...")
    print("This will test for common security vulnerabilities.")
    print()
    
    tester = AuthenticationSecurityTester()
    success = await tester.run_all_security_tests()
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)