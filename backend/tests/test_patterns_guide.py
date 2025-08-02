"""Comprehensive Testing Patterns for FastAPI Backend

This guide provides patterns for achieving 100% test coverage across all components:
1. FastAPI endpoints with authentication
2. Redis-based services with mocking
3. External API clients with circuit breakers
4. Async background tasks
5. WebSocket connections
6. Exception handlers and error cases
7. Security tests (auth bypass, injection, etc)
8. Performance tests for monitoring endpoints
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta
from decimal import Decimal
import json
import time
from typing import Dict, Any, Optional, List
import redis
from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
import httpx
from circuitbreaker import CircuitBreaker

# Import your app components
from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token, verify_token
from app.core.redis_client import get_redis_client
from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.order import Order
from app.services.redis_service import RedisService
from app.services.external_api import ExternalAPIClient
from app.services.background_tasks import process_order_async
from app.websocket.manager import ConnectionManager

# ============================================================================
# PYTEST FIXTURES AND CONFIGURATION
# ============================================================================

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh database for each test"""
    SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Override the get_db dependency
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield TestingSessionLocal()
    
    # Clean up
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def test_client(test_db):
    """Create a test client with database"""
    return TestClient(app)


@pytest.fixture
def mock_redis():
    """Mock Redis client with all common operations"""
    mock = MagicMock()
    
    # Storage for mocking Redis behavior
    storage = {}
    expiry = {}
    
    # Mock get operation
    async def mock_get(key):
        if key in expiry and time.time() > expiry[key]:
            del storage[key]
            del expiry[key]
        return storage.get(key)
    
    # Mock set operation
    async def mock_set(key, value, ex=None):
        storage[key] = value
        if ex:
            expiry[key] = time.time() + ex
        return True
    
    # Mock delete operation
    async def mock_delete(key):
        if key in storage:
            del storage[key]
            if key in expiry:
                del expiry[key]
        return True
    
    # Mock exists operation
    async def mock_exists(key):
        return key in storage
    
    # Mock expire operation
    async def mock_expire(key, seconds):
        if key in storage:
            expiry[key] = time.time() + seconds
            return True
        return False
    
    # Mock hset/hget operations
    hash_storage = {}
    
    async def mock_hset(name, key, value):
        if name not in hash_storage:
            hash_storage[name] = {}
        hash_storage[name][key] = value
        return 1
    
    async def mock_hget(name, key):
        return hash_storage.get(name, {}).get(key)
    
    async def mock_hgetall(name):
        return hash_storage.get(name, {})
    
    # Mock list operations
    list_storage = {}
    
    async def mock_lpush(key, *values):
        if key not in list_storage:
            list_storage[key] = []
        list_storage[key] = list(values) + list_storage[key]
        return len(list_storage[key])
    
    async def mock_lrange(key, start, stop):
        if key not in list_storage:
            return []
        return list_storage[key][start:stop+1] if stop >= 0 else list_storage[key][start:]
    
    # Assign mock methods
    mock.get = AsyncMock(side_effect=mock_get)
    mock.set = AsyncMock(side_effect=mock_set)
    mock.delete = AsyncMock(side_effect=mock_delete)
    mock.exists = AsyncMock(side_effect=mock_exists)
    mock.expire = AsyncMock(side_effect=mock_expire)
    mock.hset = AsyncMock(side_effect=mock_hset)
    mock.hget = AsyncMock(side_effect=mock_hget)
    mock.hgetall = AsyncMock(side_effect=mock_hgetall)
    mock.lpush = AsyncMock(side_effect=mock_lpush)
    mock.lrange = AsyncMock(side_effect=mock_lrange)
    mock.ping = AsyncMock(return_value=True)
    mock.close = AsyncMock()
    
    # Mock pipeline
    pipeline_mock = MagicMock()
    pipeline_mock.set = Mock(return_value=pipeline_mock)
    pipeline_mock.expire = Mock(return_value=pipeline_mock)
    pipeline_mock.execute = AsyncMock(return_value=[True, True])
    mock.pipeline = Mock(return_value=pipeline_mock)
    
    return mock


@pytest.fixture
def auth_headers(test_db):
    """Create authenticated headers for different user roles"""
    def _create_headers(user_id: int, role: str, restaurant_id: Optional[int] = None):
        token_data = {
            "sub": str(user_id),
            "role": role,
            "restaurant_id": restaurant_id
        }
        token = create_access_token(data=token_data)
        return {"Authorization": f"Bearer {token}"}
    
    return _create_headers


@pytest.fixture
def sample_user(test_db):
    """Create a sample user"""
    user = User(
        id=1,
        email="test@example.com",
        username="testuser",
        hashed_password="$2b$12$test",
        role="employee",
        restaurant_id=1,
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    return user


@pytest.fixture
def sample_restaurant(test_db):
    """Create a sample restaurant"""
    restaurant = Restaurant(
        id=1,
        name="Test Restaurant",
        phone="1234567890",
        email="restaurant@test.com",
        address="123 Test St",
        is_active=True,
        subscription_plan="beta"
    )
    test_db.add(restaurant)
    test_db.commit()
    return restaurant


# ============================================================================
# 1. FASTAPI ENDPOINTS WITH AUTHENTICATION
# ============================================================================

class TestAuthenticatedEndpoints:
    """Patterns for testing authenticated endpoints with role-based access"""
    
    def test_endpoint_without_auth(self, test_client):
        """Test unauthorized access"""
        response = test_client.get("/api/v1/users/me")
        assert response.status_code == 401
        assert "Not authenticated" in response.json()["detail"]
    
    def test_endpoint_with_invalid_token(self, test_client):
        """Test with invalid token"""
        headers = {"Authorization": "Bearer invalid_token"}
        response = test_client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == 401
        assert "Could not validate credentials" in response.json()["detail"]
    
    def test_endpoint_with_expired_token(self, test_client):
        """Test with expired token"""
        # Create token that expires immediately
        expired_token = create_access_token(
            data={"sub": "1", "role": "employee"}, 
            expires_delta=timedelta(seconds=-1)
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = test_client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == 401
    
    def test_endpoint_with_valid_auth(self, test_client, auth_headers, sample_user):
        """Test with valid authentication"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        response = test_client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["email"] == sample_user.email
    
    def test_role_based_access_denied(self, test_client, auth_headers):
        """Test role-based access control - denied"""
        # Employee trying to access admin endpoint
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        response = test_client.get("/api/v1/admin/users", headers=headers)
        assert response.status_code == 403
        assert "Not enough permissions" in response.json()["detail"]
    
    def test_role_based_access_allowed(self, test_client, auth_headers):
        """Test role-based access control - allowed"""
        # Platform owner accessing admin endpoint
        headers = auth_headers(user_id=1, role="platform_owner")
        response = test_client.get("/api/v1/admin/users", headers=headers)
        assert response.status_code == 200
    
    def test_multi_tenant_isolation(self, test_client, auth_headers, test_db):
        """Test that users can only access their restaurant's data"""
        # Create two restaurants
        restaurant1 = Restaurant(id=1, name="Restaurant 1")
        restaurant2 = Restaurant(id=2, name="Restaurant 2")
        test_db.add_all([restaurant1, restaurant2])
        test_db.commit()
        
        # User from restaurant 1 trying to access restaurant 2 data
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        response = test_client.get("/api/v1/restaurants/2/orders", headers=headers)
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
    
    @pytest.mark.parametrize("role,expected_status", [
        ("platform_owner", 200),
        ("restaurant_owner", 200),
        ("manager", 200),
        ("employee", 403),
    ])
    def test_hierarchical_permissions(self, test_client, auth_headers, role, expected_status):
        """Test different role permissions"""
        headers = auth_headers(user_id=1, role=role, restaurant_id=1)
        response = test_client.post("/api/v1/menu/items", headers=headers, json={
            "name": "Test Item",
            "price": 10.99
        })
        assert response.status_code == expected_status


# ============================================================================
# 2. REDIS-BASED SERVICES WITH MOCKING
# ============================================================================

class TestRedisServices:
    """Patterns for testing Redis-based services with comprehensive mocking"""
    
    @pytest.mark.asyncio
    async def test_redis_cache_hit(self, mock_redis):
        """Test cache hit scenario"""
        # Setup
        redis_service = RedisService(mock_redis)
        await mock_redis.set("user:1", json.dumps({"id": 1, "name": "Test User"}))
        
        # Test
        result = await redis_service.get_user(1)
        assert result["id"] == 1
        assert result["name"] == "Test User"
        mock_redis.get.assert_called_once_with("user:1")
    
    @pytest.mark.asyncio
    async def test_redis_cache_miss(self, mock_redis, test_db):
        """Test cache miss with database fallback"""
        redis_service = RedisService(mock_redis)
        
        # Simulate cache miss
        mock_redis.get.return_value = None
        
        # Mock database query
        with patch('app.services.redis_service.get_user_from_db') as mock_db:
            mock_db.return_value = {"id": 1, "name": "DB User"}
            
            result = await redis_service.get_user(1)
            
            # Verify fallback to DB
            assert result["id"] == 1
            assert result["name"] == "DB User"
            mock_db.assert_called_once_with(1)
            
            # Verify cache was updated
            mock_redis.set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_redis_connection_failure(self, mock_redis):
        """Test Redis connection failure with graceful degradation"""
        redis_service = RedisService(mock_redis)
        
        # Simulate Redis connection failure
        mock_redis.get.side_effect = redis.ConnectionError("Connection failed")
        
        # Should fallback to DB without crashing
        with patch('app.services.redis_service.get_user_from_db') as mock_db:
            mock_db.return_value = {"id": 1, "name": "Fallback User"}
            
            result = await redis_service.get_user(1)
            assert result["id"] == 1
            mock_db.assert_called_once_with(1)
    
    @pytest.mark.asyncio
    async def test_redis_ttl_expiration(self, mock_redis):
        """Test TTL expiration behavior"""
        redis_service = RedisService(mock_redis)
        
        # Set with TTL
        await redis_service.cache_user({"id": 1, "name": "Test"}, ttl=60)
        
        # Verify set was called with expiration
        mock_redis.set.assert_called_with(
            "user:1",
            json.dumps({"id": 1, "name": "Test"}),
            ex=60
        )
    
    @pytest.mark.asyncio
    async def test_redis_pipeline_operations(self, mock_redis):
        """Test Redis pipeline for batch operations"""
        redis_service = RedisService(mock_redis)
        
        # Perform batch operation
        await redis_service.cache_multiple_users([
            {"id": 1, "name": "User 1"},
            {"id": 2, "name": "User 2"}
        ])
        
        # Verify pipeline was used
        mock_redis.pipeline.assert_called_once()
        pipeline = mock_redis.pipeline.return_value
        assert pipeline.set.call_count == 2
        pipeline.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_redis_atomic_operations(self, mock_redis):
        """Test atomic operations like increment"""
        redis_service = RedisService(mock_redis)
        
        # Mock atomic increment
        mock_redis.incr = AsyncMock(return_value=5)
        
        count = await redis_service.increment_order_count(restaurant_id=1)
        assert count == 5
        mock_redis.incr.assert_called_once_with("restaurant:1:order_count")
    
    @pytest.mark.asyncio
    async def test_redis_list_operations(self, mock_redis):
        """Test Redis list operations for queues"""
        redis_service = RedisService(mock_redis)
        
        # Add to queue
        await redis_service.add_to_order_queue({"order_id": 123})
        mock_redis.lpush.assert_called_once()
        
        # Get from queue
        await redis_service.get_pending_orders(limit=10)
        mock_redis.lrange.assert_called_with("order_queue", 0, 9)
    
    @pytest.mark.asyncio
    async def test_redis_hash_operations(self, mock_redis):
        """Test Redis hash operations for structured data"""
        redis_service = RedisService(mock_redis)
        
        # Store restaurant settings
        await redis_service.update_restaurant_settings(1, {
            "vat_rate": "21",
            "service_charge": "10"
        })
        
        # Verify hash operations
        assert mock_redis.hset.call_count == 2
        mock_redis.hset.assert_any_call("restaurant:1:settings", "vat_rate", "21")
        mock_redis.hset.assert_any_call("restaurant:1:settings", "service_charge", "10")


# ============================================================================
# 3. EXTERNAL API CLIENTS WITH CIRCUIT BREAKERS
# ============================================================================

class TestExternalAPIClients:
    """Patterns for testing external API clients with circuit breakers"""
    
    @pytest.fixture
    def mock_httpx_client(self):
        """Mock httpx client for external API calls"""
        mock = AsyncMock()
        mock.get = AsyncMock()
        mock.post = AsyncMock()
        mock.put = AsyncMock()
        mock.delete = AsyncMock()
        mock.aclose = AsyncMock()
        return mock
    
    @pytest.mark.asyncio
    async def test_successful_api_call(self, mock_httpx_client):
        """Test successful external API call"""
        # Setup
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json = Mock(return_value={"status": "success"})
        mock_httpx_client.get.return_value = mock_response
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        # Test
        result = await client.get_payment_status("payment_123")
        assert result["status"] == "success"
        mock_httpx_client.get.assert_called_once_with(
            "https://api.payment.com/v1/payments/payment_123",
            headers=ANY,
            timeout=30
        )
    
    @pytest.mark.asyncio
    async def test_api_timeout(self, mock_httpx_client):
        """Test API timeout handling"""
        mock_httpx_client.get.side_effect = httpx.TimeoutException("Request timeout")
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        with pytest.raises(HTTPException) as exc_info:
            await client.get_payment_status("payment_123")
        
        assert exc_info.value.status_code == 504
        assert "Gateway timeout" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_open(self, mock_httpx_client):
        """Test circuit breaker opening after failures"""
        # Simulate multiple failures to open circuit
        mock_httpx_client.get.side_effect = httpx.NetworkError("Connection failed")
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        # Make requests until circuit opens (default 5 failures)
        for i in range(5):
            try:
                await client.get_payment_status(f"payment_{i}")
            except HTTPException:
                pass
        
        # Circuit should be open now
        with pytest.raises(HTTPException) as exc_info:
            await client.get_payment_status("payment_6")
        
        assert exc_info.value.status_code == 503
        assert "Circuit breaker is open" in str(exc_info.value.detail)
        
        # Should not make actual HTTP call when circuit is open
        assert mock_httpx_client.get.call_count == 5  # Not 6
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open(self, mock_httpx_client, monkeypatch):
        """Test circuit breaker half-open state"""
        # Mock time to control circuit breaker recovery
        mock_time = Mock()
        current_time = time.time()
        mock_time.time.side_effect = [
            current_time,  # Initial time
            current_time + 61,  # After recovery timeout (60s)
        ]
        monkeypatch.setattr("time.time", mock_time.time)
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        # Open circuit
        mock_httpx_client.get.side_effect = httpx.NetworkError("Failed")
        for _ in range(5):
            try:
                await client.get_payment_status("test")
            except:
                pass
        
        # Wait for recovery timeout and try again (half-open state)
        mock_response = Mock(status_code=200, json=Mock(return_value={"status": "ok"}))
        mock_httpx_client.get.side_effect = None
        mock_httpx_client.get.return_value = mock_response
        
        result = await client.get_payment_status("test_recovery")
        assert result["status"] == "ok"  # Circuit recovered
    
    @pytest.mark.asyncio
    async def test_retry_logic(self, mock_httpx_client):
        """Test retry logic for transient failures"""
        # First two calls fail, third succeeds
        mock_response = Mock(status_code=200, json=Mock(return_value={"status": "ok"}))
        mock_httpx_client.get.side_effect = [
            httpx.NetworkError("Temporary failure"),
            httpx.NetworkError("Temporary failure"),
            mock_response
        ]
        
        client = ExternalAPIClient(http_client=mock_httpx_client, max_retries=3)
        
        result = await client.get_payment_status("payment_123")
        assert result["status"] == "ok"
        assert mock_httpx_client.get.call_count == 3
    
    @pytest.mark.asyncio
    async def test_api_rate_limiting(self, mock_httpx_client):
        """Test handling of rate limit responses"""
        # Simulate 429 Too Many Requests
        mock_response = Mock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "5"}
        mock_httpx_client.get.return_value = mock_response
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        with pytest.raises(HTTPException) as exc_info:
            await client.get_payment_status("payment_123")
        
        assert exc_info.value.status_code == 429
        assert "Rate limit exceeded" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_api_authentication_refresh(self, mock_httpx_client):
        """Test automatic token refresh on 401"""
        # First call returns 401, then successful after token refresh
        unauthorized_response = Mock(status_code=401)
        success_response = Mock(status_code=200, json=Mock(return_value={"data": "ok"}))
        mock_httpx_client.get.side_effect = [unauthorized_response, success_response]
        
        # Mock token refresh
        mock_httpx_client.post.return_value = Mock(
            status_code=200,
            json=Mock(return_value={"access_token": "new_token"})
        )
        
        client = ExternalAPIClient(http_client=mock_httpx_client)
        
        result = await client.get_payment_status("payment_123")
        assert result["data"] == "ok"
        
        # Verify token refresh was called
        mock_httpx_client.post.assert_called_once()  # Token refresh
        assert mock_httpx_client.get.call_count == 2  # Original + retry


# ============================================================================
# 4. ASYNC BACKGROUND TASKS
# ============================================================================

class TestAsyncBackgroundTasks:
    """Patterns for testing async background tasks"""
    
    @pytest.mark.asyncio
    async def test_background_task_success(self, test_db, mock_redis):
        """Test successful background task execution"""
        # Create test order
        order = Order(id=1, status="pending", total_amount=Decimal("50.00"))
        test_db.add(order)
        test_db.commit()
        
        # Mock external services
        with patch('app.services.email_service.send_order_confirmation') as mock_email:
            mock_email.return_value = asyncio.create_task(asyncio.sleep(0))
            
            # Execute background task
            await process_order_async(order_id=1, db=test_db, redis=mock_redis)
            
            # Verify order was processed
            test_db.refresh(order)
            assert order.status == "confirmed"
            
            # Verify email was sent
            mock_email.assert_called_once()
            
            # Verify Redis cache was updated
            mock_redis.set.assert_called_with(
                f"order:1:status",
                "confirmed",
                ex=3600
            )
    
    @pytest.mark.asyncio
    async def test_background_task_with_exception(self, test_db, mock_redis, caplog):
        """Test background task exception handling"""
        # Create test order
        order = Order(id=1, status="pending")
        test_db.add(order)
        test_db.commit()
        
        # Mock service to raise exception
        with patch('app.services.payment_service.process_payment') as mock_payment:
            mock_payment.side_effect = Exception("Payment gateway error")
            
            # Task should not raise exception but log it
            await process_order_async(order_id=1, db=test_db, redis=mock_redis)
            
            # Verify order status
            test_db.refresh(order)
            assert order.status == "failed"
            
            # Verify error was logged
            assert "Payment gateway error" in caplog.text
    
    @pytest.mark.asyncio
    async def test_concurrent_background_tasks(self, test_db, mock_redis):
        """Test multiple concurrent background tasks"""
        # Create multiple orders
        orders = []
        for i in range(5):
            order = Order(id=i+1, status="pending", total_amount=Decimal(str(10 * (i+1))))
            orders.append(order)
        test_db.add_all(orders)
        test_db.commit()
        
        # Process all orders concurrently
        tasks = [
            process_order_async(order_id=i+1, db=test_db, redis=mock_redis)
            for i in range(5)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Verify all orders were processed
        for i, order in enumerate(orders):
            test_db.refresh(order)
            assert order.status == "confirmed"
            assert results[i] is None  # No exceptions
    
    @pytest.mark.asyncio
    async def test_background_task_timeout(self, test_db, mock_redis):
        """Test background task with timeout"""
        async def slow_operation():
            await asyncio.sleep(10)  # Simulate slow operation
        
        with patch('app.services.external_service.slow_api_call', slow_operation):
            # Task should timeout after 5 seconds
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(
                    process_order_async(order_id=1, db=test_db, redis=mock_redis),
                    timeout=5
                )
    
    @pytest.mark.asyncio
    async def test_background_task_cancellation(self, test_db, mock_redis):
        """Test background task cancellation"""
        # Create a task that can be cancelled
        task = asyncio.create_task(
            process_order_async(order_id=1, db=test_db, redis=mock_redis)
        )
        
        # Cancel after short delay
        await asyncio.sleep(0.1)
        task.cancel()
        
        # Verify task was cancelled
        with pytest.raises(asyncio.CancelledError):
            await task
    
    @pytest.mark.asyncio
    async def test_background_task_queue(self, mock_redis):
        """Test task queue processing"""
        # Add tasks to queue
        await mock_redis.lpush("task_queue", json.dumps({
            "type": "process_order",
            "order_id": 1
        }))
        await mock_redis.lpush("task_queue", json.dumps({
            "type": "send_notification",
            "user_id": 2
        }))
        
        # Process queue
        from app.workers.task_processor import process_task_queue
        
        with patch('app.workers.task_processor.process_order') as mock_process:
            with patch('app.workers.task_processor.send_notification') as mock_notify:
                await process_task_queue(redis=mock_redis, batch_size=2)
                
                mock_process.assert_called_once_with(order_id=1)
                mock_notify.assert_called_once_with(user_id=2)


# ============================================================================
# 5. WEBSOCKET CONNECTIONS
# ============================================================================

class TestWebSocketConnections:
    """Patterns for testing WebSocket connections"""
    
    @pytest.fixture
    def websocket_client(self, test_client):
        """Create WebSocket test client"""
        return test_client
    
    def test_websocket_connection_success(self, websocket_client, auth_headers):
        """Test successful WebSocket connection"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        with websocket_client.websocket_connect(
            "/ws/orders?token=" + headers["Authorization"].split()[1]
        ) as websocket:
            # Send test message
            websocket.send_json({"type": "ping"})
            
            # Receive response
            data = websocket.receive_json()
            assert data["type"] == "pong"
    
    def test_websocket_authentication_required(self, websocket_client):
        """Test WebSocket requires authentication"""
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with websocket_client.websocket_connect("/ws/orders"):
                pass
        
        assert exc_info.value.code == 1008  # Policy Violation
        assert "Authentication required" in exc_info.value.reason
    
    def test_websocket_invalid_token(self, websocket_client):
        """Test WebSocket with invalid token"""
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with websocket_client.websocket_connect("/ws/orders?token=invalid_token"):
                pass
        
        assert exc_info.value.code == 1008
        assert "Invalid authentication" in exc_info.value.reason
    
    def test_websocket_message_broadcast(self, websocket_client, auth_headers):
        """Test message broadcasting to multiple connections"""
        # Create two connections for same restaurant
        headers1 = auth_headers(user_id=1, role="employee", restaurant_id=1)
        headers2 = auth_headers(user_id=2, role="manager", restaurant_id=1)
        
        with websocket_client.websocket_connect(
            f"/ws/orders?token={headers1['Authorization'].split()[1]}"
        ) as ws1:
            with websocket_client.websocket_connect(
                f"/ws/orders?token={headers2['Authorization'].split()[1]}"
            ) as ws2:
                # Simulate order update
                ws1.send_json({
                    "type": "order_update",
                    "order_id": 123,
                    "status": "ready"
                })
                
                # Both connections should receive the update
                data1 = ws1.receive_json()
                data2 = ws2.receive_json()
                
                assert data1["type"] == "order_update"
                assert data1["order_id"] == 123
                assert data2 == data1  # Same message
    
    def test_websocket_restaurant_isolation(self, websocket_client, auth_headers):
        """Test WebSocket messages are isolated by restaurant"""
        # Create connections for different restaurants
        headers1 = auth_headers(user_id=1, role="employee", restaurant_id=1)
        headers2 = auth_headers(user_id=2, role="employee", restaurant_id=2)
        
        with websocket_client.websocket_connect(
            f"/ws/orders?token={headers1['Authorization'].split()[1]}"
        ) as ws1:
            with websocket_client.websocket_connect(
                f"/ws/orders?token={headers2['Authorization'].split()[1]}"
            ) as ws2:
                # Send message from restaurant 1
                ws1.send_json({
                    "type": "order_update",
                    "order_id": 123,
                    "restaurant_id": 1
                })
                
                # Only ws1 should receive it
                data1 = ws1.receive_json()
                assert data1["order_id"] == 123
                
                # ws2 should not receive anything (timeout)
                with pytest.raises(WebSocketDisconnect):
                    ws2.receive_json(timeout=0.1)
    
    def test_websocket_error_handling(self, websocket_client, auth_headers):
        """Test WebSocket error handling"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        with websocket_client.websocket_connect(
            f"/ws/orders?token={headers['Authorization'].split()[1]}"
        ) as websocket:
            # Send invalid message
            websocket.send_json({"invalid": "message"})
            
            # Should receive error response
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert "Invalid message format" in data["message"]
    
    def test_websocket_connection_limit(self, websocket_client, auth_headers):
        """Test WebSocket connection limits per user"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        token = headers['Authorization'].split()[1]
        
        # Create multiple connections (assuming limit is 3)
        connections = []
        for i in range(3):
            ws = websocket_client.websocket_connect(f"/ws/orders?token={token}").__enter__()
            connections.append(ws)
        
        # Fourth connection should be rejected
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with websocket_client.websocket_connect(f"/ws/orders?token={token}"):
                pass
        
        assert "Connection limit exceeded" in exc_info.value.reason
        
        # Clean up
        for ws in connections:
            ws.__exit__(None, None, None)
    
    @pytest.mark.asyncio
    async def test_websocket_heartbeat(self, websocket_client, auth_headers):
        """Test WebSocket heartbeat/keepalive"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        with websocket_client.websocket_connect(
            f"/ws/orders?token={headers['Authorization'].split()[1]}"
        ) as websocket:
            # Wait for heartbeat
            await asyncio.sleep(1.5)  # Assuming 1s heartbeat interval
            
            # Should receive heartbeat
            data = websocket.receive_json()
            assert data["type"] == "heartbeat"
            assert "timestamp" in data


