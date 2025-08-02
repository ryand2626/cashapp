"""
Test RLS Session Context Management
"""

import pytest
from unittest.mock import MagicMock, patch, call
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.rls_session_context import RLSSessionContext, current_tenant_context
from app.core.tenant_security import TenantSecurity
from app.models import User


class TestRLSSessionContext:
    """Test RLS session context management"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
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
    
    @pytest.fixture
    def regular_user(self):
        """Create a regular user"""
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.email = "manager@restaurant.com"
        user.role = "manager"
        user.restaurant_id = "rest_456"
        return user
    
    @pytest.fixture
    def user_without_restaurant(self):
        """Create a user without restaurant assignment"""
        user = MagicMock(spec=User)
        user.id = "user_789"
        user.email = "new@user.com"
        user.role = "employee"
        user.restaurant_id = None
        return user
    
    @pytest.mark.asyncio
    async def test_set_platform_owner_context(self, mock_db, platform_owner):
        """Test setting context for platform owners"""
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=True):
            await RLSSessionContext.set_tenant_context(mock_db, platform_owner)
            
            # Verify correct session variables were set
            calls = mock_db.execute.call_args_list
            assert len(calls) == 5  # 5 SET LOCAL statements
            
            # Check the SQL statements (comparing text values)
            call_sqls = [(str(call[0][0]), call[0][1] if len(call[0]) > 1 else None) for call in calls]
            
            expected_sqls = [
                ("SET LOCAL app.current_user_id = :user_id", {"user_id": "ryan_id"}),
                ("SET LOCAL app.current_user_email = :email", {"email": "ryan@fynlo.com"}),
                ("SET LOCAL app.current_user_role = :role", {"role": "platform_owner"}),
                ("SET LOCAL app.current_restaurant_id TO DEFAULT", None),
                ("SET LOCAL app.is_platform_owner = :is_owner", {"is_owner": "true"})
            ]
            
            for expected_sql, params in expected_sqls:
                found = False
                for call_sql, call_params in call_sqls:
                    if expected_sql in call_sql and (params is None or params == call_params):
                        found = True
                        break
                assert found, f"Expected SQL '{expected_sql}' with params {params} not found"
            
            # Verify context was stored
            context = current_tenant_context.get()
            assert context is not None
            assert context['user_id'] == "ryan_id"
            assert context['is_platform_owner'] is True
            assert context['restaurant_id'] is None
    
    @pytest.mark.asyncio
    async def test_set_regular_user_context(self, mock_db, regular_user):
        """Test setting context for regular users"""
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            await RLSSessionContext.set_tenant_context(mock_db, regular_user)
            
            # Verify restaurant-specific context was set
            calls = mock_db.execute.call_args_list
            call_sqls = [(str(call[0][0]), call[0][1] if len(call[0]) > 1 else None) for call in calls]
            
            expected_sqls = [
                ("SET LOCAL app.current_user_id = :user_id", {"user_id": "user_123"}),
                ("SET LOCAL app.current_user_email = :email", {"email": "manager@restaurant.com"}),
                ("SET LOCAL app.current_user_role = :role", {"role": "manager"}),
                ("SET LOCAL app.current_restaurant_id = :restaurant_id", {"restaurant_id": "rest_456"}),
                ("SET LOCAL app.is_platform_owner = :is_owner", {"is_owner": "false"})
            ]
            
            for expected_sql, params in expected_sqls:
                found = any(expected_sql in call_sql and params == call_params 
                           for call_sql, call_params in call_sqls)
                assert found, f"Expected SQL '{expected_sql}' not found"
            
            # Verify context
            context = current_tenant_context.get()
            assert context['restaurant_id'] == "rest_456"
            assert context['is_platform_owner'] is False
    
    @pytest.mark.asyncio
    async def test_user_without_restaurant_gets_invalid_context(self, mock_db, user_without_restaurant):
        """Test that users without restaurant get invalid context"""
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            await RLSSessionContext.set_tenant_context(mock_db, user_without_restaurant)
            
            # Should set invalid restaurant ID
            calls = mock_db.execute.call_args_list
            call_sqls = [(str(call[0][0]), call[0][1] if len(call[0]) > 1 else None) for call in calls]
            
            # Check that invalid UUID was set
            found = any("SET LOCAL app.current_restaurant_id = :restaurant_id" in call_sql and 
                       call_params and call_params.get("restaurant_id") == "00000000-0000-0000-0000-000000000000"
                       for call_sql, call_params in call_sqls)
            assert found, "Invalid UUID for restaurant_id not set"
    
    @pytest.mark.asyncio
    async def test_clear_context(self, mock_db):
        """Test clearing RLS context"""
        # Set some context first
        current_tenant_context.set({'user_id': 'test'})
        
        await RLSSessionContext.clear_tenant_context(mock_db)
        
        # Verify all variables were reset
        calls = mock_db.execute.call_args_list
        call_sqls = [str(call[0][0]) for call in calls]
        
        expected_resets = [
            "RESET app.current_user_id",
            "RESET app.current_user_email",
            "RESET app.current_user_role",
            "RESET app.current_restaurant_id",
            "RESET app.is_platform_owner"
        ]
        
        for reset_sql in expected_resets:
            found = any(reset_sql in call_sql for call_sql in call_sqls)
            assert found, f"Expected RESET SQL '{reset_sql}' not found"
        
        # Context should be cleared
        assert current_tenant_context.get() is None
    
    @pytest.mark.asyncio
    async def test_error_handling_in_set_context(self, mock_db, regular_user):
        """Test error handling when setting context fails"""
        # Make execute raise an error
        mock_db.execute.side_effect = Exception("Database error")
        
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            with pytest.raises(Exception) as exc_info:
                await RLSSessionContext.set_tenant_context(mock_db, regular_user)
            
            assert "Failed to set RLS session variables" in str(exc_info.value)
            mock_db.rollback.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_error_handling_in_clear_context(self, mock_db):
        """Test that clear context doesn't raise on errors"""
        # Make execute raise an error
        mock_db.execute.side_effect = Exception("Database error")
        
        # Should not raise, just log
        await RLSSessionContext.clear_tenant_context(mock_db)
        
        # Rollback should be called
        mock_db.rollback.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_ensure_tenant_isolation(self, mock_db, regular_user):
        """Test ensure_tenant_isolation function"""
        with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
            # No context set initially
            assert current_tenant_context.get() is None
            
            # Should set context
            await RLSSessionContext.ensure_tenant_isolation(mock_db, regular_user)
            
            # Context should be set
            context = current_tenant_context.get()
            assert context is not None
            assert context['user_id'] == "user_123"
            
            # Calling again with same user should not reset
            mock_db.execute.reset_mock()
            await RLSSessionContext.ensure_tenant_isolation(mock_db, regular_user)
            
            # Should not have called execute again
            assert mock_db.execute.call_count == 0
    
    def test_get_current_context(self):
        """Test getting current context"""
        # No context initially
        assert RLSSessionContext.get_current_context() is None
        
        # Set context
        test_context = {'user_id': 'test123', 'restaurant_id': 'rest456'}
        current_tenant_context.set(test_context)
        
        # Should return the context
        assert RLSSessionContext.get_current_context() == test_context


