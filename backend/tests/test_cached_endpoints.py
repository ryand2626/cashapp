"""
Integration tests for cached endpoints
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import User, Restaurant, Category, Product, get_db
from app.core.cache_service import cache_service
from app.core.auth import get_current_user
from app.main import app


class TestCachedMenuEndpoints:
    """Test menu endpoints with caching"""
    
    @pytest.fixture
    def mock_current_user(self):
        """Create mock current user"""
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.restaurant_id = "rest_123"
        user.current_restaurant_id = "rest_123"
        user.role = "manager"
        return user
    
    @pytest.fixture
    def mock_db(self):
        """Create mock database session"""
        return MagicMock(spec=Session)
    
    @pytest.fixture
    def mock_menu_items(self):
        """Create mock menu items"""
        items = []
        for i in range(5):
            item = MagicMock(spec=Product)
            item.id = f"item_{i}"
            item.name = f"Item {i}"
            item.description = f"Description {i}"
            item.price = 10.0 + i
            item.category_id = "cat_1"
            item.image_url = f"http://example.com/item_{i}.jpg"
            item.is_active = True
            item.is_active = True
            items.append(item)
        return items
    
    @pytest.fixture
    def mock_categories(self):
        """Create mock categories"""
        categories = []
        for i in range(3):
            cat = MagicMock(spec=Category)
            cat.id = f"cat_{i}"
            cat.name = f"Category {i}"
            cat.description = f"Category {i} description"
            cat.is_active = True
            cat.sort_order = i
            categories.append(cat)
        return categories
    
    @pytest.fixture
    def client(self, mock_current_user, mock_db):
        """Create test client with dependency overrides"""
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        app.dependency_overrides[get_db] = lambda: mock_db
        
        with TestClient(app) as client:
            yield client
        
        # Clean up
        app.dependency_overrides.clear()
    
    @pytest.mark.asyncio
    async def test_get_menu_items_cache_miss(self, client, mock_db, mock_menu_items, mock_categories):
        """Test getting menu items with cache miss"""
        # Setup database mocks
        mock_db.query.return_value.filter.return_value.join.return_value.order_by.return_value.all.return_value = mock_menu_items
        mock_db.query.return_value.filter.return_value.all.return_value = mock_categories
        
        # Mock cache miss
        with patch.object(cache_service, 'get', return_value=None) as mock_get, \
             patch.object(cache_service, 'set', return_value=True) as mock_set:
            
            response = client.get("/api/v1/menu/items?restaurant_id=rest_123")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "success"
            assert len(data["data"]) == 5
            assert data["data"][0]["name"] == "Item 0"
            
            # Verify cache operations
            mock_get.assert_called_once()
            mock_set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_menu_items_cache_hit(self, client, mock_db):
        """Test getting menu items with cache hit"""
        cached_data = [
            {
                "id": "item_1",
                "name": "Cached Item",
                "price": 15.99,
                "icon": "restaurant",
                "emoji": "🍽️",
                "available": True,
                "category": "Cached Category",
                "description": "From cache"
            }
        ]
        
        # Mock cache hit
        with patch.object(cache_service, 'get', return_value=cached_data) as mock_get:
            response = client.get("/api/v1/menu/items?restaurant_id=rest_123")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "success"
            assert len(data["data"]) == 1
            assert data["data"][0]["name"] == "Cached Item"
            assert data["data"][0]["description"] == "From cache"
            
            # Database should not be queried
            mock_db.query.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_get_menu_items_with_category_filter(self, client, mock_db, mock_menu_items, mock_categories):
        """Test getting menu items filtered by category"""
        # Setup category mock
        category = mock_categories[0]
        category.name = "Tacos"
        
        mock_db.query.return_value.filter.return_value.first.return_value = category
        mock_db.query.return_value.filter.return_value.join.return_value.order_by.return_value.all.return_value = mock_menu_items[:2]
        
        with patch.object(cache_service, 'get', return_value=None), \
             patch.object(cache_service, 'set', return_value=True):
            
            response = client.get("/api/v1/menu/items?restaurant_id=rest_123&category=Tacos")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "success"
            assert len(data["data"]) == 2
            assert data["meta"]["category_filter"] == "Tacos"
    
    @pytest.mark.asyncio
    async def test_get_menu_categories_cache_miss(self, client, mock_db, mock_categories):
        """Test getting menu categories with cache miss"""
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_categories
        
        with patch.object(cache_service, 'get', return_value=None) as mock_get, \
             patch.object(cache_service, 'set', return_value=True) as mock_set:
            
            response = client.get("/api/v1/menu/categories?restaurant_id=rest_123")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "success"
            # Should have categories + 'All'
            assert len(data["data"]) == 4
            assert data["data"][0]["name"] == "All"
            
            # Verify cache operations
            mock_get.assert_called_once()
            mock_set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_menu_categories_cache_hit(self, client, mock_db):
        """Test getting menu categories with cache hit"""
        cached_categories = [
            {"id": 1, "name": "All", "active": True},
            {"id": 2, "name": "Cached Category", "active": True}
        ]
        
        with patch.object(cache_service, 'get', return_value=cached_categories):
            response = client.get("/api/v1/menu/categories?restaurant_id=rest_123")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["status"] == "success"
            assert len(data["data"]) == 2
            assert data["data"][1]["name"] == "Cached Category"
            
            # Database should not be queried
            mock_db.query.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_menu_items_performance_logging(self, client, mock_db, mock_menu_items, mock_categories):
        """Test performance logging for slow queries"""
        # Create many items to simulate slow query
        many_items = mock_menu_items * 100  # 500 items
        
        mock_db.query.return_value.filter.return_value.join.return_value.order_by.return_value.all.return_value = many_items
        mock_db.query.return_value.filter.return_value.all.return_value = mock_categories
        
        with patch.object(cache_service, 'get', return_value=None), \
             patch.object(cache_service, 'set', return_value=True), \
             patch('time.time', side_effect=[0, 0, 6]):  # Simulate 6 second execution
            
            response = client.get("/api/v1/menu/items?restaurant_id=rest_123")
            
            assert response.status_code == 200
            data = response.json()
            
            assert data["meta"]["execution_time_ms"] == 6000
            assert len(data["data"]) == 500


class TestCacheInvalidation:
    """Test cache invalidation when data changes"""
    
    @pytest.fixture
    def mock_current_user(self):
        """Create mock current user"""
        user = MagicMock(spec=User)
        user.id = "user_123"
        user.restaurant_id = "rest_123"
        user.role = "manager"
        return user
    
    @pytest.fixture
    def client(self, mock_current_user):
        """Create test client with dependency overrides"""
        mock_db = MagicMock(spec=Session)
        
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        app.dependency_overrides[get_db] = lambda: mock_db
        
        with TestClient(app) as client:
            yield client
        
        app.dependency_overrides.clear()
    
    @pytest.mark.asyncio
    async def test_product_create_invalidates_cache(self, client):
        """Test that creating a product invalidates cache"""
        with patch.object(cache_service, 'invalidate_restaurant_cache') as mock_invalidate:
            # Mock successful product creation
            with patch('app.api.v1.endpoints.products.db') as mock_db:
                mock_category = MagicMock(id="cat_123")
                mock_db.query.return_value.filter.return_value.first.return_value = mock_category
                
                product_data = {
                    "category_id": "cat_123",
                    "name": "New Product",
                    "price": 12.99
                }
                
                response = client.post(
                    "/api/v1/products/?restaurant_id=rest_123",
                    json=product_data
                )
                
                # Product creation should trigger cache invalidation
                mock_invalidate.assert_called_once_with("rest_123")
    
    @pytest.mark.asyncio
    async def test_category_update_invalidates_cache(self, client):
        """Test that updating a category invalidates cache"""
        with patch.object(cache_service, 'invalidate_restaurant_cache') as mock_invalidate:
            # Mock successful category update
            with patch('app.api.v1.endpoints.products.db') as mock_db:
                mock_category = MagicMock(id="cat_123", restaurant_id="rest_123")
                mock_db.query.return_value.filter.return_value.first.return_value = mock_category
                
                category_data = {
                    "name": "Updated Category",
                    "color": "#FF0000"
                }
                
                response = client.put(
                    "/api/v1/products/categories/cat_123",
                    json=category_data
                )
                
                # Category update should trigger cache invalidation
                mock_invalidate.assert_called_once_with("rest_123")


class TestCacheMetricsEndpoint:
    """Test cache metrics endpoint"""
    
    @pytest.mark.asyncio
    async def test_get_cache_metrics(self):
        """Test getting cache metrics"""
        # This would be a new endpoint to implement
        # Skip for now as it's not in the current implementation
        pass


@pytest.mark.asyncio
async def test_concurrent_cache_access():
    """Test concurrent access to cached endpoints"""
    # Test that multiple concurrent requests handle caching correctly
    # This would require more complex setup with asyncio
    pass