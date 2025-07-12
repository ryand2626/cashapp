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

router = APIRouter()
logger = logging.getLogger(__name__)

def format_menu_item(product, category_name=None):
    """Format product as menu item with required fields"""
    # Map category names to emojis
    emoji_map = {
        'Tacos': '🌮',
        'Appetizers': '🥗',
        'Beverages': '🥤',
        'Desserts': '🍰',
        'Main Courses': '🍽️',
        'Sides': '🍟',
        'Breakfast': '🍳',
        'Salads': '🥗',
        'Soups': '🍲',
        'Drinks': '🥤',
        'Alcohol': '🍺',
        'Coffee': '☕',
        'Tea': '🍵',
    }
    
    # Get emoji based on category or use default
    emoji = emoji_map.get(category_name, '🍽️')
    
    return {
        'id': str(product.id),
        'name': product.name,
        'price': float(product.price),
        'emoji': emoji,
        'available': product.is_active if hasattr(product, 'is_active') else True,
        'category': category_name or 'Uncategorized',
        'description': product.description or ''
    }

@router.get("/items")
async def get_menu_items(
    restaurant_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get menu items (products) for frontend compatibility"""
    start_time = time.time()
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    logger.info(f"Menu items request started - Restaurant: {restaurant_id}, Category: {category}")
    
    # Check cache first
    cache_key = f"menu_items:{restaurant_id}:{category or 'all'}"
    cached_items = await redis.get(cache_key)
    if cached_items:
        cache_time = time.time() - start_time
        logger.info(f"Menu items returned from cache in {cache_time:.3f}s")
        return APIResponseHelper.success(data=cached_items)
    
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
    
    # Cache for 5 minutes
    await redis.set(cache_key, menu_items, expire=300)
    
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

@router.get("/categories")
async def get_menu_categories(
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """Get menu categories for frontend compatibility"""
    
    # Use user's restaurant if not specified
    if not restaurant_id:
        restaurant_id = str(current_user.restaurant_id)
    
    # Check cache first
    cache_key = f"menu_categories:{restaurant_id}"
    cached_categories = await redis.get(cache_key)
    if cached_categories:
        return APIResponseHelper.success(data=cached_categories)
    
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
    
    # Cache for 5 minutes
    await redis.set(cache_key, menu_categories, expire=300)
    
    return APIResponseHelper.success(
        data=menu_categories,
        message=f"Retrieved {len(menu_categories)} menu categories",
        meta={
            "restaurant_id": restaurant_id,
            "total_count": len(menu_categories)
        }
    )