"""
Menu API endpoints for Fynlo POS - Dedicated menu endpoints for frontend compatibility
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
import time
import logging

from app.core.database import get_db, Product, Category, User
from app.core.auth import get_current_user
from app.core.redis_client import get_redis, RedisClient
from app.core.responses import APIResponseHelper
from app.api.v1.endpoints.products import CategoryResponse, ProductResponse
from app.core.onboarding_helper import OnboardingHelper
from app.core.cache_service import cache_service, cached

router = APIRouter()
logger = logging.getLogger(__name__)

def format_menu_item(product, category_name=None):
    """Format product as menu item with required fields"""
    # Map category names to professional icons (Material Design Icons)
    icon_map = {
        'Tacos': 'restaurant',
        'Special Tacos': 'star',
        'Appetizers': 'restaurant-menu',
        'Snacks': 'restaurant-menu',
        'Beverages': 'local-drink', 
        'Drinks': 'local-drink',
        'Desserts': 'cake',
        'Main Courses': 'restaurant',
        'Sides': 'restaurant-menu',
        'Breakfast': 'restaurant',
        'Salads': 'eco',
        'Soups': 'soup',
        'Burritos': 'restaurant-menu',
        'Alcohol': 'local-bar',
        'Coffee': 'local-cafe',
        'Tea': 'local-cafe',
    }
    
    # Legacy emoji mapping for backward compatibility (will be phased out)
    emoji_map = {
        'Tacos': '🌮',
        'Special Tacos': '⭐',
        'Appetizers': '🥗',
        'Snacks': '🍿',
        'Beverages': '🥤',
        'Drinks': '🥤',
        'Desserts': '🍰',
        'Main Courses': '🍽️',
        'Sides': '🍟',
        'Breakfast': '🍳',
        'Salads': '🥗',
        'Soups': '🍲',
        'Burritos': '🌯',
        'Alcohol': '🍺',
        'Coffee': '☕',
        'Tea': '🍵',
    }
    
    # Get icon and emoji based on category or use defaults
    icon = icon_map.get(category_name, 'restaurant')
    emoji = emoji_map.get(category_name, '🍽️')
    
    return {
        'id': str(product.id),
        'name': product.name,
        'price': float(product.price),
        'icon': icon,  # Professional icon for UI
        'emoji': emoji,  # Legacy support (will be removed later)
        'available': product.is_active if hasattr(product, 'is_active') else True,
        'category': category_name or 'Uncategorized',
        'description': product.description or ''
    }

@cached(ttl=300, prefix="menu_items", key_params=["restaurant_id", "category"])
async def _get_menu_items_cached(
    restaurant_id: str,
    category: Optional[str],
    db: Session
):
    """Internal cached function for getting menu items"""
    start_time = time.time()
    
    logger.info(f"Menu items request started - Restaurant: {restaurant_id}, Category: {category}")
    
    # Build query
    query = db.query(Product).filter(
        and_(Product.restaurant_id == restaurant_id, Product.is_active == True)
    )
    
    # Optimize category handling
    categories_dict = {}
    category_filter_applied = False
    
    # Filter by category if specified
    if category and category != 'All':
        category_obj = db.query(Category).filter(
            and_(Category.restaurant_id == restaurant_id, Category.name == category)
        ).first()
        if category_obj:
            query = query.filter(Product.category_id == category_obj.id)
            # Only fetch the specific category for optimization
            categories_dict = {category_obj.id: category_obj.name}
            category_filter_applied = True
    
    # Join with categories to avoid N+1 queries
    products = query.join(Category, Product.category_id == Category.id, isouter=True).order_by(Product.name).all()
    
    # Only fetch all categories if we haven't filtered by a specific one
    if not category_filter_applied:
        categories_dict = {
            cat.id: cat.name 
            for cat in db.query(Category).filter(Category.restaurant_id == restaurant_id).all()
        }
    
    # Transform to match frontend expectations
    menu_items = []
    for product in products:
        # Use pre-fetched category name
        category_name = categories_dict.get(product.category_id, 'Uncategorized')
        menu_items.append(format_menu_item(product, category_name))
    
    # Log execution time and performance warnings
    execution_time = time.time() - start_time
    logger.info(f"Menu items request completed in {execution_time:.3f}s - Items: {len(menu_items)}")
    
    if execution_time > 5:
        logger.warning(f"SLOW QUERY WARNING: Menu items took {execution_time:.3f}s for restaurant {restaurant_id} with {len(menu_items)} items")
    elif execution_time > 2:
        logger.warning(f"Performance Alert: Menu query took {execution_time:.3f}s - consider optimization")
    
    return APIResponseHelper.success(
        data=menu_items,
        message=f"Retrieved {len(menu_items)} menu items",
        meta={
            "restaurant_id": restaurant_id,
            "category_filter": category,
            "total_count": len(menu_items),
            "execution_time_ms": int(execution_time * 1000)
        }
    )


@router.get("/items")
async def get_menu_items(
    restaurant_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get menu items (products) for frontend compatibility"""
    # Use current user's restaurant context
    user_restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not user_restaurant_id:
        return APIResponseHelper.error(
            message="User must be assigned to a restaurant",
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
    
    # Call the cached function with resolved restaurant_id
    return await _get_menu_items_cached(restaurant_id, category, db)

@cached(ttl=300, prefix="menu_categories", key_params=["restaurant_id"])
async def _get_menu_categories_cached(
    restaurant_id: str,
    db: Session
):
    """Internal cached function for getting menu categories"""
    # Get categories
    categories = db.query(Category).filter(
        and_(Category.restaurant_id == restaurant_id, Category.is_active == True)
    ).order_by(Category.sort_order, Category.name).all()
    
    # Transform to match frontend expectations
    menu_categories = [
        {
            'id': int(str(cat.id).replace('-', '')[:8], 16) % 100000,  # Convert UUID to int for frontend compatibility
            'name': cat.name,
            'active': cat.is_active
        }
        for cat in categories
    ]
    
    # Always include 'All' category at the beginning
    if not any(cat['name'] == 'All' for cat in menu_categories):
        menu_categories.insert(0, {'id': 1, 'name': 'All', 'active': True})
    
    return APIResponseHelper.success(
        data=menu_categories,
        message=f"Retrieved {len(menu_categories)} menu categories",
        meta={
            "restaurant_id": restaurant_id,
            "total_count": len(menu_categories)
        }
    )


@router.get("/categories")
async def get_menu_categories(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get menu categories for frontend compatibility"""
    # Use current user's restaurant context
    user_restaurant_id = current_user.current_restaurant_id or current_user.restaurant_id
    if not user_restaurant_id:
        return APIResponseHelper.error(
            message="User must be assigned to a restaurant",
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
    
    # Call the cached function with resolved restaurant_id
    return await _get_menu_categories_cached(restaurant_id, db)