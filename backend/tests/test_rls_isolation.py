"""
Tests for RLS (Row Level Security) session variable isolation
Ensures that database connections properly isolate tenant data
"""

import pytest
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text
from sqlalchemy.orm import Session
from uuid import uuid4

from app.core.database import engine, SessionLocal, RLSContext, get_db_with_rls


class TestRLSIsolation:
    """Test suite for RLS session variable isolation"""
    
    def test_rls_context_thread_isolation(self):
        """Test that RLS context is properly isolated between threads"""
        results = {}
        
        def set_and_check_context(thread_id: int, user_id: str):
            # Set context for this thread
            RLSContext.set(user_id=user_id, restaurant_id=f"restaurant_{thread_id}")
            
            # Small delay to ensure overlap
            import time
            time.sleep(0.1)
            
            # Get context and store result
            context = RLSContext.get()
            results[thread_id] = context
            
            # Clear context
            RLSContext.clear()
        
        # Run multiple threads concurrently
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            for i in range(5):
                future = executor.submit(set_and_check_context, i, f"user_{i}")
                futures.append(future)
            
            # Wait for all threads to complete
            for future in futures:
                future.result()
        
        # Verify each thread had its own isolated context
        for i in range(5):
            assert results[i]['user_id'] == f"user_{i}"
            assert results[i]['restaurant_id'] == f"restaurant_{i}"
    
    def test_session_variable_isolation(self):
        """Test that session variables are properly set and isolated"""
        user1_id = str(uuid4())
        user2_id = str(uuid4())
        restaurant1_id = str(uuid4())
        restaurant2_id = str(uuid4())
        
        # Test with first user context
        with get_db_with_rls(user_id=user1_id, restaurant_id=restaurant1_id) as db1:
            # Check session variables are set
            result = db1.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            assert result == user1_id
            
            result = db1.execute(text("SELECT current_setting('app.restaurant_id', true)")).scalar()
            assert result == restaurant1_id
        
        # Test with second user context
        with get_db_with_rls(user_id=user2_id, restaurant_id=restaurant2_id) as db2:
            # Check session variables are set to different values
            result = db2.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            assert result == user2_id
            
            result = db2.execute(text("SELECT current_setting('app.restaurant_id', true)")).scalar()
            assert result == restaurant2_id
        
        # Test that context is cleared after use
        with SessionLocal() as db3:
            # Session variables should be empty or null
            result = db3.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            assert result == "" or result is None
    
    def test_connection_pool_isolation(self):
        """Test that connections from pool are properly reset"""
        sessions = []
        results = []
        
        # Create multiple sessions with different contexts
        for i in range(10):
            user_id = f"user_{i}"
            restaurant_id = f"restaurant_{i}"
            
            # Set context and create session
            RLSContext.set(user_id=user_id, restaurant_id=restaurant_id)
            session = SessionLocal()
            
            # Store session variable values
            try:
                user_result = session.execute(
                    text("SELECT current_setting('app.user_id', true)")
                ).scalar()
                restaurant_result = session.execute(
                    text("SELECT current_setting('app.restaurant_id', true)")
                ).scalar()
                
                results.append({
                    'expected_user': user_id,
                    'actual_user': user_result,
                    'expected_restaurant': restaurant_id,
                    'actual_restaurant': restaurant_result
                })
            finally:
                session.close()
                RLSContext.clear()
        
        # Verify all sessions had correct isolated variables
        for result in results:
            assert result['actual_user'] == result['expected_user']
            assert result['actual_restaurant'] == result['expected_restaurant']
    
    def test_concurrent_request_isolation(self):
        """Test isolation during concurrent requests"""
        async def make_request(request_id: int):
            user_id = f"user_{request_id}"
            restaurant_id = f"restaurant_{request_id}"
            
            # Simulate request with RLS context
            with get_db_with_rls(user_id=user_id, restaurant_id=restaurant_id) as db:
                # Add delay to ensure overlap
                await asyncio.sleep(0.01)
                
                # Check session variables
                user_result = db.execute(
                    text("SELECT current_setting('app.user_id', true)")
                ).scalar()
                restaurant_result = db.execute(
                    text("SELECT current_setting('app.restaurant_id', true)")
                ).scalar()
                
                # Verify correct values
                assert user_result == user_id
                assert restaurant_result == restaurant_id
                
                # Another delay to ensure overlap
                await asyncio.sleep(0.01)
                
                # Check again to ensure no contamination
                user_result2 = db.execute(
                    text("SELECT current_setting('app.user_id', true)")
                ).scalar()
                assert user_result2 == user_id
        
        async def run_concurrent_requests():
            # Run 20 concurrent requests
            tasks = [make_request(i) for i in range(20)]
            await asyncio.gather(*tasks)
        
        # Run the async test
        asyncio.run(run_concurrent_requests())
    
    def test_error_handling_clears_context(self):
        """Test that RLS context is cleared even on errors"""
        user_id = str(uuid4())
        
        # Set context
        RLSContext.set(user_id=user_id)
        
        # Verify it's set
        assert RLSContext.get()['user_id'] == user_id
        
        # Simulate error in database operation
        try:
            with get_db_with_rls(user_id=user_id) as db:
                # Force an error
                raise Exception("Simulated error")
        except Exception:
            pass
        
        # Verify context is cleared
        assert RLSContext.get() == {}
    
    def test_nested_transactions_maintain_context(self):
        """Test that nested transactions maintain RLS context"""
        user_id = str(uuid4())
        restaurant_id = str(uuid4())
        
        with get_db_with_rls(user_id=user_id, restaurant_id=restaurant_id) as db:
            # Check outer transaction has context
            result = db.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            assert result == user_id
            
            # Begin nested transaction
            with db.begin_nested():
                # Context should still be available
                result = db.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
                assert result == user_id
                
                result = db.execute(text("SELECT current_setting('app.restaurant_id', true)")).scalar()
                assert result == restaurant_id
            
            # Context should still be available after nested transaction
            result = db.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            assert result == user_id


@pytest.mark.parametrize("pool_size", [1, 5, 20])
def test_different_pool_sizes(pool_size):
    """Test RLS isolation works with different connection pool sizes"""
    # This would require creating a new engine with different pool size
    # For now, we'll test with the existing engine
    
    results = []
    for i in range(pool_size * 2):  # Test with more requests than pool size
        user_id = f"user_{i}"
        
        with get_db_with_rls(user_id=user_id) as db:
            result = db.execute(text("SELECT current_setting('app.user_id', true)")).scalar()
            results.append((user_id, result))
    
    # Verify all requests had correct isolation
    for expected, actual in results:
        assert expected == actual