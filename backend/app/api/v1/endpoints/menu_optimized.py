"""
Optimized Menu API endpoints with caching and performance improvements
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, Session
from sqlalchemy import select, func, and_
import json
import asyncio
from datetime import datetime
import logging

from app.core.database import get_db, Product, Category, User
from app.core.redis_client import get_redis, RedisClient
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

logger = logging.getLogger(__name__)
router = APIRouter()


class MenuItemResponse:
    """Response model for menu items"""
    def __init__(self, product, category_name=None):
        self.id = str(product.id)
        self.name = product.name
        self.description = product.description
        self.price = float(product.price)
        self.category_id = str(product.category_id)
        self.category_name = category_name or (product.category.name if product.category else None)
        self.is_active = product.is_active
        self.sort_order = product.sort_order
        self.image_url = product.image_url
        self.modifiers = product.modifiers or []
        self.variants = []
        if hasattr(product, 'variants') and product.variants:
            self.variants = [
                {
                    "id": str(v.id),
                    "name": v.name,
                    "price": float(v.price),
                    "sku": v.sku
                } for v in product.variants
            ]
        self.allergens = product.dietary_info if hasattr(product, 'dietary_info') else []
        self.nutritional_info = {}
        self.preparation_time = product.prep_time if hasattr(product, 'prep_time') else 0
        self.created_at = product.created_at.isoformat()
        self.updated_at = product.updated_at.isoformat()
    
    def dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "is_active": self.is_active,
            "sort_order": self.sort_order,
            "image_url": self.image_url,
            "modifiers": self.modifiers,
            "variants": self.variants,
            "allergens": self.allergens,
            "nutritional_info": self.nutritional_info,
            "preparation_time": self.preparation_time,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


class CategoryResponse:
    """Response model for categories"""
    def __init__(self, category, product_count=0):
        self.id = str(category.id)
        self.name = category.name
        self.description = category.description
        self.sort_order = category.sort_order
        self.icon = category.icon
        self.product_count = product_count
        self.created_at = category.created_at.isoformat() if hasattr(category, 'created_at') else datetime.now().isoformat()
        self.updated_at = category.updated_at.isoformat() if hasattr(category, 'updated_at') else datetime.now().isoformat()
    
    def dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "sort_order": self.sort_order,
            "icon": self.icon,
            "product_count": self.product_count,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


@router.get("/menu", response_model=List[dict])
async def get_menu_items_optimized(
    restaurant_id: Optional[str] = Query(None, description="Restaurant ID"),
    category: Optional[str] = Query(None, description="Category ID filter"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    redis_client: RedisClient = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """
    Get menu items with optimized performance
    - Eager loading to prevent N+1 queries
    - Redis caching with smart invalidation
    - Pagination for large menus
    - Query timeout protection
    """
    try:
        # Use current user's restaurant context
        user_restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
        if not user_restaurant_id:
            raise FynloException(
                message="User must be assigned to a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="access",
                resource_type="menu",
                resource_id=None,
                db=db
            )
        # Build cache key
        cache_key = f"menu:v3:{restaurant_id}:{category or 'all'}:{page}:{limit}:{include_inactive}"
        
        # Try cache first
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    logger.info(f"Menu cache hit for restaurant {restaurant_id}")
                    return APIResponseHelper.success(
                        data=json.loads(cached_data),
                        message="Menu retrieved from cache"
                    )
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")
        
        # Build optimized query with eager loading
        query = db.query(Product).options(
            selectinload(Product.category),
            selectinload(Product.modifiers),
            selectinload(Product.variants),
            selectinload(Product.images)
        ).filter(Product.restaurant_id == restaurant_id)
        
        # Apply filters
        if not include_inactive:
            query = query.filter(Product.is_active == True)
        
        if category:
            query = query.filter(Product.category_id == category)
        
        # Add consistent ordering
        query = query.order_by(
            Product.sort_order.asc(),
            Product.name.asc()
        )
        
        # Apply pagination
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        # Execute query
        products = query.all()
        
        # Transform to response format
        response_data = [
            MenuItemResponse(product).dict()
            for product in products
        ]
        
        # Cache for 5 minutes
        if redis_client and response_data:
            try:
                redis_client.setex(
                    cache_key,
                    300,  # 5 minutes TTL
                    json.dumps(response_data)
                )
            except Exception as e:
                logger.warning(f"Failed to cache menu: {e}")
        
        return APIResponseHelper.success(
            data=response_data,
            message="Menu retrieved successfully",
            meta={
                "page": page,
                "limit": limit,
                "has_more": len(products) == limit
            }
        )
        
    except Exception as e:
        logger.error(f"Menu query error for restaurant {restaurant_id}: {str(e)}")
        raise FynloException(
            message="Failed to retrieve menu items",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )


@router.get("/menu/categories", response_model=List[dict])
async def get_menu_categories(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    redis_client: RedisClient = Depends(get_redis),
    current_user: User = Depends(get_current_user)
):
    """Get menu categories with product counts"""
    try:
        # Use current user's restaurant context
        user_restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
        if not user_restaurant_id:
            raise FynloException(
                message="User must be assigned to a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="access",
                resource_type="menu",
                resource_id=None,
                db=db
            )
        cache_key = f"menu_categories:v2:{restaurant_id}"
        
        # Try cache
        if redis_client:
            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    return APIResponseHelper.success(
                        data=json.loads(cached_data),
                        message="Categories retrieved from cache"
                    )
            except Exception as e:
                logger.warning(f"Redis cache error: {e}")
        
        # Query with product counts using subquery for performance
        categories_query = db.query(
            Category,
            func.count(Product.id).label('product_count')
        ).outerjoin(
            Product,
            and_(
                Product.category_id == Category.id,
                Product.is_active == True
            )
        ).filter(
            Category.restaurant_id == restaurant_id,
            Category.is_active == True
        ).group_by(
            Category.id
        ).order_by(Category.sort_order.asc())
        
        categories_data = categories_query.all()
        
        response_data = [
            CategoryResponse(cat, product_count).dict()
            for cat, product_count in categories_data
        ]
        
        # Cache for 10 minutes
        if redis_client and response_data:
            try:
                redis_client.setex(
                    cache_key,
                    600,  # 10 minutes TTL
                    json.dumps(response_data)
                )
            except Exception as e:
                logger.warning(f"Failed to cache categories: {e}")
        
        return APIResponseHelper.success(
            data=response_data,
            message="Categories retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Category query error for restaurant {restaurant_id}: {str(e)}")
        raise FynloException(
            message="Failed to retrieve categories",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )


@router.post("/menu/cache/invalidate")
async def invalidate_menu_cache(
    restaurant_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    redis_client: RedisClient = Depends(get_redis),
    db: Session = Depends(get_db)
):
    """Invalidate menu cache for a restaurant"""
    try:
        # Use current user's restaurant context
        user_restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
        if not user_restaurant_id:
            raise FynloException(
                message="User must be assigned to a restaurant",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Use provided restaurant_id or fallback to user's current restaurant
        if not restaurant_id:
            restaurant_id = str(user_restaurant_id)
        else:
            # Validate that user has access to the requested restaurant
            from app.core.tenant_security import TenantSecurity
            await TenantSecurity.validate_restaurant_access(
                user=current_user,
                restaurant_id=restaurant_id,
                operation="modify",
                resource_type="menu_cache",
                resource_id=None,
                db=db
            )
        
        if not redis_client:
            return APIResponseHelper.success(
                message="Cache not available"
            )
        
        # Invalidate all menu caches for restaurant
        patterns = [
            f"menu:*:{restaurant_id}:*",
            f"menu_categories:*:{restaurant_id}"
        ]
        
        deleted_count = 0
        for pattern in patterns:
            try:
                keys = redis_client.keys(pattern)
                if keys:
                    deleted_count += redis_client.delete(*keys)
            except Exception as e:
                logger.error(f"Cache invalidation error: {e}")
        
        return APIResponseHelper.success(
            message=f"Menu cache invalidated ({deleted_count} keys cleared)",
            meta={"deleted_keys": deleted_count}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cache invalidation error: {str(e)}")
        raise FynloException(
            message="Failed to invalidate cache",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )
