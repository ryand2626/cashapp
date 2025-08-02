"""
Feature gating middleware for subscription-based access control

This module provides decorators and middleware for restricting access
to features based on subscription plans.
"""

from functools import wraps
from fastapi import HTTPException, Request, Depends
from sqlalchemy.orm import Session
from typing import Callable, Optional, List, Tuple

from app.core.database import get_db
from app.models.subscription import RestaurantSubscription, SubscriptionUsage
from app.core.auth import get_current_user


class FeatureGateError(HTTPException):
    """Custom exception for feature gate violations"""
    
    def __init__(self, feature_name: str, current_plan: str = None, required_plans: List[str] = None):
        self.feature_name = feature_name
        self.current_plan = current_plan
        self.required_plans = required_plans or []
        
        detail = {
            "error": "feature_access_denied",
            "message": f"Feature '{feature_name}' is not available in your current plan",
            "feature": feature_name,
            "current_plan": current_plan,
            "upgrade_required": True,
            "required_plans": required_plans
        }
        
        super().__init__(status_code=403, detail=detail)


class UsageLimitError(HTTPException):
    """Custom exception for usage limit violations"""
    
    def __init__(self, limit_type: str, current_usage: int, limit: int, current_plan: str = None):
        self.limit_type = limit_type
        self.current_usage = current_usage
        self.limit = limit
        self.current_plan = current_plan
        
        detail = {
            "error": "usage_limit_exceeded",
            "message": f"Usage limit exceeded for {limit_type}: {current_usage}/{limit}",
            "limit_type": limit_type,
            "current_usage": current_usage,
            "limit": limit,
            "current_plan": current_plan,
            "upgrade_required": True
        }
        
        super().__init__(status_code=429, detail=detail)


def get_restaurant_subscription(restaurant_id: int, db: Session) -> Optional[RestaurantSubscription]:
    """Get active subscription for a restaurant"""
    return db.query(RestaurantSubscription).filter(
        RestaurantSubscription.restaurant_id == restaurant_id,
        RestaurantSubscription.status.in_(['active', 'trial'])
    ).first()


def check_feature_access(restaurant_id: int, feature_name: str, db: Session) -> bool:
    """Check if restaurant has access to a specific feature"""
    subscription = get_restaurant_subscription(restaurant_id, db)
    
    if not subscription:
        return False  # No active subscription
    
    return subscription.has_feature(feature_name)


def check_usage_limit(restaurant_id: int, limit_type: str, db: Session) -> Tuple[bool, int, Optional[int]]:
    """
    Check if restaurant is at usage limit
    
    Returns:
        tuple: (at_limit, current_usage, limit)
    """
    subscription = get_restaurant_subscription(restaurant_id, db)
    
    if not subscription:
        return True, 0, 0  # No subscription = at limit
    
    # Get current month usage
    current_month = SubscriptionUsage.get_current_month_key()
    usage = db.query(SubscriptionUsage).filter(
        SubscriptionUsage.restaurant_id == restaurant_id,
        SubscriptionUsage.month_year == current_month
    ).first()
    
    if not usage:
        current_usage = 0
    else:
        usage_map = {
            'orders': usage.orders_count,
            'staff': usage.staff_count,
            'menu_items': usage.menu_items_count
        }
        current_usage = usage_map.get(limit_type, 0)
    
    plan_limit = subscription.get_limit(limit_type)
    
    if plan_limit is None:  # Unlimited
        return False, current_usage, None
    
    return current_usage >= plan_limit, current_usage, plan_limit


def require_feature(feature_name: str):
    """
    FastAPI-compatible dependency factory for feature gating.
    
    Returns a dependency function that can be used with Depends().
    
    Usage:
        @router.get("/advanced-report")
        async def get_advanced_report(
            restaurant_id: int = Query(...),
            db: Session = Depends(get_db),
            _feature_check = Depends(require_feature('advanced_analytics'))
        ):
            pass
    """
    from fastapi import Query
    
    def feature_dependency(
        restaurant_id: int = Query(..., description="Restaurant ID"),
        db: Session = Depends(get_db)
    ):
        """Dependency that checks feature access"""
        if not check_feature_access(restaurant_id, feature_name, db):
            subscription = get_restaurant_subscription(restaurant_id, db)
            current_plan = subscription.plan.name if subscription and subscription.plan else "none"
            
            raise FeatureGateError(
                feature_name=feature_name,
                current_plan=current_plan,
                required_plans=["beta", "gamma"]  # Updated to correct plan names
            )
        return True  # Return something to indicate success
    
    return feature_dependency


def require_usage_limit(limit_type: str, increment: int = 1):
    """
    FastAPI-compatible dependency factory for usage limit checking.
    
    Returns a dependency function that can be used with Depends().
    
    Usage:
        @router.post("/create-order")
        async def create_order(
            restaurant_id: int = Query(...),
            db: Session = Depends(get_db),
            _usage_check = Depends(require_usage_limit('orders', increment=1))
        ):
            pass
    """
    from fastapi import Query
    
    def usage_dependency(
        restaurant_id: int = Query(..., description="Restaurant ID"),
        db: Session = Depends(get_db)
    ):
        """Dependency that checks usage limits"""
        # Check usage limit
        at_limit, current_usage, limit = check_usage_limit(restaurant_id, limit_type, db)
        
        if at_limit:
            subscription = get_restaurant_subscription(restaurant_id, db)
            current_plan = subscription.plan.name if subscription and subscription.plan else "none"
            
            raise UsageLimitError(
                limit_type=limit_type,
                current_usage=current_usage,
                limit=limit or 0,
                current_plan=current_plan
            )
        
        # If we would exceed the limit with this action, also block
        if limit is not None and (current_usage + increment) > limit:
            subscription = get_restaurant_subscription(restaurant_id, db)
            current_plan = subscription.plan.name if subscription and subscription.plan else "none"
            
            raise UsageLimitError(
                limit_type=limit_type,
                current_usage=current_usage,
                limit=limit,
                current_plan=current_plan
            )
        
        return True  # Return something to indicate success
    
    return usage_dependency


# Convenience decorators for common features
require_advanced_analytics = require_feature('advanced_analytics')
require_inventory_management = require_feature('inventory_management')
require_multi_location = require_feature('multi_location')
require_api_access = require_feature('api_access')
require_custom_branding = require_feature('custom_branding')

# Convenience decorators for common limits
require_order_limit = require_usage_limit('orders')
require_staff_limit = require_usage_limit('staff')
require_menu_limit = require_usage_limit('menu_items')


class FeatureGateService:
    """Service class for feature gating operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def has_feature(self, restaurant_id: int, feature_name: str) -> bool:
        """Check if restaurant has access to a feature"""
        return check_feature_access(restaurant_id, feature_name, self.db)
    
    def get_feature_access_map(self, restaurant_id: int) -> dict:
        """Get a map of all features and their access status"""
        subscription = get_restaurant_subscription(restaurant_id, self.db)
        
        if not subscription:
            return {}
        
        return subscription.plan.features
    
    def is_at_limit(self, restaurant_id: int, limit_type: str) -> bool:
        """Check if restaurant is at a usage limit"""
        at_limit, _, _ = check_usage_limit(restaurant_id, limit_type, self.db)
        return at_limit
    
    def get_usage_summary(self, restaurant_id: int) -> dict:
        """Get comprehensive usage summary for a restaurant"""
        subscription = get_restaurant_subscription(restaurant_id, self.db)
        
        if not subscription:
            return {"error": "No active subscription"}
        
        current_month = SubscriptionUsage.get_current_month_key()
        usage = self.db.query(SubscriptionUsage).filter(
            SubscriptionUsage.restaurant_id == restaurant_id,
            SubscriptionUsage.month_year == current_month
        ).first()
        
        if not usage:
            usage_data = {"orders": 0, "staff": 0, "menu_items": 0}
        else:
            usage_data = {
                "orders": usage.orders_count,
                "staff": usage.staff_count,
                "menu_items": usage.menu_items_count
            }
        
        return {
            "plan": subscription.plan.name,
            "status": subscription.status,
            "usage": usage_data,
            "limits": {
                "orders": subscription.plan.max_orders_per_month,
                "staff": subscription.plan.max_staff_accounts,
                "menu_items": subscription.plan.max_menu_items
            },
            "features": subscription.plan.features
        }