"""Test Helpers and Utilities for FastAPI Testing

This module provides reusable test utilities, factories, and helpers
for achieving 100% test coverage across the Fynlo backend.
"""

from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timedelta
from decimal import Decimal
import json
import random
import string
from unittest.mock import Mock, AsyncMock, MagicMock
import asyncio
from contextlib import asynccontextmanager

from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
import httpx
import redis

from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.models.menu_item import MenuItem
from app.core.security import create_access_token


# ============================================================================
# TEST DATA FACTORIES
# ============================================================================

class TestDataFactory:
    """Factory for creating test data with realistic values"""
    
    @staticmethod
    def create_user(
        db: Session,
        user_id: Optional[int] = None,
        email: Optional[str] = None,
        role: str = "employee",
        restaurant_id: Optional[int] = None,
        **kwargs
    ) -> User:
        """Create a test user with defaults"""
        user = User(
            id=user_id or random.randint(1000, 9999),
            email=email or f"user{random.randint(1000, 9999)}@test.com",
            username=kwargs.get("username", f"user{random.randint(1000, 9999)}"),
            hashed_password="$2b$12$test",  # Pre-hashed "password"
            role=role,
            restaurant_id=restaurant_id,
            is_active=kwargs.get("is_active", True),
            created_at=kwargs.get("created_at", datetime.utcnow())
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def create_restaurant(
        db: Session,
        restaurant_id: Optional[int] = None,
        name: Optional[str] = None,
        **kwargs
    ) -> Restaurant:
        """Create a test restaurant with defaults"""
        restaurant = Restaurant(
            id=restaurant_id or random.randint(1000, 9999),
            name=name or f"Restaurant {random.randint(1000, 9999)}",
            phone=kwargs.get("phone", "1234567890"),
            email=kwargs.get("email", f"rest{random.randint(1000, 9999)}@test.com"),
            address=kwargs.get("address", "123 Test Street"),
            vat_number=kwargs.get("vat_number", "VAT123456"),
            subscription_plan=kwargs.get("subscription_plan", "beta"),
            is_active=kwargs.get("is_active", True),
            settings=kwargs.get("settings", {
                "vat_rate": 21,
                "service_charge": 10,
                "currency": "EUR"
            })
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        return restaurant
    
    @staticmethod
    def create_menu_item(
        db: Session,
        restaurant_id: int,
        item_id: Optional[int] = None,
        **kwargs
    ) -> MenuItem:
        """Create a test menu item"""
        item = MenuItem(
            id=item_id or random.randint(1000, 9999),
            restaurant_id=restaurant_id,
            name=kwargs.get("name", f"Item {random.randint(1000, 9999)}"),
            description=kwargs.get("description", "Test description"),
            price=kwargs.get("price", Decimal("9.99")),
            category=kwargs.get("category", "main"),
            is_available=kwargs.get("is_available", True),
            image_url=kwargs.get("image_url", None),
            allergens=kwargs.get("allergens", []),
            nutritional_info=kwargs.get("nutritional_info", {})
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    
    @staticmethod
    def create_order(
        db: Session,
        restaurant_id: int,
        user_id: int,
        order_id: Optional[int] = None,
        **kwargs
    ) -> Order:
        """Create a test order"""
        items = kwargs.get("items", [
            {"id": 1, "quantity": 2, "price": Decimal("9.99")}
        ])
        
        subtotal = sum(
            Decimal(str(item["price"])) * item["quantity"] 
            for item in items
        )
        
        order = Order(
            id=order_id or random.randint(10000, 99999),
            restaurant_id=restaurant_id,
            user_id=user_id,
            order_number=kwargs.get("order_number", f"ORD-{random.randint(1000, 9999)}"),
            status=kwargs.get("status", "pending"),
            payment_status=kwargs.get("payment_status", "pending"),
            payment_method=kwargs.get("payment_method", "cash"),
            items=items,
            subtotal=subtotal,
            vat_amount=kwargs.get("vat_amount", subtotal * Decimal("0.21")),
            service_charge=kwargs.get("service_charge", subtotal * Decimal("0.10")),
            total_amount=kwargs.get("total_amount", subtotal * Decimal("1.31")),
            notes=kwargs.get("notes", None),
            created_at=kwargs.get("created_at", datetime.utcnow())
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    
    @staticmethod
    def create_bulk_test_data(db: Session, restaurant_id: int, count: int = 10):
        """Create bulk test data for performance testing"""
        users = []
        menu_items = []
        orders = []
        
        # Create users
        for i in range(count):
            user = TestDataFactory.create_user(
                db,
                email=f"bulk_user_{i}@test.com",
                restaurant_id=restaurant_id
            )
            users.append(user)
        
        # Create menu items
        categories = ["starters", "mains", "desserts", "drinks"]
        for i in range(count * 2):  # More menu items
            item = TestDataFactory.create_menu_item(
                db,
                restaurant_id=restaurant_id,
                name=f"Bulk Item {i}",
                category=random.choice(categories),
                price=Decimal(str(random.uniform(5, 50)))
            )
            menu_items.append(item)
        
        # Create orders
        for i in range(count * 5):  # More orders
            order = TestDataFactory.create_order(
                db,
                restaurant_id=restaurant_id,
                user_id=random.choice(users).id,
                items=[{
                    "id": random.choice(menu_items).id,
                    "quantity": random.randint(1, 5),
                    "price": random.choice(menu_items).price
                } for _ in range(random.randint(1, 5))]
            )
            orders.append(order)
        
        return {
            "users": users,
            "menu_items": menu_items,
            "orders": orders
        }


# ============================================================================
# MOCK BUILDERS
# ============================================================================

class MockBuilder:
    """Builder for creating complex mocks with realistic behavior"""
    
    @staticmethod
    def build_redis_mock(behavior: Dict[str, Any] = None) -> MagicMock:
        """Build a Redis mock with customizable behavior"""
        mock = MagicMock()
        behavior = behavior or {}
        
        # Default behaviors
        storage = behavior.get("storage", {})
        connection_error = behavior.get("connection_error", False)
        latency = behavior.get("latency", 0)
        
        async def async_operation(func):
            """Add latency to async operations"""
            async def wrapper(*args, **kwargs):
                if latency:
                    await asyncio.sleep(latency)
                if connection_error:
                    raise redis.ConnectionError("Redis connection failed")
                return func(*args, **kwargs)
            return wrapper
        
        # Mock methods
        mock.get = AsyncMock(side_effect=async_operation(lambda k: storage.get(k)))
        mock.set = AsyncMock(side_effect=async_operation(
            lambda k, v, **kw: storage.update({k: v}) or True
        ))
        mock.delete = AsyncMock(side_effect=async_operation(
            lambda k: storage.pop(k, None) is not None
        ))
        mock.exists = AsyncMock(side_effect=async_operation(lambda k: k in storage))
        mock.incr = AsyncMock(side_effect=async_operation(
            lambda k: storage.update({k: storage.get(k, 0) + 1}) or storage[k]
        ))
        mock.expire = AsyncMock(return_value=True)
        mock.ttl = AsyncMock(return_value=3600)
        mock.ping = AsyncMock(return_value=True)
        mock.close = AsyncMock()
        
        # Pipeline mock
        pipeline = MagicMock()
        pipeline.set = Mock(return_value=pipeline)
        pipeline.expire = Mock(return_value=pipeline)
        pipeline.execute = AsyncMock(return_value=[True] * 10)
        mock.pipeline = Mock(return_value=pipeline)
        
        return mock
    
    @staticmethod
    def build_httpx_mock(responses: List[Dict[str, Any]] = None) -> AsyncMock:
        """Build an httpx client mock with predefined responses"""
        mock = AsyncMock()
        responses = responses or [{"status_code": 200, "json": {"success": True}}]
        
        # Response iterator
        response_iter = iter(responses)
        
        def get_next_response():
            try:
                resp_data = next(response_iter)
            except StopIteration:
                resp_data = responses[-1]  # Repeat last response
            
            response = Mock()
            response.status_code = resp_data.get("status_code", 200)
            response.json = Mock(return_value=resp_data.get("json", {}))
            response.text = resp_data.get("text", "")
            response.headers = resp_data.get("headers", {})
            response.raise_for_status = Mock()
            
            if resp_data.get("exception"):
                raise resp_data["exception"]
            
            return response
        
        mock.get = AsyncMock(side_effect=lambda *args, **kwargs: get_next_response())
        mock.post = AsyncMock(side_effect=lambda *args, **kwargs: get_next_response())
        mock.put = AsyncMock(side_effect=lambda *args, **kwargs: get_next_response())
        mock.delete = AsyncMock(side_effect=lambda *args, **kwargs: get_next_response())
        mock.aclose = AsyncMock()
        
        return mock
    
    @staticmethod
    def build_websocket_mock(messages: List[Dict[str, Any]] = None) -> Mock:
        """Build a WebSocket mock with message queue"""
        mock = Mock()
        messages = messages or []
        message_queue = asyncio.Queue()
        
        # Populate queue
        for msg in messages:
            message_queue.put_nowait(msg)
        
        async def receive_json():
            return await message_queue.get()
        
        async def send_json(data):
            # Echo back for testing
            await message_queue.put(data)
        
        mock.receive_json = receive_json
        mock.send_json = send_json
        mock.close = AsyncMock()
        
        return mock


# ============================================================================
# ASSERTION HELPERS
# ============================================================================

class AssertionHelpers:
    """Helper methods for complex assertions"""
    
    @staticmethod
    def assert_decimal_equal(actual: Decimal, expected: Decimal, places: int = 2):
        """Assert decimal values are equal to specified decimal places"""
        assert round(actual, places) == round(expected, places), \
            f"Expected {expected} but got {actual}"
    
    @staticmethod
    def assert_datetime_recent(dt: datetime, max_age_seconds: int = 60):
        """Assert datetime is recent (within max_age_seconds)"""
        age = (datetime.utcnow() - dt).total_seconds()
        assert age <= max_age_seconds, \
            f"Datetime {dt} is {age}s old, expected less than {max_age_seconds}s"
    
    @staticmethod
    def assert_json_structure(data: Dict[str, Any], expected_structure: Dict[str, type]):
        """Assert JSON data matches expected structure"""
        for key, expected_type in expected_structure.items():
            assert key in data, f"Missing key: {key}"
            assert isinstance(data[key], expected_type), \
                f"Key {key} has type {type(data[key])}, expected {expected_type}"
    
    @staticmethod
    def assert_error_response(response, status_code: int, error_substring: str):
        """Assert error response format"""
        assert response.status_code == status_code
        assert "detail" in response.json()
        assert error_substring.lower() in response.json()["detail"].lower()
    
    @staticmethod
    def assert_pagination_response(response, expected_items: int, total: int):
        """Assert paginated response format"""
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data
        assert len(data["items"]) == expected_items
        assert data["total"] == total


# ============================================================================
# CONTEXT MANAGERS
# ============================================================================

@asynccontextmanager
async def temporary_settings(redis_client, restaurant_id: int, settings: Dict[str, Any]):
    """Temporarily override restaurant settings"""
    original = {}
    
    # Save original settings
    for key, value in settings.items():
        original[key] = await redis_client.hget(f"restaurant:{restaurant_id}:settings", key)
        await redis_client.hset(f"restaurant:{restaurant_id}:settings", key, str(value))
    
    try:
        yield
    finally:
        # Restore original settings
        for key, value in original.items():
            if value is None:
                await redis_client.hdel(f"restaurant:{restaurant_id}:settings", key)
            else:
                await redis_client.hset(f"restaurant:{restaurant_id}:settings", key, value)


@asynccontextmanager
async def mock_external_service(service_name: str, mock_response: Any):
    """Mock external service calls"""
    with patch(f"app.services.{service_name}") as mock:
        mock.return_value = mock_response
        yield mock


# ============================================================================
# PERFORMANCE TEST HELPERS
# ============================================================================

class PerformanceTestHelper:
    """Helpers for performance testing"""
    
    @staticmethod
    def measure_response_time(func: Callable, iterations: int = 100) -> Dict[str, float]:
        """Measure response time statistics"""
        import time
        import statistics
        
        times = []
        for _ in range(iterations):
            start = time.time()
            func()
            end = time.time()
            times.append(end - start)
        
        return {
            "min": min(times),
            "max": max(times),
            "mean": statistics.mean(times),
            "median": statistics.median(times),
            "stdev": statistics.stdev(times) if len(times) > 1 else 0,
            "p95": sorted(times)[int(len(times) * 0.95)],
            "p99": sorted(times)[int(len(times) * 0.99)],
        }
    
    @staticmethod
    async def simulate_concurrent_load(
        async_func: Callable,
        concurrent_users: int = 10,
        requests_per_user: int = 10
    ) -> Dict[str, Any]:
        """Simulate concurrent load and return metrics"""
        results = []
        errors = []
        
        async def user_session(user_id: int):
            session_results = []
            for i in range(requests_per_user):
                try:
                    start = asyncio.get_event_loop().time()
                    result = await async_func(user_id=user_id, request_id=i)
                    end = asyncio.get_event_loop().time()
                    session_results.append({
                        "user_id": user_id,
                        "request_id": i,
                        "duration": end - start,
                        "success": True,
                        "result": result
                    })
                except Exception as e:
                    errors.append({
                        "user_id": user_id,
                        "request_id": i,
                        "error": str(e)
                    })
                    session_results.append({
                        "user_id": user_id,
                        "request_id": i,
                        "duration": 0,
                        "success": False,
                        "error": str(e)
                    })
            return session_results
        
        # Run concurrent sessions
        tasks = [user_session(i) for i in range(concurrent_users)]
        all_results = await asyncio.gather(*tasks)
        
        # Flatten results
        for session_results in all_results:
            results.extend(session_results)
        
        # Calculate metrics
        successful_requests = [r for r in results if r["success"]]
        durations = [r["duration"] for r in successful_requests]
        
        return {
            "total_requests": len(results),
            "successful_requests": len(successful_requests),
            "failed_requests": len(errors),
            "error_rate": len(errors) / len(results) if results else 0,
            "avg_response_time": sum(durations) / len(durations) if durations else 0,
            "min_response_time": min(durations) if durations else 0,
            "max_response_time": max(durations) if durations else 0,
            "requests_per_second": len(results) / sum(durations) if durations else 0,
            "errors": errors[:10]  # First 10 errors
        }


# ============================================================================
# SECURITY TEST HELPERS
# ============================================================================

class SecurityTestHelper:
    """Helpers for security testing"""
    
    # Common attack payloads
    SQL_INJECTION_PAYLOADS = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "1'; DELETE FROM orders WHERE '1'='1",
        "admin'--",
        "1' UNION SELECT * FROM users--",
        "1) OR 1=1--",
        "' OR 'x'='x",
    ]
    
    XSS_PAYLOADS = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src='javascript:alert(1)'></iframe>",
        "<input onfocus=alert('XSS') autofocus>",
        "<select onfocus=alert('XSS') autofocus>",
    ]
    
    PATH_TRAVERSAL_PAYLOADS = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc%252fpasswd",
    ]
    
    @staticmethod
    def generate_jwt_attack_tokens() -> List[str]:
        """Generate various malformed JWT tokens for testing"""
        return [
            # No signature
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.",
            # None algorithm
            "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0.",
            # Expired token
            create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1)),
            # Wrong signature
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.wrong_signature",
            # Malformed payload
            "not.a.jwt",
            # Empty token
            "",
            # SQL injection in payload
            create_access_token({"sub": "1'; DROP TABLE users; --"}),
        ]
    
    @staticmethod
    def test_input_sanitization(
        test_client: TestClient,
        endpoint: str,
        method: str,
        auth_headers: Dict[str, str],
        field_name: str,
        payloads: List[str]
    ) -> List[Dict[str, Any]]:
        """Test input sanitization against various payloads"""
        results = []
        
        for payload in payloads:
            if method.upper() == "GET":
                response = test_client.get(
                    f"{endpoint}?{field_name}={payload}",
                    headers=auth_headers
                )
            elif method.upper() == "POST":
                response = test_client.post(
                    endpoint,
                    headers=auth_headers,
                    json={field_name: payload}
                )
            elif method.upper() == "PUT":
                response = test_client.put(
                    endpoint,
                    headers=auth_headers,
                    json={field_name: payload}
                )
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            results.append({
                "payload": payload,
                "status_code": response.status_code,
                "response": response.json() if response.status_code != 204 else None,
                "safe": response.status_code in [200, 201, 400, 422]  # Expected codes
            })
        
        return results