# ============================================================================
# 6. EXCEPTION HANDLERS AND ERROR CASES
# ============================================================================

class TestExceptionHandlers:
    """Patterns for testing exception handlers and error cases"""
    
    def test_validation_error_handler(self, test_client):
        """Test validation error response format"""
        response = test_client.post("/api/v1/orders", json={
            "invalid_field": "value"  # Missing required fields
        })
        
        assert response.status_code == 422
        error = response.json()
        assert error["detail"][0]["type"] == "missing"
        assert "field required" in error["detail"][0]["msg"]
    
    def test_database_error_handler(self, test_client, monkeypatch):
        """Test database error handling"""
        # Mock database error
        def mock_db_error(*args, **kwargs):
            raise Exception("Database connection lost")
        
        monkeypatch.setattr("app.core.database.get_db", mock_db_error)
        
        response = test_client.get("/api/v1/restaurants")
        assert response.status_code == 500
        assert "Internal server error" in response.json()["detail"]
    
    def test_custom_exception_handler(self, test_client):
        """Test custom FynloException handling"""
        with patch('app.api.endpoints.orders.create_order') as mock_create:
            mock_create.side_effect = FynloException(
                "Insufficient inventory",
                status_code=400,
                error_code="INSUFFICIENT_INVENTORY"
            )
            
            response = test_client.post("/api/v1/orders", json={
                "items": [{"id": 1, "quantity": 100}]
            })
            
            assert response.status_code == 400
            error = response.json()
            assert error["detail"] == "Insufficient inventory"
            assert error["error_code"] == "INSUFFICIENT_INVENTORY"
    
    def test_unhandled_exception_logging(self, test_client, caplog):
        """Test unhandled exceptions are logged"""
        with patch('app.api.endpoints.health.check_health') as mock_health:
            mock_health.side_effect = RuntimeError("Unexpected error")
            
            response = test_client.get("/api/v1/health")
            
            assert response.status_code == 500
            assert "Unexpected error" in caplog.text
            assert "RuntimeError" in caplog.text
    
    @pytest.mark.parametrize("exception,expected_status,expected_message", [
        (ValueError("Invalid value"), 400, "Bad request"),
        (PermissionError("Access denied"), 403, "Forbidden"),
        (FileNotFoundError("Not found"), 404, "Resource not found"),
        (TimeoutError("Timeout"), 504, "Gateway timeout"),
    ])
    def test_exception_mapping(self, test_client, exception, expected_status, expected_message):
        """Test exception to HTTP status mapping"""
        with patch('app.api.endpoints.test.test_endpoint') as mock_endpoint:
            mock_endpoint.side_effect = exception
            
            response = test_client.get("/api/v1/test")
            assert response.status_code == expected_status
            assert expected_message in response.json()["detail"]
    
    def test_exception_with_rollback(self, test_client, test_db):
        """Test database rollback on exception"""
        # Start with empty database
        assert test_db.query(Order).count() == 0
        
        with patch('app.services.payment_service.process_payment') as mock_payment:
            # Payment fails after order created
            mock_payment.side_effect = Exception("Payment failed")
            
            response = test_client.post("/api/v1/orders", json={
                "items": [{"id": 1, "quantity": 1}],
                "payment_method": "card"
            })
            
            assert response.status_code == 500
            
            # Verify order was rolled back
            assert test_db.query(Order).count() == 0
    
    def test_concurrent_request_error_handling(self, test_client):
        """Test error handling under concurrent requests"""
        import threading
        results = []
        
        def make_request():
            try:
                response = test_client.get("/api/v1/orders/999999")  # Non-existent
                results.append(response.status_code)
            except Exception as e:
                results.append(str(e))
        
        # Make 10 concurrent requests
        threads = []
        for _ in range(10):
            t = threading.Thread(target=make_request)
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        # All should return 404
        assert all(r == 404 for r in results)
    
    def test_graceful_degradation(self, test_client, mock_redis):
        """Test graceful degradation when services fail"""
        # Redis fails but app continues
        mock_redis.get.side_effect = redis.ConnectionError("Redis down")
        
        response = test_client.get("/api/v1/menu")
        
        # Should still return data from database
        assert response.status_code == 200
        assert "items" in response.json()


