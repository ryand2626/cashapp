"""
Subscription management API endpoints

This module provides REST API endpoints for managing restaurant subscriptions,
subscription plans, and usage tracking.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.subscription import SubscriptionPlan, RestaurantSubscription, SubscriptionUsage
from app.core.responses import APIResponseHelper
from app.schemas.subscription import (
    SubscriptionPlanResponse,
    RestaurantSubscriptionResponse,
    SubscriptionUsageResponse,
    SubscriptionCreateRequest,
    PlanChangeRequest
)
from app.core.auth import get_current_user


router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/plans")
async def get_subscription_plans(
    db: Session = Depends(get_db),
    include_inactive: bool = Query(False, description="Include inactive plans")
):
    """
    Get all available subscription plans
    
    Returns a list of subscription plans with their features and pricing.
    """
    try:
        query = db.query(SubscriptionPlan)
        
        if not include_inactive:
            query = query.filter(SubscriptionPlan.is_active == True)
            
        plans = query.order_by(SubscriptionPlan.price_monthly).all()
        
        return APIResponseHelper.success(
            data=plans,
            message=f"Retrieved {len(plans)} subscription plans"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve subscription plans: {str(e)}",
            status_code=500
        )


@router.get("/current")
async def get_current_subscription(
    restaurant_id: int = Query(..., description="Restaurant ID"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get current subscription for a restaurant
    
    Returns the active subscription details including plan information
    and usage statistics.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to access this restaurant's subscription data",
                status_code=403
            )
        subscription = db.query(RestaurantSubscription).filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.status.in_(['active', 'trial'])
        ).first()
        
        if not subscription:
            return APIResponseHelper.error(
                message="No active subscription found for this restaurant",
                status_code=404
            )
        
        # Get current month usage
        current_month = SubscriptionUsage.get_current_month_key()
        usage = db.query(SubscriptionUsage).filter(
            SubscriptionUsage.restaurant_id == restaurant_id,
            SubscriptionUsage.month_year == current_month
        ).first()
        
        response_data = {
            "subscription": subscription,
            "plan": subscription.plan,
            "usage": usage
        }
        
        return APIResponseHelper.success(
            data=response_data,
            message="Current subscription retrieved successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve current subscription: {str(e)}",
            status_code=500
        )


@router.post("/subscribe")
async def create_subscription(
    subscription_data: SubscriptionCreateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Subscribe a restaurant to a plan
    
    Creates a new subscription for the restaurant with the specified plan.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != subscription_data.restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to manage this restaurant's subscription",
                status_code=403
            )
        # Check if restaurant already has an active subscription
        existing_subscription = db.query(RestaurantSubscription).filter(
            RestaurantSubscription.restaurant_id == subscription_data.restaurant_id,
            RestaurantSubscription.status.in_(['active', 'trial'])
        ).first()
        
        if existing_subscription:
            return APIResponseHelper.error(
                message="Restaurant already has an active subscription",
                status_code=400
            )
        
        # Verify the plan exists
        plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == subscription_data.plan_id,
            SubscriptionPlan.is_active == True
        ).first()
        
        if not plan:
            return APIResponseHelper.error(
                message="Invalid subscription plan",
                status_code=400
            )
        
        # Create new subscription
        now = datetime.utcnow()
        
        # Set trial period for new subscriptions (14 days)
        if subscription_data.start_trial:
            status = "trial"
            trial_end_date = now + timedelta(days=14)
            period_end = trial_end_date
        else:
            status = "active"
            trial_end_date = None
            period_end = now + timedelta(days=30)  # Monthly billing
        
        new_subscription = RestaurantSubscription(
            restaurant_id=subscription_data.restaurant_id,
            plan_id=subscription_data.plan_id,
            status=status,
            trial_end_date=trial_end_date,
            current_period_start=now,
            current_period_end=period_end,
            stripe_subscription_id=subscription_data.stripe_subscription_id,
            stripe_customer_id=subscription_data.stripe_customer_id
        )
        
        db.add(new_subscription)
        db.commit()
        db.refresh(new_subscription)
        
        # Initialize usage tracking for current month
        current_month = SubscriptionUsage.get_current_month_key()
        usage = SubscriptionUsage(
            restaurant_id=subscription_data.restaurant_id,
            month_year=current_month
        )
        db.add(usage)
        db.commit()
        
        return APIResponseHelper.success(
            data=new_subscription,
            message=f"Successfully subscribed to {plan.display_name}",
            status_code=201
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to create subscription: {str(e)}",
            status_code=500
        )


@router.put("/change-plan")
async def change_subscription_plan(
    change_data: PlanChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Change subscription plan (upgrade/downgrade)
    
    Updates the restaurant's subscription to a different plan.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != change_data.restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to manage this restaurant's subscription",
                status_code=403
            )
        # Get current subscription
        subscription = db.query(RestaurantSubscription).filter(
            RestaurantSubscription.restaurant_id == change_data.restaurant_id,
            RestaurantSubscription.status.in_(['active', 'trial'])
        ).first()
        
        if not subscription:
            return APIResponseHelper.error(
                message="No active subscription found",
                status_code=404
            )
        
        # Verify new plan exists
        new_plan = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.id == change_data.new_plan_id,
            SubscriptionPlan.is_active == True
        ).first()
        
        if not new_plan:
            return APIResponseHelper.error(
                message="Invalid new plan",
                status_code=400
            )
        
        old_plan = subscription.plan
        
        # Update subscription
        subscription.plan_id = change_data.new_plan_id
        subscription.updated_at = datetime.utcnow()
        
        # If changing from trial, update status
        if subscription.status == 'trial' and not new_plan.name == 'trial':
            subscription.status = 'active'
            subscription.trial_end_date = None
        
        db.commit()
        db.refresh(subscription)
        
        change_type = "upgrade" if new_plan.price_monthly > old_plan.price_monthly else "downgrade"
        
        return APIResponseHelper.success(
            data=subscription,
            message=f"Successfully {change_type}d from {old_plan.display_name} to {new_plan.display_name}"
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to change subscription plan: {str(e)}",
            status_code=500
        )


@router.post("/cancel")
async def cancel_subscription(
    restaurant_id: int = Query(..., description="Restaurant ID"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Cancel subscription
    
    Cancels the restaurant's active subscription.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to manage this restaurant's subscription",
                status_code=403
            )
        subscription = db.query(RestaurantSubscription).filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.status.in_(['active', 'trial'])
        ).first()
        
        if not subscription:
            return APIResponseHelper.error(
                message="No active subscription found",
                status_code=404
            )
        
        # Update subscription status
        subscription.status = 'cancelled'
        subscription.updated_at = datetime.utcnow()
        
        db.commit()
        
        return APIResponseHelper.success(
            data={"cancelled_at": subscription.updated_at},
            message="Subscription cancelled successfully"
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to cancel subscription: {str(e)}",
            status_code=500
        )


@router.get("/usage")
async def get_usage_statistics(
    restaurant_id: int = Query(..., description="Restaurant ID"),
    month_year: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get usage statistics for a restaurant
    
    Returns usage data for the specified month or current month.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to access this restaurant's usage data",
                status_code=403
            )
        if not month_year:
            month_year = SubscriptionUsage.get_current_month_key()
        
        usage = db.query(SubscriptionUsage).filter(
            SubscriptionUsage.restaurant_id == restaurant_id,
            SubscriptionUsage.month_year == month_year
        ).first()
        
        if not usage:
            # Create usage record if it doesn't exist
            usage = SubscriptionUsage(
                restaurant_id=restaurant_id,
                month_year=month_year
            )
            db.add(usage)
            db.commit()
            db.refresh(usage)
        
        # Get subscription to include limits
        subscription = db.query(RestaurantSubscription).filter(
            RestaurantSubscription.restaurant_id == restaurant_id,
            RestaurantSubscription.status.in_(['active', 'trial'])
        ).first()
        
        response_data = {
            "usage": usage,
            "limits": {
                "orders": subscription.plan.max_orders_per_month if subscription else None,
                "staff": subscription.plan.max_staff_accounts if subscription else None,
                "menu_items": subscription.plan.max_menu_items if subscription else None
            } if subscription else None,
            "plan": subscription.plan if subscription else None
        }
        
        return APIResponseHelper.success(
            data=response_data,
            message="Usage statistics retrieved successfully"
        )
        
    except Exception as e:
        return APIResponseHelper.error(
            message=f"Failed to retrieve usage statistics: {str(e)}",
            status_code=500
        )


@router.post("/usage/increment")
async def increment_usage(
    restaurant_id: int = Query(..., description="Restaurant ID"),
    usage_type: str = Query(..., description="Type of usage (orders, staff, menu_items)"),
    amount: int = Query(1, description="Amount to increment"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Increment usage counter
    
    This endpoint is called internally when restaurants perform actions
    that count towards their subscription limits.
    """
    try:
        # Verify user has access to this restaurant
        if not hasattr(current_user, 'restaurant_id') or current_user.restaurant_id is None:
            return APIResponseHelper.error(
                message="Access denied: User not associated with any restaurant",
                status_code=403
            )
        
        if current_user.restaurant_id != restaurant_id:
            return APIResponseHelper.error(
                message="Access denied: You don't have permission to modify this restaurant's usage data",
                status_code=403
            )
        if usage_type not in ['orders', 'staff', 'menu_items']:
            return APIResponseHelper.error(
                message="Invalid usage type",
                status_code=400
            )
        
        current_month = SubscriptionUsage.get_current_month_key()
        
        # Get or create usage record
        usage = db.query(SubscriptionUsage).filter(
            SubscriptionUsage.restaurant_id == restaurant_id,
            SubscriptionUsage.month_year == current_month
        ).first()
        
        if not usage:
            usage = SubscriptionUsage(
                restaurant_id=restaurant_id,
                month_year=current_month
            )
            db.add(usage)
        
        # Increment usage
        usage.increment_usage(usage_type, amount)
        usage.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(usage)
        
        return APIResponseHelper.success(
            data=usage,
            message=f"Usage incremented: {usage_type} +{amount}"
        )
        
    except Exception as e:
        db.rollback()
        return APIResponseHelper.error(
            message=f"Failed to increment usage: {str(e)}",
            status_code=500
        )