# ============================================================================
# TEST SCENARIO BUILDERS
# ============================================================================

class TestScenarioBuilder:
    """Build complex test scenarios"""
    
    @staticmethod
    async def build_restaurant_with_full_data(
        db: Session,
        redis_client,
        user_count: int = 5,
        menu_item_count: int = 20,
        order_count: int = 50
    ) -> Dict[str, Any]:
        """Build a complete restaurant with all related data"""
        # Create restaurant
        restaurant = TestDataFactory.create_restaurant(db, name="Full Test Restaurant")
        
        # Create users with different roles
        users = {
            "owner": TestDataFactory.create_user(
                db, role="restaurant_owner", restaurant_id=restaurant.id
            ),
            "manager": TestDataFactory.create_user(
                db, role="manager", restaurant_id=restaurant.id
            ),
            "employees": [
                TestDataFactory.create_user(
                    db, role="employee", restaurant_id=restaurant.id
                ) for _ in range(user_count - 2)
            ]
        }
        
        # Create menu items
        menu_items = []
        categories = ["starters", "mains", "desserts", "drinks"]
        for i in range(menu_item_count):
            item = TestDataFactory.create_menu_item(
                db,
                restaurant_id=restaurant.id,
                name=f"Item {i+1}",
                category=categories[i % len(categories)],
                price=Decimal(str(5 + (i * 2.5)))
            )
            menu_items.append(item)
            
            # Cache menu item
            await redis_client.set(
                f"menu_item:{item.id}",
                json.dumps({
                    "id": item.id,
                    "name": item.name,
                    "price": str(item.price),
                    "category": item.category
                }),
                ex=3600
            )
        
        # Create orders
        orders = []
        for i in range(order_count):
            order = TestDataFactory.create_order(
                db,
                restaurant_id=restaurant.id,
                user_id=random.choice(users["employees"]).id,
                items=[{
                    "id": random.choice(menu_items).id,
                    "quantity": random.randint(1, 3),
                    "price": random.choice(menu_items).price
                } for _ in range(random.randint(1, 5))],
                status=random.choice(["pending", "preparing", "ready", "completed"]),
                payment_status=random.choice(["pending", "paid"])
            )
            orders.append(order)
        
        # Set restaurant settings in Redis
        await redis_client.hset(
            f"restaurant:{restaurant.id}:settings",
            mapping={
                "vat_rate": "21",
                "service_charge": "10",
                "currency": "EUR",
                "timezone": "Europe/Amsterdam"
            }
        )
        
        return {
            "restaurant": restaurant,
            "users": users,
            "menu_items": menu_items,
            "orders": orders
        }


# ============================================================================
# COVERAGE UTILITIES
# ============================================================================

def get_uncovered_lines(module_path: str) -> List[int]:
    """Get list of uncovered lines for a module"""
    import coverage
    cov = coverage.Coverage()
    cov.load()
    
    analysis = cov.analysis2(module_path)
    if analysis:
        _, _, _, missing_lines, _ = analysis
        return missing_lines
    return []


def generate_test_for_uncovered_code(module_path: str, function_name: str) -> str:
    """Generate test suggestions for uncovered code"""
    uncovered = get_uncovered_lines(module_path)
    
    if not uncovered:
        return f"# All lines in {function_name} are covered!"
    
    return f"""
# Test suggestion for {function_name}
# Uncovered lines: {uncovered}

def test_{function_name}_edge_cases():
    # TODO: Add tests for uncovered lines
    # Consider testing:
    # - Error conditions
    # - Boundary values
    # - Null/empty inputs
    # - Concurrent access
    # - Permission edge cases
    pass
"""