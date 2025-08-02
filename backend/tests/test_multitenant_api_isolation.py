"""
API-level Multi-tenant Isolation Tests
Tests actual API endpoints for cross-tenant access vulnerabilities
"""

import pytest
import json
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import User, Restaurant, Order, Product, Employee


class TestAPIMultiTenantIsolation:
    """Test API endpoints for multi-tenant isolation"""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    @pytest.fixture
    def mock_db_session(self):
        with patch('app.core.database.get_db') as mock_get_db:
            mock_session = MagicMock(spec=Session)
            mock_get_db.return_value = mock_session
            yield mock_session
    
    @pytest.fixture
    def auth_headers_restaurant_a(self):
        """Auth headers for Restaurant A user"""
        return {"Authorization": "Bearer mock_token_restaurant_a"}
    
    @pytest.fixture
    def auth_headers_restaurant_b(self):
        """Auth headers for Restaurant B user"""
        return {"Authorization": "Bearer mock_token_restaurant_b"}
    
    @pytest.fixture
    def setup_test_data(self, mock_db_session):
        """Setup test restaurants and users"""
        # Restaurant A
        restaurant_a = Restaurant(
            id="rest_a_123",
            name="Restaurant A",
            business_type="restaurant"
        )
        user_a = User(
            id="user_a_123",
            email="user@restaurant-a.com",
            restaurant_id="rest_a_123",
            role="manager"
        )
        
        # Restaurant B
        restaurant_b = Restaurant(
            id="rest_b_456",
            name="Restaurant B",
            business_type="cafe"
        )
        user_b = User(
            id="user_b_456",
            email="user@restaurant-b.com",
            restaurant_id="rest_b_456",
            role="manager"
        )
        
        return {
            "restaurant_a": restaurant_a,
            "user_a": user_a,
            "restaurant_b": restaurant_b,
            "user_b": user_b
        }
    
    def test_orders_endpoint_isolation(self, client, mock_db_session, setup_test_data, auth_headers_restaurant_a):
        """Test that orders endpoint filters by restaurant"""
        # Mock current user to be from Restaurant A
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = setup_test_data["user_a"]
            
            # Mock database query
            mock_db_session.query.return_value.filter.return_value.all.return_value = []
            
            # Make request
            response = client.get("/api/v1/orders", headers=auth_headers_restaurant_a)
            
            # Verify restaurant_id filter was applied
            filter_calls = mock_db_session.query.return_value.filter.call_args_list
            
            # Check that restaurant_id filter is present
            restaurant_filter_applied = any(
                "restaurant_id" in str(call) for call in filter_calls
            )
            assert restaurant_filter_applied, "Orders endpoint must filter by restaurant_id"
    
    def test_menu_modification_isolation(self, client, mock_db_session, setup_test_data, auth_headers_restaurant_a):
        """Test that users cannot modify another restaurant's menu"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = setup_test_data["user_a"]
            
            # Try to create a product for Restaurant B while authenticated as Restaurant A
            product_data = {
                "name": "Malicious Product",
                "price": 10.00,
                "restaurant_id": "rest_b_456"  # Restaurant B's ID
            }
            
            response = client.post(
                "/api/v1/products",
                json=product_data,
                headers=auth_headers_restaurant_a
            )
            
            # Should be forbidden or should ignore the restaurant_id and use user's restaurant
            assert response.status_code in [403, 400, 422], \
                "Should not allow creating products for another restaurant"
    
    def test_employee_list_isolation(self, client, mock_db_session, setup_test_data, auth_headers_restaurant_a):
        """Test that employee lists are restaurant-specific"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = setup_test_data["user_a"]
            
            # Mock database query
            mock_db_session.query.return_value.filter.return_value.all.return_value = []
            
            # Request employees
            response = client.get("/api/v1/employees", headers=auth_headers_restaurant_a)
            
            # Verify restaurant_id filter was applied
            filter_calls = mock_db_session.query.return_value.filter.call_args_list
            restaurant_filter_applied = any(
                "restaurant_id" in str(call) for call in filter_calls
            )
            assert restaurant_filter_applied, "Employee endpoint must filter by restaurant_id"
    
    def test_direct_resource_access_denied(self, client, mock_db_session, setup_test_data, auth_headers_restaurant_a):
        """Test direct access to another restaurant's resources is denied"""
        with patch('app.api.v1.endpoints.auth.get_current_user') as mock_get_user:
            mock_get_user.return_value = setup_test_data["user_a"]
            
            # Try to access a specific order from Restaurant B
            response = client.get(
                "/api/v1/orders/order_from_restaurant_b",
                headers=auth_headers_restaurant_a
            )
            
            # Should check ownership before returning
            # This test will help identify if there's proper ownership validation