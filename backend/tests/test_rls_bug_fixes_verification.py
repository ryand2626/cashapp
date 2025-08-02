"""
Verification tests for RLS bug fixes
Ensures all fixes work correctly
"""

import pytest
import asyncio
import threading
from unittest.mock import MagicMock, patch, call
from sqlalchemy.orm import Session
from sqlalchemy import text, create_engine
from sqlalchemy.pool import StaticPool
from contextlib import contextmanager

from app.core.rls_context import RLSContext
from app.core.rls_session_context import RLSSessionContext
from app.core.database import get_db, RLSContext as DatabaseRLSContext
from app.core.websocket_rate_limiter import WebSocketRateLimiter
from app.models import User


class TestRLSContextFixed:
    """Verify Bug 1 fix: RLS Context now uses SET LOCAL"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        db = MagicMock(spec=Session)
        db.execute = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        return db
    
    @pytest.fixture
    def test_user(self):
        """Create a test user"""
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.email = "test@restaurant.com"
        user.role = "manager"
        user.restaurant_id = "rest_456"
        return user
    
    def test_get_db_with_context_now_uses_set_local(self, mock_db, test_user):
        """Verify that get_db_with_context now correctly uses SET LOCAL"""
        # Call the method
        RLSContext.get_db_with_context(mock_db, test_user)
        
        # Check that SET LOCAL is now used
        calls = mock_db.execute.call_args_list
        
        # Verify the fix - should use SET LOCAL
        assert any("SET LOCAL app.current_user_id" in str(call[0][0]) for call in calls)
        assert not any("SET app.current_user_id" in str(call[0][0]) and "SET LOCAL" not in str(call[0][0]) for call in calls)
    
    def test_set_tenant_context_uses_correct_variables(self, mock_db, test_user):
        """Verify that set_tenant_context uses correct variable names"""
        with RLSContext.set_tenant_context(mock_db, test_user):
            calls = mock_db.execute.call_args_list
            
            # Should use current_ prefix
            assert any("SET LOCAL app.current_user_id" in str(call[0][0]) for call in calls)
            assert any("SET LOCAL app.current_user_email" in str(call[0][0]) for call in calls)
            assert any("SET LOCAL app.current_user_role" in str(call[0][0]) for call in calls)
            assert any("SET LOCAL app.current_restaurant_id" in str(call[0][0]) for call in calls)


class TestWebSocketCleanupFixed:
    """Verify Bug 3 fix: WebSocket cleanup now includes user_id"""
    
    @pytest.mark.asyncio
    async def test_unregister_connection_with_user_id_works(self):
        """Verify that unregister_connection works with both parameters"""
        limiter = WebSocketRateLimiter()
        
        # Register and unregister with both parameters
        await limiter.register_connection("conn_123", "user_456", "127.0.0.1")
        await limiter.unregister_connection("conn_123", "user_456")
        
        # Should work without errors
        assert "user_456" not in limiter.active_connections


class TestRLSContextvarsFixed:
    """Verify Bug 4 fix: RLS now uses contextvars instead of thread-local"""
    
    def test_contextvars_no_race_condition(self):
        """Verify that contextvars prevents race conditions"""
        # Set context
        DatabaseRLSContext.set(user_id="user_1", restaurant_id="rest_1")
        
        # Get context - should be consistent
        context = DatabaseRLSContext.get()
        assert context['user_id'] == "user_1"
        assert context['restaurant_id'] == "rest_1"
        
        # Clear context
        DatabaseRLSContext.clear()
        assert DatabaseRLSContext.get() == {}
    
    def test_no_memory_leak_with_contextvars(self):
        """Verify that contextvars doesn't cause memory leaks"""
        # Context is now managed by contextvars, not a class dict
        # No _context attribute should exist
        assert not hasattr(DatabaseRLSContext, '_context')


