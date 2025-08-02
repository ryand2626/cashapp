"""
Test Platform Owner Access for Ryan and Arnaud
Ensures platform owners maintain full access while others are restricted
"""

import pytest
from unittest.mock import MagicMock
from app.core.tenant_security import TenantSecurity
from app.models import User


class TestPlatformOwnerAccess:
    """Test that Ryan and Arnaud have full platform access"""
    
    def test_ryan_is_platform_owner(self):
        """Verify Ryan is recognized as platform owner"""
        ryan = MagicMock(spec=User)
        ryan.email = "ryan@fynlo.com"
        ryan.role = "platform_owner"
        ryan.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(ryan) is True
        
    def test_arnaud_is_platform_owner(self):
        """Verify Arnaud is recognized as platform owner"""
        arnaud = MagicMock(spec=User)
        arnaud.email = "arnaud@fynlo.com"
        arnaud.role = "platform_owner"
        arnaud.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(arnaud) is True
        
    def test_alternate_emails_work(self):
        """Verify alternate emails for platform owners work"""
        # Ryan's alternate email
        ryan_alt = MagicMock(spec=User)
        ryan_alt.email = "ryand2626@gmail.com"
        ryan_alt.role = "platform_owner"
        ryan_alt.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(ryan_alt) is True
        
        # Arnaud's alternate email
        arno_alt = MagicMock(spec=User)
        arno_alt.email = "arno@fynlo.com"
        arno_alt.role = "platform_owner"
        arno_alt.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(arno_alt) is True
        
    def test_platform_owner_requires_both_role_and_email(self):
        """Verify BOTH role AND email must match for platform owner access"""
        # Correct email but wrong role - should be denied
        fake_owner1 = MagicMock(spec=User)
        fake_owner1.email = "ryan@fynlo.com"
        fake_owner1.role = "manager"  # Wrong role!
        fake_owner1.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(fake_owner1) is False
        
        # Correct role but wrong email - should be denied
        fake_owner2 = MagicMock(spec=User)
        fake_owner2.email = "hacker@evil.com"  # Wrong email!
        fake_owner2.role = "platform_owner"
        fake_owner2.restaurant_id = None
        
        assert TenantSecurity.is_platform_owner(fake_owner2) is False
        
    def test_ryan_can_access_any_restaurant(self):
        """Verify Ryan can access any restaurant's data"""
        ryan = MagicMock(spec=User)
        ryan.email = "ryan@fynlo.com"
        ryan.role = "platform_owner"
        ryan.restaurant_id = None
        
        # Should not raise any exception
        TenantSecurity.validate_restaurant_access(ryan, "restaurant_123")
        TenantSecurity.validate_restaurant_access(ryan, "restaurant_456")
        TenantSecurity.validate_restaurant_access(ryan, "any_restaurant_id")
        
    def test_regular_user_cannot_access_other_restaurants(self):
        """Verify regular users are restricted to their own restaurant"""
        regular_user = MagicMock(spec=User)
        regular_user.email = "manager@pizzaplace.com"
        regular_user.role = "manager"
        regular_user.restaurant_id = "pizza_place_id"
        
        # Can access own restaurant
        TenantSecurity.validate_restaurant_access(regular_user, "pizza_place_id")
        
        # Cannot access other restaurants
        with pytest.raises(Exception) as exc_info:
            TenantSecurity.validate_restaurant_access(regular_user, "coffee_shop_id")
        # Check the detail attribute of HTTPException
        assert hasattr(exc_info.value, 'detail')
        assert "Access denied" in exc_info.value.detail
        
    def test_platform_owners_see_all_data_in_queries(self):
        """Verify platform owners bypass query filters"""
        ryan = MagicMock(spec=User)
        ryan.email = "ryan@fynlo.com"
        ryan.role = "platform_owner"
        ryan.restaurant_id = None
        
        # Mock query
        mock_query = MagicMock()
        
        # Platform owners should get unfiltered query
        result = TenantSecurity.apply_tenant_filter(mock_query, ryan, MagicMock())
        assert result == mock_query  # Query unchanged
        mock_query.filter.assert_not_called()  # No filter applied
        
    def test_regular_users_get_filtered_queries(self):
        """Verify regular users only see their restaurant's data"""
        regular_user = MagicMock(spec=User)
        regular_user.email = "staff@restaurant.com"
        regular_user.role = "employee"
        regular_user.restaurant_id = "rest_123"
        
        # Mock query and model
        mock_query = MagicMock()
        mock_model = MagicMock()
        mock_model.restaurant_id = "restaurant_id_field"
        
        # Regular users should get filtered query
        TenantSecurity.apply_tenant_filter(mock_query, regular_user, mock_model)
        mock_query.filter.assert_called()  # Filter was applied
        
    def test_cross_restaurant_operations_platform_only(self):
        """Verify only platform owners can do cross-restaurant operations"""
        ryan = MagicMock(spec=User)
        ryan.email = "ryan@fynlo.com"
        ryan.role = "platform_owner"
        ryan.restaurant_id = None
        
        # Platform owner can transfer between restaurants
        TenantSecurity.validate_cross_restaurant_operation(
            ryan, "restaurant_a", "restaurant_b", "transfer"
        )
        
        # Regular user cannot
        regular_user = MagicMock(spec=User)
        regular_user.email = "manager@restaurant.com"
        regular_user.role = "manager"
        regular_user.restaurant_id = "restaurant_a"
        
        with pytest.raises(Exception) as exc_info:
            TenantSecurity.validate_cross_restaurant_operation(
                regular_user, "restaurant_a", "restaurant_b", "transfer"
            )
        # Check the detail attribute of HTTPException
        assert hasattr(exc_info.value, 'detail')
        assert "Only platform owners" in exc_info.value.detail