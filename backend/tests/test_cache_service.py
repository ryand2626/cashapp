"""
Test suite for CacheService and caching functionality
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.core.cache_service import CacheService, CacheMetrics, cached, cache_service
from app.core.redis_client import RedisClient


class TestCacheService:
    """Test CacheService class functionality"""
    
    @pytest.fixture
    def mock_redis(self):
        """Create a mock Redis client"""
        mock = AsyncMock(spec=RedisClient)
        return mock
    
    @pytest.fixture
    def cache_service_instance(self, mock_redis):
        """Create CacheService instance with mocked Redis"""
        service = CacheService()
        service.redis = mock_redis
        return service
    
    def test_cache_key_generation(self, cache_service_instance):
        """Test cache key generation with various inputs"""
        # Basic key generation
        key = cache_service_instance.cache_key("menu", restaurant_id="123")
        assert key == "menu:restaurant_id=123"
        
        # Multiple parameters (should be sorted)
        key = cache_service_instance.cache_key("products", category="tacos", restaurant_id="123")
        assert key == "products:category=tacos:restaurant_id=123"
        
        # Long key should be hashed with restaurant_id preserved
        long_value = "x" * 200
        key = cache_service_instance.cache_key("test", value=long_value, restaurant_id="123")
        assert key.startswith("test:restaurant_id=123:hash:")
        assert len(key) < 150  # Hashed key should be shorter than original
        
        # Long key without restaurant_id uses 'global'
        key = cache_service_instance.cache_key("test", value=long_value)
        assert key.startswith("test:restaurant_id=global:hash:")
    
    @pytest.mark.asyncio
    async def test_cache_get_hit(self, cache_service_instance, mock_redis):
        """Test cache get with a hit"""
        mock_redis.get.return_value = {"test": "data"}
        
        result = await cache_service_instance.get("test_key")
        
        assert result == {"test": "data"}
        mock_redis.get.assert_called_once_with("test_key")
        assert cache_service_instance.metrics.hits == 1
        assert cache_service_instance.metrics.misses == 0
    
    @pytest.mark.asyncio
    async def test_cache_get_miss(self, cache_service_instance, mock_redis):
        """Test cache get with a miss"""
        mock_redis.get.return_value = None
        
        result = await cache_service_instance.get("test_key")
        
        assert result is None
        assert cache_service_instance.metrics.hits == 0
        assert cache_service_instance.metrics.misses == 1
    
    @pytest.mark.asyncio
    async def test_cache_get_error(self, cache_service_instance, mock_redis):
        """Test cache get with Redis error"""
        mock_redis.get.side_effect = Exception("Redis connection error")
        
        result = await cache_service_instance.get("test_key")
        
        assert result is None
        assert cache_service_instance.metrics.errors == 1
    
    @pytest.mark.asyncio
    async def test_cache_set_success(self, cache_service_instance, mock_redis):
        """Test successful cache set"""
        mock_redis.set.return_value = True
        
        result = await cache_service_instance.set("test_key", {"data": "value"}, ttl=3600)
        
        assert result is True
        mock_redis.set.assert_called_once_with("test_key", {"data": "value"}, expire=3600)
    
    @pytest.mark.asyncio
    async def test_cache_set_error(self, cache_service_instance, mock_redis):
        """Test cache set with error"""
        mock_redis.set.side_effect = Exception("Redis error")
        
        result = await cache_service_instance.set("test_key", {"data": "value"})
        
        assert result is False
        assert cache_service_instance.metrics.errors == 1
    
    @pytest.mark.asyncio
    async def test_cache_delete(self, cache_service_instance, mock_redis):
        """Test cache delete"""
        mock_redis.delete.return_value = True
        
        result = await cache_service_instance.delete("test_key")
        
        assert result is True
        mock_redis.delete.assert_called_once_with("test_key")
    
    @pytest.mark.asyncio
    async def test_cache_delete_pattern(self, cache_service_instance, mock_redis):
        """Test cache delete by pattern"""
        mock_redis.delete_pattern.return_value = 5
        
        result = await cache_service_instance.delete_pattern("menu:*")
        
        assert result == 5
        mock_redis.delete_pattern.assert_called_once_with("menu:*")
    
    @pytest.mark.asyncio
    async def test_invalidate_restaurant_cache(self, cache_service_instance, mock_redis):
        """Test invalidating all cache for a restaurant"""
        mock_redis.delete_pattern.return_value = 3
        
        result = await cache_service_instance.invalidate_restaurant_cache("restaurant_123")
        
        # Should call delete_pattern for each cache type
        expected_patterns = [
            "menu_items:*restaurant_id=restaurant_123*",
            "menu_categories:*restaurant_id=restaurant_123*",
            "products:*restaurant_id=restaurant_123*",
            "categories:*restaurant_id=restaurant_123*",
            "settings:*restaurant_id=restaurant_123*",
            "analytics:*restaurant_id=restaurant_123*",
            "*:restaurant_id=restaurant_123:hash:*"
        ]
        
        assert mock_redis.delete_pattern.call_count == len(expected_patterns)
        assert result == len(expected_patterns) * 3  # 3 keys per pattern
    
    @pytest.mark.asyncio
    async def test_invalidate_user_cache(self, cache_service_instance, mock_redis):
        """Test invalidating all cache for a user"""
        mock_redis.delete_pattern.return_value = 2
        
        result = await cache_service_instance.invalidate_user_cache("user_123")
        
        expected_patterns = [
            "user:user_id=user_123*",
            "session:*user_123*",
            "permissions:user_id=user_123*"
        ]
        
        assert mock_redis.delete_pattern.call_count == len(expected_patterns)
        assert result == len(expected_patterns) * 2  # 2 keys per pattern


class TestCacheMetrics:
    """Test CacheMetrics functionality"""
    
    def test_metrics_initialization(self):
        """Test metrics are initialized to zero"""
        metrics = CacheMetrics()
        assert metrics.hits == 0
        assert metrics.misses == 0
        assert metrics.errors == 0
        assert metrics.hit_rate == 0.0
    
    def test_metrics_recording(self):
        """Test recording various metrics"""
        metrics = CacheMetrics()
        
        # Record some hits and misses
        metrics.record_hit()
        metrics.record_hit()
        metrics.record_miss()
        metrics.record_error()
        
        assert metrics.hits == 2
        assert metrics.misses == 1
        assert metrics.errors == 1
        assert metrics.hit_rate == pytest.approx(66.67, 0.01)
    
    def test_metrics_get_all(self):
        """Test getting all metrics"""
        metrics = CacheMetrics()
        metrics.record_hit()
        metrics.record_miss()
        
        all_metrics = metrics.get_metrics()
        
        assert all_metrics["hits"] == 1
        assert all_metrics["misses"] == 1
        assert all_metrics["errors"] == 0
        assert all_metrics["hit_rate"] == "50.00%"
        assert all_metrics["total_requests"] == 2


class TestCachedDecorator:
    """Test the @cached decorator functionality"""
    
    @pytest.mark.asyncio
    async def test_cached_decorator_basic(self):
        """Test basic caching with decorator"""
        call_count = 0
        
        @cached(ttl=60)
        async def test_function(restaurant_id: str):
            nonlocal call_count
            call_count += 1
            return {"restaurant": restaurant_id, "data": "test"}
        
        # Mock the cache service
        with patch.object(cache_service, 'get', return_value=None) as mock_get, \
             patch.object(cache_service, 'set', return_value=True) as mock_set:
            
            # First call should execute function
            result1 = await test_function("123")
            assert call_count == 1
            assert result1["restaurant"] == "123"
            
            # Verify cache operations
            mock_get.assert_called_once()
            mock_set.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cached_decorator_with_hit(self):
        """Test decorator when cache hit occurs"""
        cached_data = {"cached": True}
        
        @cached(ttl=60, prefix="test")
        async def test_function(restaurant_id: str):
            return {"cached": False}
        
        with patch.object(cache_service, 'get', return_value=cached_data):
            result = await test_function("123")
            assert result["cached"] is True
    
    @pytest.mark.asyncio
    async def test_cached_decorator_with_key_params(self):
        """Test decorator with specific key parameters"""
        @cached(ttl=60, prefix="menu", key_params=["restaurant_id", "category"])
        async def get_menu(restaurant_id: str, category: str, db=None):
            return {"restaurant": restaurant_id, "category": category}
        
        with patch.object(cache_service, 'cache_key') as mock_cache_key, \
             patch.object(cache_service, 'get', return_value=None), \
             patch.object(cache_service, 'set', return_value=True):
            
            mock_cache_key.return_value = "menu:restaurant_id=123:category=tacos"
            
            await get_menu("123", "tacos", db=MagicMock())
            
            # Should only include specified parameters
            mock_cache_key.assert_called_with("menu", restaurant_id="123", category="tacos")
    
    @pytest.mark.asyncio
    async def test_cached_decorator_invalidation(self):
        """Test cache invalidation with decorator"""
        @cached(ttl=60, prefix="test", invalidate_on=["force_refresh"])
        async def test_function(restaurant_id: str, force_refresh: bool = False):
            return {"data": "fresh"}
        
        with patch.object(cache_service, 'delete_pattern') as mock_delete, \
             patch.object(cache_service, 'get', return_value=None), \
             patch.object(cache_service, 'set', return_value=True):
            
            # Call with invalidation
            await test_function("123", force_refresh=True)
            
            mock_delete.assert_called_once_with("test*")
    
    @pytest.mark.asyncio
    async def test_cached_decorator_complex_params(self):
        """Test decorator with complex parameter types"""
        class User:
            def __init__(self, id, name):
                self.id = id
                self.name = name
        
        @cached(ttl=60)
        async def get_user_data(user: User, include_details: bool = True):
            return {"user_id": user.id, "details": include_details}
        
        with patch.object(cache_service, 'get', return_value=None), \
             patch.object(cache_service, 'set', return_value=True), \
             patch.object(cache_service, 'cache_key') as mock_cache_key:
            
            user = User(123, "Test User")
            await get_user_data(user)
            
            # Complex objects should be converted to string
            call_args = mock_cache_key.call_args[1]
            assert isinstance(call_args["user"], str)


class TestCacheWarming:
    """Test cache warming functionality"""
    
    @pytest.mark.asyncio
    async def test_warm_menu_cache(self):
        """Test warming menu cache"""
        from app.core.cache_service import warm_menu_cache
        
        # Mock database and models
        mock_db = MagicMock()
        mock_restaurant = MagicMock(id="rest_123", is_active=True)
        mock_menu_item = MagicMock(
            id="item_123",
            name="Test Item",
            description="Test description",
            price=10.99,
            category_id="cat_123",
            image_url="http://example.com/image.jpg",
            is_active=True
        )
        
        # Setup query chain
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_restaurant]
        
        with patch.object(cache_service, 'set', return_value=True) as mock_set:
            
            # Configure nested query for menu items
            mock_db.query.side_effect = [
                MagicMock(filter=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[mock_restaurant])))),
                MagicMock(filter=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[mock_menu_item]))))
            ]
            
            result = await warm_menu_cache(mock_db)
            
            assert result == 1
            mock_set.assert_called_once()
    
    # Test removed - RestaurantSettings model not available in current codebase


@pytest.mark.asyncio
async def test_cache_integration():
    """Integration test with real cache operations"""
    # This would require a test Redis instance
    # Skipping for now as it requires infrastructure
    pass