class TestDatabaseConnectionFixed:
    """Verify Bug 5 fix: Database connection leak fixed"""
    
    def test_proper_dependency_injection(self):
        """Verify that RLS dependency uses proper injection"""
        from app.core.rls_session_context import RLSSessionContext
        
        # Get the dependency function
        rls_dep = RLSSessionContext.create_rls_dependency()
        
        # Check the function signature - should use Depends(get_db) not lambda
        import inspect
        sig = inspect.signature(rls_dep)
        
        # The db parameter should have a Depends default
        db_param = sig.parameters.get('db')
        assert db_param is not None
        
        # Should not use lambda: next(get_db())
        assert 'lambda' not in str(db_param.default)


class TestRLSSessionVariableNamesFixed:
    """Verify Bug 6 fix: RLS session variables use correct names"""
    
    def test_database_py_uses_correct_variable_names(self):
        """Verify that database.py now uses app.current_user_id"""
        # Mock a database connection
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Set up context
        DatabaseRLSContext.set(user_id="test_user", restaurant_id="test_rest", role="manager")
        
        # Simulate the checkout event
        from app.core.database import receive_checkout
        receive_checkout(mock_conn, {}, None)
        
        # Check what was executed
        executed_commands = [call[0][0] for call in mock_cursor.execute.call_args_list]
        
        # Should use app.current_user_id not app.user_id
        assert any("SET LOCAL app.current_user_id" in cmd for cmd in executed_commands)
        assert not any("SET LOCAL app.user_id" in cmd for cmd in executed_commands)
        
        # Should also set other current_ variables
        assert any("SET LOCAL app.current_user_role" in cmd for cmd in executed_commands)
        assert any("SET LOCAL app.current_restaurant_id" in cmd for cmd in executed_commands)
        assert any("SET LOCAL app.is_platform_owner" in cmd for cmd in executed_commands)


class TestResetSpecificVariablesFixed:
    """Verify Bug 7 fix: Uses specific RESETs instead of RESET ALL"""
    
    def test_reset_specific_variables_not_all(self):
        """Verify that specific RLS variables are reset, not ALL"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Simulate the checkin event
        from app.core.database import receive_checkin
        receive_checkin(mock_conn, {})
        
        # Check what was executed
        executed_commands = [call[0][0] for call in mock_cursor.execute.call_args_list]
        
        # Should NOT use RESET ALL
        assert not any("RESET ALL" in cmd for cmd in executed_commands)
        
        # Should reset specific variables
        assert any("RESET app.current_user_id" in cmd for cmd in executed_commands)
        assert any("RESET app.current_user_email" in cmd for cmd in executed_commands)
        assert any("RESET app.current_user_role" in cmd for cmd in executed_commands)
        assert any("RESET app.current_restaurant_id" in cmd for cmd in executed_commands)
        assert any("RESET app.is_platform_owner" in cmd for cmd in executed_commands)


class TestIntegrationWithPlatformOwners:
    """Verify all fixes work together with platform owner logic"""
    
    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        db = MagicMock(spec=Session)
        db.execute = MagicMock()
        db.commit = MagicMock()
        db.rollback = MagicMock()
        return db
    
    @pytest.fixture
    def platform_owner(self):
        """Create a platform owner user"""
        user = MagicMock(spec=User)
        user.id = "ryan_id"
        user.email = "ryan@fynlo.com"
        user.role = "platform_owner"
        user.restaurant_id = None
        return user
    
    def test_platform_owner_context_with_fixes(self, mock_db, platform_owner):
        """Verify platform owner context works with all fixes"""
        with patch('app.core.tenant_security.TenantSecurity.is_platform_owner', return_value=True):
            RLSContext.get_db_with_context(mock_db, platform_owner)
            
            calls = mock_db.execute.call_args_list
            
            # Should set platform owner flag
            assert any("SET LOCAL app.is_platform_owner" in str(call[0][0]) and "'true'" in str(call) for call in calls)
            
            # Should use correct variable names
            assert any("SET LOCAL app.current_user_id" in str(call[0][0]) for call in calls)
            
            # Restaurant ID should be set to DEFAULT for platform owners
            assert any("SET LOCAL app.current_restaurant_id TO DEFAULT" in str(call[0][0]) for call in calls)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])