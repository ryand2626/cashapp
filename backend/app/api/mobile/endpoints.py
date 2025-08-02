"""
Mobile API Compatibility Layer for Fynlo POS
Provides Odoo-style endpoints and mobile-optimized responses for iOS app
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from app.core.database import get_db, User, Restaurant, Product, Category, Order
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import FynloException, ErrorCodes
from app.core.mobile_id_mapping import get_mobile_id_service
from app.core.redis_client import get_redis, RedisClient

router = APIRouter()

# Mobile-optimized response models
class MobileProductResponse(BaseModel):
    """Lightweight product response for mobile"""
    id: int  # Mobile-friendly integer ID
    uuid_id: str  # Original UUID for reference
    name: str
    price: float
    image_url: Optional[str] = None
    category_id: int  # Mobile-friendly integer ID
    category_uuid_id: str  # Original category UUID
    is_available: bool = True
    prep_time: int = 0

class MobileCategoryResponse(BaseModel):
    """Lightweight category response for mobile"""
    id: int  # Mobile-friendly integer ID
    uuid_id: str  # Original UUID for reference
    name: str
    color: str = "#00A651"
    icon: Optional[str] = None
    product_count: int = 0

class MobileMenuResponse(BaseModel):
    """Mobile-optimized complete menu"""
    categories: List[MobileCategoryResponse]
    products: List[MobileProductResponse]
    restaurant_info: Dict[str, Any]
    last_updated: str

class MobileOrderSummary(BaseModel):
    """Lightweight order summary for mobile"""
    id: str
    order_number: str
    status: str
    total: float
    items_count: int
    table_number: Optional[str] = None
    created_at: str

# Odoo-style Authentication Endpoint
@router.post("/web/session/authenticate")
async def odoo_style_authenticate(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Odoo-compatible authentication endpoint
    Expected by iOS app for backwards compatibility
    """
    try:
        # Parse request body
        body = await request.body()
        data = json.loads(body) if body else {}
        
        params = data.get("params", {})
        login = params.get("login")
        password = params.get("password")
        
        if not login or not password:
            raise FynloException(
                message="Login and password are required",
                error_code=ErrorCodes.VALIDATION_ERROR,
                status_code=400
            )
        
        # Since we're using Supabase auth, we need to authenticate through Supabase
        # For backwards compatibility with mobile app expecting username/password auth,
        # we'll need to handle this differently. For now, return an error message
        # indicating that Supabase authentication should be used
        raise FynloException(
            message="Please use Supabase authentication. Legacy username/password authentication is not supported.",
            error_code=ErrorCodes.AUTHENTICATION_ERROR,
            status_code=401
        )
        
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Authentication failed: {str(e)}",
            error_code=ErrorCodes.AUTHENTICATION_ERROR,
            status_code=500
        )

# Mobile-optimized menu endpoint
@router.get("/api/v1/products/mobile")
async def get_mobile_menu(
    restaurant_id: Optional[str] = Query(None),
    include_unavailable: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: RedisClient = Depends(get_redis)
):
    """
    Mobile-optimized menu endpoint with reduced payload
    """
    try:
        # Use user's restaurant if not specified
        if not restaurant_id:
            restaurant_id = str(current_user.restaurant_id)
        
        # Get restaurant info
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if not restaurant:
            raise FynloException(
                message="Restaurant not found",
                error_code=ErrorCodes.NOT_FOUND,
                status_code=404
            )
        
        # Get categories with product counts
        categories = db.query(Category).filter(
            Category.restaurant_id == restaurant_id,
            Category.is_active == True
        ).all()
        
        # Get products
        products_query = db.query(Product).filter(
            Product.restaurant_id == restaurant_id,
            Product.is_active == True
        )
        
        if not include_unavailable:
            # Only include available products
            products_query = products_query.filter(Product.is_active == True)
        
        products = products_query.all()
        
        # Initialize mobile ID service
        mobile_id_service = get_mobile_id_service(db, redis)
        
        # Get mobile IDs for all categories and products
        category_uuids = [str(cat.id) for cat in categories]
        product_uuids = [str(prod.id) for prod in products]
        
        category_mobile_ids = mobile_id_service.get_batch_mappings(category_uuids, "category")
        product_mobile_ids = mobile_id_service.get_batch_mappings(product_uuids, "product")
        
        # Count products per category
        category_product_counts = {}
        for product in products:
            cat_id = str(product.category_id)
            category_product_counts[cat_id] = category_product_counts.get(cat_id, 0) + 1
        
        # Build mobile-optimized response with safe integer IDs
        mobile_categories = [
            MobileCategoryResponse(
                id=category_mobile_ids[str(cat.id)],
                uuid_id=str(cat.id),
                name=cat.name,
                color=cat.color,
                icon=cat.icon,
                product_count=category_product_counts.get(str(cat.id), 0)
            )
            for cat in categories
        ]
        
        mobile_products = [
            MobileProductResponse(
                id=product_mobile_ids[str(prod.id)],
                uuid_id=str(prod.id),
                name=prod.name,
                price=float(prod.price),
                image_url=prod.image_url,
                category_id=category_mobile_ids[str(prod.category_id)],
                category_uuid_id=str(prod.category_id),
                is_available=prod.is_active and (
                    not prod.stock_tracking or prod.stock_quantity > 0
                ),
                prep_time=prod.prep_time or 0
            )
            for prod in products
        ]
        
        restaurant_info = {
            "id": str(restaurant.id),
            "name": restaurant.name,
            "logo_url": restaurant.settings.get("logo_url") if restaurant.settings else None,
            "business_hours": restaurant.business_hours,
            "timezone": restaurant.timezone
        }
        
        menu_response = MobileMenuResponse(
            categories=mobile_categories,
            products=mobile_products,
            restaurant_info=restaurant_info,
            last_updated=max(
                prod.updated_at or prod.created_at for prod in products
            ).isoformat() if products else restaurant.updated_at.isoformat()
        )
        
        return APIResponseHelper.success(
            data=menu_response.dict(),
            message=f"Mobile menu retrieved with {len(mobile_products)} products",
            meta={
                "categories_count": len(mobile_categories),
                "products_count": len(mobile_products),
                "restaurant_id": restaurant_id,
                "optimized_for": "mobile"
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve mobile menu: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Daily sales report endpoint (Odoo-style)
@router.get("/pos/reports/daily_sales")
async def get_daily_sales_report(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Daily sales report endpoint (Odoo-compatible)
    """
    try:
        from datetime import datetime, timedelta
        from sqlalchemy import func, and_
        
        # Use user's restaurant if not specified
        if not restaurant_id:
            restaurant_id = str(current_user.restaurant_id)
        
        # Parse date or use today
        if date:
            report_date = datetime.strptime(date, "%Y-%m-%d").date()
        else:
            report_date = datetime.now().date()
        
        # Date range for the day
        start_date = datetime.combine(report_date, datetime.min.time())
        end_date = start_date + timedelta(days=1)
        
        # Get orders for the day
        orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.created_at >= start_date,
                Order.created_at < end_date,
                Order.status == "completed"
            )
        ).all()
        
        # Calculate metrics
        total_sales = sum(order.total_amount for order in orders)
        total_orders = len(orders)
        average_order_value = total_sales / total_orders if total_orders > 0 else 0
        
        # Payment method breakdown
        payment_methods = {}
        for order in orders:
            # Simplified - in real implementation, would join with payments table
            method = "qr_code"  # Default
            payment_methods[method] = payment_methods.get(method, 0) + order.total_amount
        
        # Top selling items
        item_sales = {}
        for order in orders:
            for item in order.items:
                product_name = item.get("product_name", "Unknown")
                quantity = item.get("quantity", 0)
                item_sales[product_name] = item_sales.get(product_name, 0) + quantity
        
        top_items = sorted(item_sales.items(), key=lambda x: x[1], reverse=True)[:5]
        
        report_data = {
            "date": report_date.isoformat(),
            "restaurant_id": restaurant_id,
            "summary": {
                "total_sales": round(total_sales, 2),
                "total_orders": total_orders,
                "average_order_value": round(average_order_value, 2),
                "currency": "GBP"
            },
            "payment_methods": {
                method: round(amount, 2) 
                for method, amount in payment_methods.items()
            },
            "top_selling_items": [
                {"name": name, "quantity": qty} 
                for name, qty in top_items
            ],
            "hourly_breakdown": [],  # Could be implemented for detailed analysis
            "generated_at": datetime.now().isoformat()
        }
        
        return APIResponseHelper.success(
            data=report_data,
            message=f"Daily sales report for {report_date}",
            meta={"report_type": "daily_sales", "format": "mobile_optimized"}
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to generate daily sales report: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Mobile orders endpoint
@router.get("/api/v1/orders/mobile")
async def get_mobile_orders(
    status: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    restaurant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mobile-optimized orders endpoint with lightweight responses
    """
    try:
        # Use user's restaurant if not specified
        if not restaurant_id:
            restaurant_id = str(current_user.restaurant_id)
        
        # Build query
        query = db.query(Order).filter(Order.restaurant_id == restaurant_id)
        
        if status:
            query = query.filter(Order.status == status)
        
        # Get recent orders
        orders = query.order_by(Order.created_at.desc()).limit(limit).all()
        
        # Build mobile response
        mobile_orders = [
            MobileOrderSummary(
                id=str(order.id),
                order_number=order.order_number,
                status=order.status,
                total=float(order.total_amount),
                items_count=len(order.items),
                table_number=order.table_number,
                created_at=order.created_at.isoformat()
            )
            for order in orders
        ]
        
        return APIResponseHelper.success(
            data=mobile_orders,
            message=f"Retrieved {len(mobile_orders)} orders",
            meta={
                "total_count": len(mobile_orders),
                "status_filter": status,
                "limit": limit,
                "optimized_for": "mobile"
            }
        )
        
    except FynloException:
        raise
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve mobile orders: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Base URL configuration endpoint
@router.get("/api/config/base_url")
async def get_base_url_config():
    """
    Configuration endpoint for mobile app base URL setup
    Supports both port 8000 and 8069 for compatibility
    """
    try:
        from app.core.config import settings
        
        # Get the actual host from request or settings
        base_url = getattr(settings, 'BASE_URL', 'https://fynlopos-9eg2c.ondigitalocean.app')
        ws_protocol = 'wss' if base_url.startswith('https') else 'ws'
        
        config_data = {
            "api_base_url": base_url,  # Use production URL from settings
            "odoo_compatible_url": base_url,  # Legacy compatibility - consider removal
            "websocket_url": f"{ws_protocol}://{base_url.replace('https://', '').replace('http://', '')}/ws",
            "supported_versions": ["v1"],
            "mobile_optimized": True,
            "features": {
                "file_upload": True,
                "real_time": True,
                "offline_sync": True,
                "push_notifications": True
            }
        }
        
        return APIResponseHelper.success(
            data=config_data,
            message="Mobile configuration retrieved",
            meta={"environment": "development"}  # Would be dynamic
        )
        
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve configuration: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Feature flags endpoint for mobile
@router.get("/api/features")
async def get_feature_flags(
    current_user: User = Depends(get_current_user)
):
    """
    Feature flags endpoint for mobile app feature toggles
    """
    try:
        # Feature flags based on user role and restaurant settings
        features = {
            "new_ui": True,
            "qr_payments": True,
            "offline_mode": True,
            "real_time_updates": True,
            "multi_restaurant": current_user.role == "platform_owner",
            "advanced_analytics": current_user.role in ["platform_owner", "restaurant_owner"],
            "hardware_integration": True,
            "table_management": True,
            "inventory_tracking": True,
            "customer_loyalty": True
        }
        
        return APIResponseHelper.success(
            data=features,
            message="Feature flags retrieved",
            meta={
                "user_role": current_user.role,
                "features_count": len(features)
            }
        )
        
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve feature flags: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )

# Session validation endpoint (Odoo-style)
@router.post("/web/session/get_session_info")
async def get_session_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Odoo-compatible session information endpoint
    """
    try:
        # Get restaurant info
        restaurant = None
        if current_user.restaurant_id:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == current_user.restaurant_id
            ).first()
        
        session_info = {
            "uid": str(current_user.id),
            "username": current_user.username,
            "user_context": {
                "lang": "en_US",
                "tz": "UTC",
                "uid": str(current_user.id)
            },
            "is_admin": current_user.role in ["platform_owner", "restaurant_owner"],
            "company_id": str(current_user.restaurant_id) if current_user.restaurant_id else None,
            "company_name": restaurant.name if restaurant else None,
            "session_id": "active",  # Simplified
            "user_companies": {
                "current_company": str(current_user.restaurant_id) if current_user.restaurant_id else None
            }
        }
        
        return APIResponseHelper.success(
            data=session_info,
            message="Session information retrieved"
        )
        
    except Exception as e:
        raise FynloException(
            message=f"Failed to retrieve session info: {str(e)}",
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=500
        )