# ============================================================================
# 7. SECURITY TESTS
# ============================================================================

class TestSecurity:
    """Patterns for security testing - auth bypass, injection, etc."""
    
    def test_sql_injection_prevention(self, test_client, auth_headers):
        """Test SQL injection prevention"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        # Try SQL injection in search parameter
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "1; DELETE FROM orders WHERE 1=1; --",
            "' UNION SELECT * FROM users --"
        ]
        
        for payload in malicious_inputs:
            response = test_client.get(
                f"/api/v1/menu/search?q={payload}",
                headers=headers
            )
            
            # Should handle safely without error
            assert response.status_code in [200, 400]
            
            # Verify tables still exist
            with test_client as client:
                db_check = client.get("/api/v1/health/db")
                assert db_check.status_code == 200
    
    def test_xss_prevention(self, test_client, auth_headers):
        """Test XSS prevention in user inputs"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<iframe src='javascript:alert(1)'></iframe>"
        ]
        
        for payload in xss_payloads:
            response = test_client.post(
                "/api/v1/menu/items",
                headers=headers,
                json={"name": payload, "price": 10.00}
            )
            
            if response.status_code == 201:
                # Verify stored value is escaped
                item_id = response.json()["id"]
                get_response = test_client.get(f"/api/v1/menu/items/{item_id}")
                stored_name = get_response.json()["name"]
                
                # Should be escaped or sanitized
                assert "<script>" not in stored_name or stored_name != payload
    
    def test_auth_bypass_attempts(self, test_client):
        """Test various authentication bypass attempts"""
        bypass_attempts = [
            # Missing auth header
            {},
            # Malformed tokens
            {"Authorization": "Bearer"},
            {"Authorization": "Bearer null"},
            {"Authorization": "Bearer undefined"},
            {"Authorization": "Bearer {}"},
            # Wrong auth scheme
            {"Authorization": "Basic dGVzdDp0ZXN0"},
            # JWT manipulation
            {"Authorization": "Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIn0."},
        ]
        
        for headers in bypass_attempts:
            response = test_client.get("/api/v1/users/me", headers=headers)
            assert response.status_code == 401, f"Auth bypass with headers: {headers}"
    
    def test_privilege_escalation(self, test_client, auth_headers, test_db):
        """Test privilege escalation prevention"""
        # Create employee user
        employee_headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        # Try to access admin endpoints
        admin_endpoints = [
            ("/api/v1/admin/users", "GET"),
            ("/api/v1/admin/restaurants", "GET"),
            ("/api/v1/users/1/role", "PUT"),
            ("/api/v1/restaurants/1/settings", "PUT"),
        ]
        
        for endpoint, method in admin_endpoints:
            if method == "GET":
                response = test_client.get(endpoint, headers=employee_headers)
            else:
                response = test_client.put(
                    endpoint,
                    headers=employee_headers,
                    json={"role": "platform_owner"}
                )
            
            assert response.status_code == 403, f"Privilege escalation on {endpoint}"
    
    def test_idor_prevention(self, test_client, auth_headers, test_db):
        """Test Insecure Direct Object Reference (IDOR) prevention"""
        # Create data for two restaurants
        restaurant1_headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        restaurant2_headers = auth_headers(user_id=2, role="manager", restaurant_id=2)
        
        # Create order for restaurant 1
        response = test_client.post(
            "/api/v1/orders",
            headers=restaurant1_headers,
            json={"items": [{"id": 1, "quantity": 1}]}
        )
        order_id = response.json()["id"]
        
        # Try to access from restaurant 2
        response = test_client.get(
            f"/api/v1/orders/{order_id}",
            headers=restaurant2_headers
        )
        
        assert response.status_code == 403
        assert "Access denied" in response.json()["detail"]
    
    def test_rate_limiting(self, test_client):
        """Test rate limiting to prevent abuse"""
        # Make multiple requests quickly
        responses = []
        for i in range(150):  # Assuming limit is 100/minute
            response = test_client.post("/api/v1/auth/login", json={
                "email": f"test{i}@example.com",
                "password": "wrong"
            })
            responses.append(response.status_code)
        
        # Should start getting rate limited
        assert 429 in responses, "Rate limiting not working"
        
        # Check rate limit headers
        limited_response = next(r for r in responses if r == 429)
        assert "X-RateLimit-Limit" in limited_response.headers
        assert "X-RateLimit-Remaining" in limited_response.headers
    
    def test_password_security(self, test_client):
        """Test password security requirements"""
        weak_passwords = [
            "123456",  # Too simple
            "password",  # Common password
            "abc",  # Too short
            "        ",  # Only spaces
        ]
        
        for password in weak_passwords:
            response = test_client.post("/api/v1/auth/register", json={
                "email": "test@example.com",
                "password": password,
                "username": "testuser"
            })
            
            assert response.status_code == 400
            assert "password" in response.json()["detail"].lower()
    
    def test_session_hijacking_prevention(self, test_client, auth_headers):
        """Test session hijacking prevention"""
        # Get valid token
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        token = headers["Authorization"].split()[1]
        
        # Try to use token from different IP (simulated)
        with patch('app.core.security.get_client_ip') as mock_ip:
            # Original request from IP 1
            mock_ip.return_value = "192.168.1.1"
            response1 = test_client.get("/api/v1/users/me", headers=headers)
            assert response1.status_code == 200
            
            # Same token from different IP
            mock_ip.return_value = "10.0.0.1"
            response2 = test_client.get("/api/v1/users/me", headers=headers)
            
            # Should detect potential hijacking
            assert response2.status_code in [401, 403]
    
    def test_file_upload_security(self, test_client, auth_headers):
        """Test file upload security"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        # Try to upload potentially dangerous files
        dangerous_files = [
            ("test.exe", b"MZ\x90\x00"),  # Executable
            ("test.php", b"<?php system($_GET['cmd']); ?>"),  # PHP shell
            ("test.js", b"require('child_process').exec('rm -rf /')"),  # JS payload
            ("../../../etc/passwd", b"root:x:0:0"),  # Path traversal
        ]
        
        for filename, content in dangerous_files:
            response = test_client.post(
                "/api/v1/upload/menu-image",
                headers=headers,
                files={"file": (filename, content, "application/octet-stream")}
            )
            
            # Should reject dangerous files
            assert response.status_code in [400, 415]


# ============================================================================
# 8. PERFORMANCE TESTS FOR MONITORING ENDPOINTS
# ============================================================================

class TestPerformanceMonitoring:
    """Patterns for testing performance and monitoring endpoints"""
    
    def test_health_check_performance(self, test_client):
        """Test health check endpoint performance"""
        import time
        
        response_times = []
        for _ in range(100):
            start = time.time()
            response = test_client.get("/api/v1/health")
            end = time.time()
            
            assert response.status_code == 200
            response_times.append(end - start)
        
        # Health checks should be fast
        avg_time = sum(response_times) / len(response_times)
        assert avg_time < 0.05  # 50ms average
        assert max(response_times) < 0.1  # 100ms max
    
    def test_metrics_endpoint(self, test_client, auth_headers):
        """Test metrics collection endpoint"""
        headers = auth_headers(user_id=1, role="platform_owner")
        
        response = test_client.get("/api/v1/metrics", headers=headers)
        assert response.status_code == 200
        
        metrics = response.json()
        assert "request_count" in metrics
        assert "average_response_time" in metrics
        assert "error_rate" in metrics
        assert "active_connections" in metrics
    
    def test_performance_under_load(self, test_client, auth_headers):
        """Test API performance under load"""
        import concurrent.futures
        import statistics
        
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        def make_request():
            start = time.time()
            response = test_client.get("/api/v1/menu", headers=headers)
            end = time.time()
            return end - start, response.status_code
        
        # Simulate concurrent users
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request) for _ in range(100)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        response_times = [r[0] for r in results]
        status_codes = [r[1] for r in results]
        
        # Performance assertions
        assert all(s == 200 for s in status_codes)  # All requests succeed
        assert statistics.mean(response_times) < 0.5  # Average < 500ms
        assert statistics.stdev(response_times) < 0.2  # Consistent performance
    
    def test_database_query_monitoring(self, test_client, auth_headers, monkeypatch):
        """Test database query performance monitoring"""
        headers = auth_headers(user_id=1, role="platform_owner")
        
        # Mock slow query logging
        slow_queries = []
        
        def log_slow_query(query, duration):
            if duration > 1.0:  # 1 second threshold
                slow_queries.append((query, duration))
        
        monkeypatch.setattr("app.core.monitoring.log_slow_query", log_slow_query)
        
        # Make requests that trigger queries
        test_client.get("/api/v1/orders?limit=1000", headers=headers)
        
        # Check monitoring endpoint
        response = test_client.get("/api/v1/monitoring/slow-queries", headers=headers)
        assert response.status_code == 200
        
        if slow_queries:
            assert len(response.json()["slow_queries"]) > 0
    
    def test_memory_usage_monitoring(self, test_client, auth_headers):
        """Test memory usage monitoring"""
        headers = auth_headers(user_id=1, role="platform_owner")
        
        response = test_client.get("/api/v1/monitoring/memory", headers=headers)
        assert response.status_code == 200
        
        memory_stats = response.json()
        assert "current_usage_mb" in memory_stats
        assert "peak_usage_mb" in memory_stats
        assert "available_mb" in memory_stats
        assert memory_stats["current_usage_mb"] > 0
    
    def test_cache_hit_rate_monitoring(self, test_client, auth_headers, mock_redis):
        """Test cache hit rate monitoring"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        # Make several requests to populate cache stats
        for i in range(10):
            test_client.get(f"/api/v1/menu/items/{i}", headers=headers)
        
        # Get cache stats
        response = test_client.get("/api/v1/monitoring/cache", headers=headers)
        assert response.status_code == 200
        
        cache_stats = response.json()
        assert "hit_rate" in cache_stats
        assert "total_hits" in cache_stats
        assert "total_misses" in cache_stats
        assert 0 <= cache_stats["hit_rate"] <= 1
    
    def test_error_rate_monitoring(self, test_client, auth_headers):
        """Test error rate monitoring"""
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        # Generate some errors
        for i in range(5):
            test_client.get(f"/api/v1/orders/999999", headers=headers)  # 404
            test_client.post("/api/v1/orders", headers=headers, json={})  # 422
        
        # Check error metrics
        admin_headers = auth_headers(user_id=1, role="platform_owner")
        response = test_client.get("/api/v1/monitoring/errors", headers=admin_headers)
        assert response.status_code == 200
        
        error_stats = response.json()
        assert "error_rate" in error_stats
        assert "errors_by_code" in error_stats
        assert "404" in error_stats["errors_by_code"]
        assert "422" in error_stats["errors_by_code"]


