"""
Test HTTPException to FynloException migration

This test module verifies that all core security modules properly use
FynloException instead of HTTPException.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.exceptions import FynloException, AuthenticationException, AuthorizationException
from app.core.auth import get_current_user, get_current_active_user, get_platform_owner, get_restaurant_user
from app.core.tenant_security import TenantSecurity
from app.core.two_factor_auth import TwoFactorAuth
from app.core.dependencies import get_db, platform_owner_required
from app.core.production_guard import production_guard
from app.models import User, Restaurant


class TestFynloExceptionMigration:
    """Test that all core modules use FynloException"""

    @pytest.mark.asyncio
    async def test_auth_get_current_user_raises_fynlo_exception(self):
        """Test that get_current_user raises FynloException for auth failures"""
        # Mock request and dependencies
        mock_request = Mock(spec=Request)
        mock_db = Mock(spec=Session)
        
        # Test missing authorization header
        with pytest.raises(AuthenticationException) as exc_info:
            await get_current_user(mock_request, None, mock_db)
        
        assert exc_info.value.status_code == 401
        assert exc_info.value.error_code == "INVALID_CREDENTIALS"  # AuthenticationException default
        assert "Authentication required" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_auth_invalid_token_raises_fynlo_exception(self):
        """Test that invalid tokens raise FynloException"""
        mock_request = Mock(spec=Request)
        mock_db = Mock(spec=Session)
        
        # Test invalid bearer token
        with pytest.raises(AuthenticationException) as exc_info:
            await get_current_user(mock_request, "Bearer invalid_token", mock_db)
        
        assert exc_info.value.status_code == 401
        assert exc_info.value.error_code == "INVALID_CREDENTIALS"

    @pytest.mark.asyncio
    async def test_get_current_active_user_raises_fynlo_exception(self):
        """Test that get_current_active_user raises FynloException for inactive users"""
        # Create inactive user
        inactive_user = User(id="test-user", is_active=False)
        
        with pytest.raises(FynloException) as exc_info:
            await get_current_active_user(inactive_user)
        
        assert exc_info.value.status_code == 400
        assert exc_info.value.error_code == "BAD_REQUEST"
        assert "Inactive user" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_get_platform_owner_raises_fynlo_exception(self):
        """Test that get_platform_owner raises FynloException for non-platform owners"""
        # Create non-platform-owner user
        regular_user = User(id="test-user", role="employee", is_active=True)
        
        with pytest.raises(AuthorizationException) as exc_info:
            await get_platform_owner(regular_user)
        
        assert exc_info.value.status_code == 403
        assert exc_info.value.error_code == "FORBIDDEN"
        assert "platform owner" in str(exc_info.value.message).lower()

    @pytest.mark.asyncio
    async def test_get_restaurant_user_raises_fynlo_exception(self):
        """Test that get_restaurant_user raises FynloException for users without restaurant"""
        mock_db = Mock(spec=Session)
        
        # User without restaurant
        user_no_restaurant = User(id="test-user", role="employee", is_active=True, restaurant_id=None)
        
        with pytest.raises(AuthorizationException) as exc_info:
            await get_restaurant_user(user_no_restaurant, mock_db)
        
        assert exc_info.value.status_code == 403
        assert exc_info.value.error_code == "FORBIDDEN"
        assert "not associated with any restaurant" in str(exc_info.value.message)

    def test_tenant_security_validate_access_raises_fynlo_exception(self):
        """Test that TenantSecurity.validate_access raises FynloException for access violations"""
        mock_db = Mock(spec=Session)
        tenant_security = TenantSecurity()
        
        # User trying to access different restaurant
        user = User(id="user1", restaurant_id="restaurant1")
        
        with pytest.raises(AuthorizationException) as exc_info:
            tenant_security.validate_access(mock_db, user, "restaurant2", "orders")
        
        assert exc_info.value.status_code == 403
        assert exc_info.value.error_code == "FORBIDDEN"
        assert "access denied" in str(exc_info.value.message).lower()

    def test_platform_owner_access_validation_raises_fynlo_exception(self):
        """Test that TenantSecurity.validate_platform_owner_access raises FynloException"""
        tenant_security = TenantSecurity()
        
        # Non-platform owner trying to access platform resources
        user = User(id="user1", role="restaurant_owner")
        
        with pytest.raises(AuthorizationException) as exc_info:
            tenant_security.validate_platform_owner_access(user)
        
        assert exc_info.value.status_code == 403
        assert exc_info.value.error_code == "FORBIDDEN"
        assert "platform owner access required" in str(exc_info.value.message).lower()

    @pytest.mark.asyncio
    async def test_two_factor_auth_raises_fynlo_exception(self):
        """Test that TwoFactorAuth methods raise FynloException"""
        two_fa = TwoFactorAuth()
        mock_db = Mock(spec=Session)
        
        # Test invalid 2FA token
        with pytest.raises(FynloException) as exc_info:
            await two_fa.validate_two_factor_token(
                db=mock_db,
                user_id="test-user",
                token="invalid"
            )
        
        assert exc_info.value.status_code == 400
        assert exc_info.value.error_code == "BAD_REQUEST"

    @pytest.mark.asyncio
    async def test_dependencies_platform_owner_required_raises_fynlo_exception(self):
        """Test that platform_owner_required raises FynloException for non-platform owners"""
        # Create non-platform owner user
        regular_user = User(id="test-user", role="restaurant_owner", is_active=True)
        
        with pytest.raises(AuthenticationException) as exc_info:
            await platform_owner_required(regular_user)
        
        assert exc_info.value.status_code == 401
        assert exc_info.value.error_code == "INVALID_CREDENTIALS"
        assert "Authentication failed" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_production_guard_raises_fynlo_exception(self):
        """Test that production guard decorator raises FynloException in production"""
        # Create a test function with production guard
        @production_guard
        async def test_function():
            return "This should not execute in production"
        
        with patch('app.core.config.settings.ENVIRONMENT', 'production'):
            with pytest.raises(FynloException) as exc_info:
                await test_function()
            
            assert exc_info.value.status_code == 403
            assert exc_info.value.error_code == "OPERATION_NOT_ALLOWED"
            assert "production environment" in str(exc_info.value.message).lower()

    @pytest.mark.asyncio
    async def test_exception_chain_preserves_fynlo_exception(self):
        """Test that FynloException is preserved through the exception chain"""
        # Create a scenario where auth fails and exception propagates
        mock_request = Mock(spec=Request)
        mock_db = Mock(spec=Session)
        
        # This should raise FynloException, not HTTPException
        try:
            await get_current_user(mock_request, "Bearer expired_token", mock_db)
            assert False, "Should have raised exception"
        except Exception as e:
            # Verify it's FynloException, not HTTPException
            assert isinstance(e, FynloException)
            assert not type(e).__name__ == "HTTPException"
            assert hasattr(e, 'error_code')  # FynloException has error_code attribute