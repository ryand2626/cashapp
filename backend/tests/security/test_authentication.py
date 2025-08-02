"""
Authentication Security Tests
"""
import pytest
from httpx import AsyncClient
import jwt
from datetime import datetime, timedelta
import uuid
from app.main import app


@pytest.mark.asyncio
class TestAuthenticationSecurity:
    """Test authentication and authorization security"""
    
    async def test_endpoints_require_authentication(self):
        """Test that all endpoints require authentication"""
        protected_endpoints = [
            ("/api/v1/orders", "GET"),
            ("/api/v1/orders", "POST"),
            ("/api/v1/products", "GET"),
            ("/api/v1/customers", "GET"),
            ("/api/v1/employees", "GET"),
            ("/api/v1/reports/sales", "GET"),
            ("/api/v1/config", "GET"),
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for endpoint, method in protected_endpoints:
                if method == "GET":
                    response = await client.get(endpoint)
                elif method == "POST":
                    response = await client.post(endpoint, json={})
                
                # Should return 401 Unauthorized without auth
                assert response.status_code == 401
    
    async def test_invalid_token_rejected(self):
        """Test that invalid tokens are rejected"""
        invalid_tokens = [
            "invalid_token",
            "Bearer invalid_token",
            "",
            "Bearer ",
            jwt.encode({"sub": "user"}, "wrong_secret", algorithm="HS256"),
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for token in invalid_tokens:
                headers = {"Authorization": f"Bearer {token}"} if not token.startswith("Bearer") else {"Authorization": token}
                response = await client.get("/api/v1/orders", headers=headers)
                
                # Should return 401 or 403
                assert response.status_code in [401, 403]
    
    async def test_expired_token_rejected(self):
        """Test that expired tokens are rejected"""
        # Create expired token
        expired_token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "email": "test@example.com",
                "exp": datetime.utcnow() - timedelta(hours=1)  # Expired
            },
            "test_secret",
            algorithm="HS256"
        )
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/orders",
                headers={"Authorization": f"Bearer {expired_token}"}
            )
            
            # Should reject expired token
            assert response.status_code in [401, 403]
    
    async def test_role_based_access_control(self, test_db, test_restaurant):
        """Test role-based access control"""
        # Create tokens for different roles
        roles_and_permissions = [
            ("employee", "/api/v1/orders", "GET", 200),  # Can view orders
            ("employee", "/api/v1/reports/sales", "GET", 403),  # Cannot view reports
            ("manager", "/api/v1/reports/sales", "GET", 200),  # Can view reports
            ("manager", "/api/v1/config", "PUT", 200),  # Can update config
            ("employee", "/api/v1/config", "PUT", 403),  # Cannot update config
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for role, endpoint, method, expected_status in roles_and_permissions:
                token = jwt.encode(
                    {
                        "sub": str(uuid.uuid4()),
                        "email": f"{role}@example.com",
                        "role": role,
                        "restaurant_id": test_restaurant.id,
                        "exp": datetime.utcnow() + timedelta(hours=1)
                    },
                    "test_secret",
                    algorithm="HS256"
                )
                headers = {"Authorization": f"Bearer {token}"}
                
                if method == "GET":
                    response = await client.get(endpoint, headers=headers)
                elif method == "PUT":
                    response = await client.put(endpoint, json={}, headers=headers)
                
                assert response.status_code == expected_status
    
    async def test_token_tampering_detected(self):
        """Test that tampered tokens are detected"""
        # Create valid token
        valid_token = jwt.encode(
            {
                "sub": str(uuid.uuid4()),
                "email": "test@example.com",
                "role": "employee",
                "exp": datetime.utcnow() + timedelta(hours=1)
            },
            "test_secret",
            algorithm="HS256"
        )
        
        # Tamper with the token (change role claim)
        parts = valid_token.split('.')
        # Decode payload
        import base64
        import json
        
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        payload['role'] = 'platform_owner'  # Escalate privileges
        
        # Re-encode with same signature (invalid)
        tampered_payload = base64.urlsafe_b64encode(
            json.dumps(payload).encode()
        ).decode().rstrip('=')
        tampered_token = f"{parts[0]}.{tampered_payload}.{parts[2]}"
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/platform/analytics",
                headers={"Authorization": f"Bearer {tampered_token}"}
            )
            
            # Should reject tampered token
            assert response.status_code in [401, 403]
    
    async def test_auth_bypass_attempts_blocked(self):
        """Test that common auth bypass attempts are blocked"""
        bypass_attempts = [
            # Missing auth header variations
            {},
            {"Authorization": ""},
            {"Authorization": "null"},
            {"Authorization": "undefined"},
            {"Authorization": "Bearer null"},
            {"Authorization": "Bearer undefined"},
            # SQL injection in auth
            {"Authorization": "Bearer ' OR '1'='1"},
            # Header injection
            {"Authorization": "Bearer token\r\nX-Admin: true"},
        ]
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            for headers in bypass_attempts:
                response = await client.get("/api/v1/orders", headers=headers)
                
                # Should block all bypass attempts
                assert response.status_code in [401, 403, 400]