# ============================================================================
# COVERAGE CONFIGURATION
# ============================================================================

"""
Create a .coveragerc file in your project root:

[run]
source = app
omit = 
    */tests/*
    */migrations/*
    */__init__.py
    */config.py
    */venv/*
    */virtualenv/*

[report]
precision = 2
show_missing = True
skip_covered = False

[html]
directory = htmlcov

[xml]
output = coverage.xml
"""

# ============================================================================
# PYTEST CONFIGURATION
# ============================================================================

"""
Create a pytest.ini file in your project root:

[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = 
    -v
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=100
    --maxfail=1
    --strict-markers
    --tb=short
    -p no:warnings
    
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
    security: marks security-related tests
    performance: marks performance tests
    
asyncio_mode = auto
"""

# ============================================================================
# ADVANCED TESTING PATTERNS
# ============================================================================

class AdvancedTestingPatterns:
    """Additional advanced testing patterns for edge cases"""
    
    @pytest.fixture
    def mock_datetime(self, monkeypatch):
        """Mock datetime for time-sensitive tests"""
        class MockDatetime:
            @staticmethod
            def now():
                return datetime(2024, 1, 1, 12, 0, 0)
            
            @staticmethod
            def utcnow():
                return datetime(2024, 1, 1, 12, 0, 0)
        
        monkeypatch.setattr("app.core.utils.datetime", MockDatetime)
        return MockDatetime
    
    def test_decimal_precision(self, test_client, auth_headers):
        """Test decimal precision for monetary values"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        # Test various decimal edge cases
        test_cases = [
            ("10.99", Decimal("10.99")),
            ("10.999", Decimal("11.00")),  # Should round
            ("0.01", Decimal("0.01")),
            ("999999.99", Decimal("999999.99")),
        ]
        
        for input_value, expected in test_cases:
            response = test_client.post(
                "/api/v1/menu/items",
                headers=headers,
                json={"name": "Test", "price": input_value}
            )
            
            assert response.status_code == 201
            assert Decimal(response.json()["price"]) == expected
    
    @pytest.mark.parametrize("n", [0, 1, 10, 100, 1000])
    def test_pagination_edge_cases(self, test_client, auth_headers, test_db, n):
        """Test pagination with various data sizes"""
        # Create n items
        for i in range(n):
            item = MenuItem(id=i+1, name=f"Item {i}", price=10.00)
            test_db.add(item)
        test_db.commit()
        
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        # Test different page sizes
        for page_size in [1, 10, 50, 100]:
            response = test_client.get(
                f"/api/v1/menu?limit={page_size}&offset=0",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data["items"]) == min(page_size, n)
            assert data["total"] == n
    
    def test_unicode_handling(self, test_client, auth_headers):
        """Test Unicode character handling"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        unicode_strings = [
            "Café ☕",
            "🍕 Pizza",
            "Ñandú",
            "北京烤鸭",
            "مقهى",
            "🔥Hot🌶️Spicy🔥",
        ]
        
        for name in unicode_strings:
            response = test_client.post(
                "/api/v1/menu/items",
                headers=headers,
                json={"name": name, "price": 10.00}
            )
            
            assert response.status_code == 201
            assert response.json()["name"] == name
    
    def test_timezone_handling(self, test_client, auth_headers):
        """Test timezone handling for international restaurants"""
        headers = auth_headers(user_id=1, role="manager", restaurant_id=1)
        
        # Create order with specific timezone
        response = test_client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "items": [{"id": 1, "quantity": 1}],
                "timezone": "America/New_York"
            }
        )
        
        assert response.status_code == 201
        order = response.json()
        
        # Verify timestamp includes timezone info
        assert "created_at" in order
        assert "T" in order["created_at"]  # ISO format
    
    @pytest.mark.slow
    def test_long_running_operation(self, test_client, auth_headers):
        """Test handling of long-running operations"""
        headers = auth_headers(user_id=1, role="platform_owner")
        
        # Start long operation
        response = test_client.post(
            "/api/v1/reports/generate",
            headers=headers,
            json={"type": "annual", "year": 2024}
        )
        
        assert response.status_code == 202  # Accepted
        assert "task_id" in response.json()
        
        task_id = response.json()["task_id"]
        
        # Poll for completion
        for _ in range(30):  # Max 30 seconds
            status_response = test_client.get(
                f"/api/v1/tasks/{task_id}",
                headers=headers
            )
            
            if status_response.json()["status"] == "completed":
                break
            
            time.sleep(1)
        
        assert status_response.json()["status"] == "completed"