class TestRLSDependency:
    """Test the FastAPI dependency for RLS"""
    
    @pytest.mark.asyncio
    async def test_rls_dependency_lifecycle(self):
        """Test that RLS dependency sets and clears context"""
        from app.core.auth import get_current_user
        from app.core.database import get_db
        
        # Mock dependencies
        mock_user = MagicMock(spec=User)
        mock_user.id = "user_123"
        mock_user.email = "test@example.com"
        mock_user.role = "manager"
        mock_user.restaurant_id = "rest_123"
        
        mock_db = MagicMock(spec=Session)
        mock_db.execute = MagicMock()
        mock_db.commit = MagicMock()
        
        with patch('app.core.auth.get_current_user', return_value=mock_user):
            with patch('app.core.database.get_db', return_value=iter([mock_db])):
                with patch.object(TenantSecurity, 'is_platform_owner', return_value=False):
                    # Get the dependency
                    rls_dep = RLSSessionContext.create_rls_dependency()
                    
                    # Simulate FastAPI calling the dependency
                    dep_gen = rls_dep(user=mock_user, db=mock_db, request=None)
                    
                    # Enter the context (sets RLS)
                    db_session = await dep_gen.__anext__()
                    
                    # Context should be set
                    context = current_tenant_context.get()
                    assert context is not None
                    assert context['user_id'] == "user_123"
                    
                    # Exit the context (clears RLS)
                    try:
                        await dep_gen.__anext__()
                    except StopAsyncIteration:
                        pass
                    
                    # Verify clear was called
                    calls = mock_db.execute.call_args_list
                    call_sqls = [str(call[0][0]) for call in calls]
                    
                    expected_resets = [
                        "RESET app.current_user_id",
                        "RESET app.current_user_email",
                        "RESET app.current_user_role",
                        "RESET app.current_restaurant_id",
                        "RESET app.is_platform_owner"
                    ]
                    
                    # At least some RESETs should have been called
                    reset_count = sum(1 for call_sql in call_sqls 
                                    if any(reset in call_sql for reset in expected_resets))
                    assert reset_count > 0, "No RESET commands found"