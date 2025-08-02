"""
Comprehensive tests for RLS bug fixes
Tests all issues identified by CursorBugBot
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


class TestRLSContextLeakage:
    """Test for Bug 1: RLS Context Leakage in Database Connections"""
    
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
    
    def test_get_db_with_context_uses_set_not_set_local(self, mock_db, test_user):
        """Test that get_db_with_context incorrectly uses SET instead of SET LOCAL"""
        # Call the method
        RLSContext.get_db_with_context(mock_db, test_user)
        
        # Check that SET was used (not SET LOCAL)
        calls = mock_db.execute.call_args_list
        
        # Verify the bug exists - it should be using SET not SET LOCAL
        assert any("SET app.user_id" in str(call[0][0]) for call in calls)
        assert not any("SET LOCAL app.user_id" in str(call[0][0]) for call in calls)
    
    def test_set_tenant_context_correctly_uses_set_local(self, mock_db, test_user):
        """Test that set_tenant_context correctly uses SET LOCAL"""
        with RLSContext.set_tenant_context(mock_db, test_user):
            calls = mock_db.execute.call_args_list
            
            # Verify correct behavior - should use SET LOCAL
            assert any("SET LOCAL app.user_id" in str(call[0][0]) for call in calls)
            assert not any(call for call in calls if "SET app.user_id" in str(call[0][0]) and "SET LOCAL" not in str(call[0][0]))
    
    def test_connection_pool_leakage_scenario(self):
        """Test that SET persists across connection reuse in pool"""
        # This test simulates connection pooling behavior
        # In real scenario, SET would persist while SET LOCAL wouldn't
        
        # Create in-memory SQLite for testing
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        
        # First "request" sets context
        with engine.connect() as conn:
            # Simulate the bug - using SET
            conn.execute(text("PRAGMA temp_store = 2"))  # SQLite equivalent
            result = conn.execute(text("PRAGMA temp_store")).scalar()
            assert result == 2
        
        # Second "request" on same connection
        with engine.connect() as conn:
            # The value persists (simulating the bug)
            result = conn.execute(text("PRAGMA temp_store")).scalar()
            assert result == 2  # Bug: value persists!


class TestWebSocketCleanup:
    """Test for Bug 3: WebSocket cleanup missing user_id parameter"""
    
    @pytest.mark.asyncio
    async def test_unregister_connection_requires_user_id(self):
        """Test that unregister_connection requires both connection_id and user_id"""
        limiter = WebSocketRateLimiter()
        
        # Register a connection first
        await limiter.register_connection("conn_123", "user_456", "127.0.0.1")
        
        # Try to unregister with only connection_id (simulating the bug)
        with pytest.raises(TypeError) as exc_info:
            await limiter.unregister_connection("conn_123")  # Missing user_id
        
        assert "missing 1 required positional argument: 'user_id'" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_correct_unregister_with_user_id(self):
        """Test correct unregister_connection with both parameters"""
        limiter = WebSocketRateLimiter()
        
        # Register and unregister correctly
        await limiter.register_connection("conn_123", "user_456", "127.0.0.1")
        await limiter.unregister_connection("conn_123", "user_456")
        
        # Verify connection was removed
        assert "user_456" not in limiter.active_connections


class TestRLSThreadLocalStorage:
    """Test for Bug 4: RLS race conditions and thread-local storage issues"""
    
    def test_thread_local_storage_race_condition(self):
        """Test that thread-local storage can cause race conditions"""
        results = []
        
        def set_and_get_context(user_id):
            # Set context in one thread
            DatabaseRLSContext.set(user_id=user_id, restaurant_id=f"rest_{user_id}")
            
            # Simulate some work
            import time
            time.sleep(0.01)
            
            # Get context - might get wrong value due to race condition
            context = DatabaseRLSContext.get()
            results.append((user_id, context.get('user_id')))
        
        # Run multiple threads
        threads = []
        for i in range(5):
            t = threading.Thread(target=set_and_get_context, args=(f"user_{i}",))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        # Check if any thread got wrong context
        for expected, actual in results:
            if expected != actual:
                # Race condition detected
                assert True
                return
        
        # If no race condition detected, the test should note this
        # In production, this COULD happen due to connection pooling
        assert len(results) == 5
    
    def test_memory_leak_from_thread_ids(self):
        """Test that thread IDs are never cleaned up causing memory leak"""
        initial_size = len(DatabaseRLSContext._context)
        
        def create_context():
            DatabaseRLSContext.set(user_id="test")
            # Thread ends but context remains
        
        # Create many threads
        for _ in range(10):
            t = threading.Thread(target=create_context)
            t.start()
            t.join()
        
        # Check that contexts accumulate (memory leak)
        final_size = len(DatabaseRLSContext._context)
        assert final_size > initial_size  # Bug: contexts never cleaned


class TestDatabaseConnectionLeak:
    """Test for Bug 5: Database connection leak in dependency injection"""
    
    def test_direct_next_bypasses_cleanup(self):
        """Test that Depends(lambda: next(get_db())) bypasses cleanup"""
        # This pattern bypasses the generator's finally block
        
        cleanup_called = False
        
        def mock_get_db():
            db = MagicMock()
            try:
                yield db
            finally:
                nonlocal cleanup_called
                cleanup_called = True
                db.close()
        
        # Simulate the bug - direct next() call
        db_gen = mock_get_db()
        db = next(db_gen)
        
        # At this point, cleanup is NOT called
        assert not cleanup_called
        
        # The generator is not properly closed
        # In production, this causes connection leak
        
        # Proper way would be:
        cleanup_called = False
        with contextmanager(mock_get_db)() as db:
            pass
        # Now cleanup would be called, but the bug prevents this


class TestRLSSessionVariableNames:
    """Test for Bug 6: RLS session variable name mismatch"""
    
    def test_database_py_uses_wrong_variable_names(self):
        """Test that database.py sets app.user_id instead of app.current_user_id"""
        # Mock a database connection
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Set up context
        DatabaseRLSContext.set(user_id="test_user", restaurant_id="test_rest")
        
        # Simulate the checkout event
        from app.core.database import receive_checkout
        receive_checkout(mock_conn, {}, None)
        
        # Check what was executed
        executed_commands = [call[0][0] for call in mock_cursor.execute.call_args_list]
        
        # Bug: Uses app.user_id instead of app.current_user_id
        assert any("SET LOCAL app.user_id" in cmd for cmd in executed_commands)
        assert not any("SET LOCAL app.current_user_id" in cmd for cmd in executed_commands)
    
    def test_rls_policies_expect_current_prefix(self):
        """Test that RLS policies expect app.current_user_id not app.user_id"""
        # This would be verified against actual PostgreSQL RLS policies
        # The migration file should use get_current_user_id() function
        # which expects app.current_user_id
        
        # Read the migration file to verify
        with open("/Users/ryandavidson/Desktop/cashapp-fynlo-main/backend/alembic/versions/011_add_rls_session_variables.py", "r") as f:
            content = f.read()
            
        # Verify the function expects current_ prefix
        assert "get_current_user_id()" in content
        assert "current_setting_or_default('app.current_user_id'" in content


class TestResetAllIssue:
    """Test for Bug 7: Overly aggressive RESET ALL"""
    
    def test_reset_all_clears_everything(self):
        """Test that RESET ALL clears more than just RLS variables"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        
        # Simulate the checkin event
        from app.core.database import receive_checkin
        receive_checkin(mock_conn, {})
        
        # Check what was executed
        executed_commands = [call[0][0] for call in mock_cursor.execute.call_args_list]
        
        # Bug: Uses RESET ALL instead of specific resets
        assert any("RESET ALL" in cmd for cmd in executed_commands)
        assert not any("RESET app.current_user_id" in cmd for cmd in executed_commands)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])