# ============================================================================
# INTEGRATION TEST EXAMPLE
# ============================================================================

@pytest.mark.integration
class TestOrderWorkflowIntegration:
    """Full integration test for order workflow"""
    
    async def test_complete_order_workflow(self, test_client, test_db, mock_redis, auth_headers):
        """Test complete order workflow from creation to completion"""
        # Setup
        restaurant = Restaurant(id=1, name="Test Restaurant")
        menu_item = MenuItem(id=1, name="Burger", price=Decimal("10.99"), restaurant_id=1)
        test_db.add_all([restaurant, menu_item])
        test_db.commit()
        
        headers = auth_headers(user_id=1, role="employee", restaurant_id=1)
        
        # 1. Create order
        create_response = test_client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "items": [{"id": 1, "quantity": 2}],
                "payment_method": "cash"
            }
        )
        assert create_response.status_code == 201
        order_id = create_response.json()["id"]
        
        # 2. Verify order in Redis cache
        cached_order = await mock_redis.get(f"order:{order_id}")
        assert cached_order is not None
        
        # 3. Update order status
        update_response = test_client.put(
            f"/api/v1/orders/{order_id}/status",
            headers=headers,
            json={"status": "preparing"}
        )
        assert update_response.status_code == 200
        
        # 4. Add payment
        payment_response = test_client.post(
            f"/api/v1/orders/{order_id}/payment",
            headers=headers,
            json={
                "amount": 21.98,
                "method": "cash",
                "received": 25.00
            }
        )
        assert payment_response.status_code == 200
        assert payment_response.json()["change"] == 3.02
        
        # 5. Complete order
        complete_response = test_client.put(
            f"/api/v1/orders/{order_id}/complete",
            headers=headers
        )
        assert complete_response.status_code == 200
        
        # 6. Verify final state
        final_order = test_client.get(
            f"/api/v1/orders/{order_id}",
            headers=headers
        ).json()
        
        assert final_order["status"] == "completed"
        assert final_order["payment_status"] == "paid"
        assert Decimal(final_order["total_amount"]) == Decimal("21.98")


# ============================================================================
# RUNNING TESTS WITH COVERAGE
# ============================================================================

"""
Command examples:

# Run all tests with coverage
pytest --cov=app --cov-report=html --cov-report=term-missing

# Run only unit tests
pytest -m unit

# Run tests in parallel
pytest -n auto

# Run with specific verbosity
pytest -vv

# Run until first failure
pytest -x

# Run specific test file
pytest tests/test_auth.py

# Run specific test class
pytest tests/test_auth.py::TestAuthentication

# Run specific test method
pytest tests/test_auth.py::TestAuthentication::test_login_success

# Generate coverage badge
coverage-badge -o coverage.svg

# Check coverage without running tests
coverage report

# Show missing lines for specific file
coverage report -m app/services/order_service.py
"""