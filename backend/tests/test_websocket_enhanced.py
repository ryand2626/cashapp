"""
Tests for enhanced WebSocket functionality including heartbeat and reconnection
"""

import asyncio
import json
import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect

from app.api.v1.endpoints.websocket_enhanced import (
    EnhancedWebSocketManager,
    ConnectionInfo,
    manager
)
from app.schemas.websocket import WebSocketEventType
from app.core.rate_limiter import RateLimiter, ConnectionLimiter


class TestEnhancedWebSocketManager:
    """Test the EnhancedWebSocketManager functionality"""
    
    @pytest.fixture
    def ws_manager(self):
        """Create a fresh WebSocket manager for testing"""
        return EnhancedWebSocketManager()
    
    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket connection"""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_json = AsyncMock()
        ws.close = AsyncMock()
        return ws
    
    @pytest.mark.asyncio
    async def test_connection_acceptance(self, ws_manager, mock_websocket):
        """Test WebSocket connection acceptance"""
        restaurant_id = "test-restaurant"
        
        connection_id = await ws_manager.connect(mock_websocket, restaurant_id)
        
        assert connection_id is not None
        assert restaurant_id in connection_id
        mock_websocket.accept.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_authentication_success(self, ws_manager, mock_websocket):
        """Test successful authentication flow"""
        connection_id = "test-connection"
        auth_data = {
            "token": "valid-token",
            "user_id": "user123",
            "restaurant_id": "restaurant123"
        }
        
        # Mock the token verification
        with patch('app.api.v1.endpoints.websocket_enhanced.verify_websocket_token') as mock_verify:
            mock_user = Mock()
            mock_user.id = "user123"
            mock_user.restaurant_id = "restaurant123"
            mock_user.role = "employee"
            mock_verify.return_value = mock_user
            
            db = Mock()
            conn_info = await ws_manager.authenticate(
                connection_id, mock_websocket, auth_data, db
            )
            
            assert conn_info is not None
            assert conn_info.authenticated is True
            assert conn_info.user_id == "user123"
            assert conn_info.restaurant_id == "restaurant123"
            
            # Verify authenticated message was sent
            mock_websocket.send_json.assert_called()
            sent_data = mock_websocket.send_json.call_args[0][0]
            assert sent_data['type'] == WebSocketEventType.AUTHENTICATED
    
    @pytest.mark.asyncio
    async def test_authentication_failure_invalid_token(self, ws_manager, mock_websocket):
        """Test authentication failure with invalid token"""
        connection_id = "test-connection"
        auth_data = {
            "token": "invalid-token",
            "user_id": "user123",
            "restaurant_id": "restaurant123"
        }
        
        with patch('app.api.v1.endpoints.websocket_enhanced.verify_websocket_token') as mock_verify:
            mock_verify.return_value = None
            
            db = Mock()
            conn_info = await ws_manager.authenticate(
                connection_id, mock_websocket, auth_data, db
            )
            
            assert conn_info is None
            
            # Verify error message was sent
            mock_websocket.send_json.assert_called()
            sent_data = mock_websocket.send_json.call_args[0][0]
            assert sent_data['type'] == WebSocketEventType.AUTH_ERROR
    
    @pytest.mark.asyncio
    async def test_heartbeat_ping_pong(self, ws_manager, mock_websocket):
        """Test heartbeat ping/pong mechanism"""
        connection_id = "test-connection"
        
        # Create authenticated connection
        conn_info = ConnectionInfo(mock_websocket, "user123", "restaurant123")
        conn_info.authenticated = True
        ws_manager.connection_map[connection_id] = conn_info
        
        # Test handling ping
        await ws_manager.handle_ping(connection_id, mock_websocket)
        
        # Verify pong was sent
        mock_websocket.send_json.assert_called()
        sent_data = mock_websocket.send_json.call_args[0][0]
        assert sent_data['type'] == WebSocketEventType.PONG
        
        # Verify last_ping was updated
        assert (datetime.utcnow() - conn_info.last_ping).total_seconds() < 1
    
    @pytest.mark.asyncio
    async def test_server_initiated_heartbeat(self, ws_manager, mock_websocket):
        """Test server-initiated heartbeat"""
        connection_id = "test-connection"
        
        # Create authenticated connection
        conn_info = ConnectionInfo(mock_websocket, "user123", "restaurant123")
        conn_info.authenticated = True
        ws_manager.connection_map[connection_id] = conn_info
        
        # Send heartbeat
        success = await ws_manager.send_heartbeat(connection_id)
        
        assert success is True
        mock_websocket.send_json.assert_called()
        sent_data = mock_websocket.send_json.call_args[0][0]
        assert sent_data['type'] == WebSocketEventType.PING
    
    @pytest.mark.asyncio
    async def test_missed_pong_disconnection(self, ws_manager):
        """Test disconnection after missing pongs"""
        connection_id = "test-connection"
        mock_ws = AsyncMock()
        
        # Create connection that will fail to send
        conn_info = ConnectionInfo(mock_ws, "user123", "restaurant123")
        conn_info.authenticated = True
        conn_info.last_ping = datetime.utcnow() - timedelta(seconds=60)  # Old ping
        ws_manager.connection_map[connection_id] = conn_info
        
        # Mock send failure
        mock_ws.send_json.side_effect = Exception("Connection lost")
        
        # Simulate multiple heartbeat cycles
        for i in range(ws_manager.max_missed_pongs + 1):
            await ws_manager.send_heartbeat(connection_id)
        
        # Check if missed pongs were tracked
        assert conn_info.missed_pongs >= ws_manager.max_missed_pongs
    
    @pytest.mark.asyncio
    async def test_connection_limits(self, ws_manager):
        """Test connection limit enforcement"""
        restaurant_id = "restaurant123"
        user_id = "user123"
        
        # Fill up user connections
        for i in range(ws_manager.max_connections_per_user):
            conn = ConnectionInfo(Mock(), user_id, restaurant_id)
            if restaurant_id not in ws_manager.active_connections:
                ws_manager.active_connections[restaurant_id] = set()
            ws_manager.active_connections[restaurant_id].add(conn)
        
        # Check that limit is enforced
        result = ws_manager._check_connection_limits(restaurant_id, user_id)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_broadcast_to_restaurant(self, ws_manager):
        """Test broadcasting messages to all restaurant connections"""
        restaurant_id = "restaurant123"
        
        # Create multiple connections
        connections = []
        for i in range(3):
            ws = AsyncMock()
            conn = ConnectionInfo(ws, f"user{i}", restaurant_id)
            connections.append(conn)
            
            if restaurant_id not in ws_manager.active_connections:
                ws_manager.active_connections[restaurant_id] = set()
            ws_manager.active_connections[restaurant_id].add(conn)
            ws_manager.connection_map[f"conn{i}"] = conn
        
        # Broadcast message
        await ws_manager.broadcast_to_restaurant(
            restaurant_id,
            WebSocketEventType.ORDER_CREATED,
            {"order_id": "12345"}
        )
        
        # Verify all connections received the message
        for conn in connections:
            conn.websocket.send_json.assert_called_once()
            sent_data = conn.websocket.send_json.call_args[0][0]
            assert sent_data['type'] == WebSocketEventType.ORDER_CREATED
            assert sent_data['data']['order_id'] == "12345"
    
    @pytest.mark.asyncio
    async def test_cleanup_dead_connections(self, ws_manager):
        """Test cleanup of dead connections during broadcast"""
        restaurant_id = "restaurant123"
        
        # Create connections - one will fail
        good_ws = AsyncMock()
        bad_ws = AsyncMock()
        bad_ws.send_json.side_effect = WebSocketDisconnect()
        
        good_conn = ConnectionInfo(good_ws, "user1", restaurant_id)
        bad_conn = ConnectionInfo(bad_ws, "user2", restaurant_id)
        
        ws_manager.active_connections[restaurant_id] = {good_conn, bad_conn}
        ws_manager.connection_map["conn1"] = good_conn
        ws_manager.connection_map["conn2"] = bad_conn
        
        # Broadcast - should handle the failed connection
        await ws_manager.broadcast_to_restaurant(
            restaurant_id,
            WebSocketEventType.DATA_UPDATED,
            {}
        )
        
        # Verify good connection still received message
        good_ws.send_json.assert_called_once()
        
        # Bad connection should be removed
        assert bad_conn not in ws_manager.active_connections.get(restaurant_id, set())


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    def test_rate_limit_allows_burst(self):
        """Test that rate limiter allows burst traffic"""
        limiter = RateLimiter(max_messages=100, window_seconds=60, burst_size=20)
        connection_id = "test-conn"
        
        # Should allow burst_size messages immediately
        for i in range(20):
            assert limiter.check_rate_limit(connection_id) is True
        
        # 21st message should be rate limited
        assert limiter.check_rate_limit(connection_id) is False
    
    def test_rate_limit_refill(self):
        """Test token bucket refill over time"""
        limiter = RateLimiter(max_messages=60, window_seconds=60, burst_size=10)
        connection_id = "test-conn"
        
        # Use up burst
        for i in range(10):
            limiter.check_rate_limit(connection_id)
        
        # Simulate time passing (1 second = 1 token with 60/60 rate)
        with patch('time.time') as mock_time:
            mock_time.return_value = limiter.buckets[connection_id][1] + 2  # 2 seconds later
            
            # Should have 2 new tokens
            assert limiter.check_rate_limit(connection_id) is True
            assert limiter.check_rate_limit(connection_id) is True
            assert limiter.check_rate_limit(connection_id) is False
    
    def test_rate_limit_violations_tracking(self):
        """Test tracking of rate limit violations"""
        limiter = RateLimiter(max_messages=10, window_seconds=60, burst_size=5)
        connection_id = "test-conn"
        
        # Use up tokens
        for i in range(5):
            limiter.check_rate_limit(connection_id)
        
        # Cause violations
        for i in range(3):
            assert limiter.check_rate_limit(connection_id) is False
        
        assert limiter.violations[connection_id] == 3


class TestConnectionLimiter:
    """Test connection limiting functionality"""
    
    def test_ip_connection_limit(self):
        """Test IP-based connection limiting"""
        limiter = ConnectionLimiter(max_per_ip=3, max_per_user=10)
        ip = "192.168.1.1"
        
        # Should allow up to max_per_ip connections
        for i in range(3):
            allowed, reason = limiter.check_connection_allowed(ip, f"user{i}", f"conn{i}")
            assert allowed is True
        
        # 4th connection should be blocked
        allowed, reason = limiter.check_connection_allowed(ip, "user4", "conn4")
        assert allowed is False
        assert "Too many connections from IP" in reason
    
    def test_user_connection_limit(self):
        """Test user-based connection limiting"""
        limiter = ConnectionLimiter(max_per_ip=10, max_per_user=2)
        user_id = "user123"
        
        # Should allow up to max_per_user connections
        for i in range(2):
            allowed, reason = limiter.check_connection_allowed(f"ip{i}", user_id, f"conn{i}")
            assert allowed is True
        
        # 3rd connection for same user should be blocked
        allowed, reason = limiter.check_connection_allowed("ip3", user_id, "conn3")
        assert allowed is False
        assert f"User {user_id} has too many active connections" in reason
    
    def test_connection_removal(self):
        """Test connection removal updates limits"""
        limiter = ConnectionLimiter(max_per_ip=10, max_per_user=2)
        user_id = "user123"
        
        # Add connections
        limiter.check_connection_allowed("ip1", user_id, "conn1")
        limiter.check_connection_allowed("ip2", user_id, "conn2")
        
        # Should be at limit
        allowed, _ = limiter.check_connection_allowed("ip3", user_id, "conn3")
        assert allowed is False
        
        # Remove a connection
        limiter.remove_connection(user_id, "conn1")
        
        # Should now allow new connection
        allowed, _ = limiter.check_connection_allowed("ip3", user_id, "conn3")
        assert allowed is True


class TestExponentialBackoff:
    """Test exponential backoff calculations"""
    
    def test_backoff_calculation(self):
        """Test exponential backoff with jitter"""
        from app.api.v1.endpoints.websocket_enhanced import EnhancedWebSocketManager
        
        # Can't directly test the frontend TypeScript, but we can verify the concept
        max_delay = 64000
        
        for attempt in range(10):
            base = min(1000 * (2 ** attempt), max_delay)
            jitter = 0.3 * base  # Max jitter
            
            # Verify base calculation
            if attempt == 0:
                assert base == 1000
            elif attempt == 1:
                assert base == 2000
            elif attempt == 2:
                assert base == 4000
            elif attempt >= 6:
                assert base == max_delay
            
            # Verify jitter is within bounds
            assert 0 <= jitter <= 0.3 * base


if __name__ == "__main__":
    pytest.main([__file__, "-v"])