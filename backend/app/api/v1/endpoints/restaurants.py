"""
Restaurant Management API endpoints for Fynlo POS
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import logging

from app.core.database import get_db, Restaurant, Platform, User, Order, Customer, Section, Table
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException, ServiceUnavailableError, AuthorizationException
from app.core.validation import (
    validate_model_jsonb_fields,
    validate_email,
    validate_phone,
    sanitize_string,
    ValidationError as ValidationErr
)
from app.core.websocket import websocket_manager
from app.schemas.restaurant import RestaurantOnboardingCreate
from app.core.tenant_security import TenantSecurity

router = APIRouter()
logger = logging.getLogger(__name__)

# Pydantic models
class RestaurantCreate(BaseModel):
    name: str
    address: dict
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: str = "UTC"
    business_hours: dict = {}
    settings: dict = {}

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[dict] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    business_hours: Optional[dict] = None
    settings: Optional[dict] = None
    tax_configuration: Optional[dict] = None
    payment_methods: Optional[dict] = None
    is_active: Optional[bool] = None

class RestaurantResponse(BaseModel):
    id: str
    platform_id: Optional[str]
    name: str
    address: dict
    phone: Optional[str]
    email: Optional[str]
    timezone: str
    business_hours: dict
    settings: dict
    tax_configuration: dict
    payment_methods: dict
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

class RestaurantStats(BaseModel):
    restaurant_id: str
    name: str
    daily_revenue: float
    monthly_revenue: float
    total_orders: int
    active_customers: int
    average_order_value: float
    payment_method_breakdown: dict

class PlatformStats(BaseModel):
    total_restaurants: int
    active_restaurants: int
    total_revenue: float
    total_orders: int
    total_customers: int
    top_performing_restaurants: List[RestaurantStats]

@router.get("/", response_model=List[RestaurantResponse])
async def get_restaurants(
    platform_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get restaurants (for platform owners) or current restaurant (for restaurant users)"""
    
    # Platform owners can see all restaurants in their platform
    if current_user.role == "platform_owner":
        platform_id = platform_id or str(current_user.platform_id)
        query = db.query(Restaurant).filter(Restaurant.platform_id == platform_id)
        
        if active_only:
            query = query.filter(Restaurant.is_active == True)
        
        restaurants = query.order_by(Restaurant.name).all()
    
    # Restaurant users - handle multi-restaurant access
    else:
        from app.core.tenant_security import TenantSecurity
        from app.core.database import UserRestaurant
        
        # Get all accessible restaurants for the user
        accessible_restaurants = TenantSecurity.get_accessible_restaurant_ids(current_user, db)
        
        if not accessible_restaurants:
            return APIResponseHelper.success(
                data=[],
                message="No restaurants accessible",
                meta={
                    "user_role": current_user.role,
                    "active_only": active_only
                }
            )
        
        # Query all accessible restaurants
        query = db.query(Restaurant).filter(Restaurant.id.in_(accessible_restaurants))
        
        if active_only:
            query = query.filter(Restaurant.is_active == True)
        
        restaurants = query.order_by(Restaurant.name).all()
    
    result = [
        RestaurantResponse(
            id=str(restaurant.id),
            platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
            name=restaurant.name,
            address=restaurant.address,
            phone=restaurant.phone,
            email=restaurant.email,
            timezone=restaurant.timezone,
            business_hours=restaurant.business_hours,
            settings=restaurant.settings,
            tax_configuration=restaurant.tax_configuration,
            payment_methods=restaurant.payment_methods,
            is_active=restaurant.is_active,
            created_at=restaurant.created_at,
            updated_at=restaurant.updated_at
        )
        for restaurant in restaurants
    ]
    
    return APIResponseHelper.success(
        data=result,
        message=f"Retrieved {len(result)} restaurants",
        meta={
            "user_role": current_user.role,
            "platform_id": platform_id,
            "active_only": active_only
        }
    )

@router.get("/current", response_model=RestaurantResponse)
async def get_current_restaurant(
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current restaurant (supports multi-restaurant access)"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == restaurant_id
    ).first()
    
    if not restaurant:
        raise ResourceNotFoundException(resource="Restaurant", resource_id=restaurant_id)    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

@router.post("/", response_model=RestaurantResponse)
async def create_restaurant(
    restaurant_data: RestaurantCreate,
    platform_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new restaurant (platform owners only)"""
    
    if current_user.role != "platform_owner":
        raise AuthorizationException(message="Only platform owners can create restaurants", details={"required_role": "platform_owner"})
    # Use user's platform if not specified
    platform_id = platform_id or str(current_user.platform_id)
    
    # Verify platform exists
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if not platform:
        raise ResourceNotFoundException(resource="Platform", resource_id=platform_id)    
    # Validate and sanitize JSONB fields
    try:
        validated_address = validate_model_jsonb_fields('restaurant', 'address', restaurant_data.address)
        validated_business_hours = validate_model_jsonb_fields('restaurant', 'business_hours', restaurant_data.business_hours)
        validated_settings = validate_model_jsonb_fields('restaurant', 'settings', restaurant_data.settings)
    except ValidationErr as e:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"JSONB validation failed: {str(e)}"
        )
    
    # Validate email and phone if provided
    if restaurant_data.email and not validate_email(restaurant_data.email):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid email format"
        )
    
    if restaurant_data.phone and not validate_phone(restaurant_data.phone):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid phone number format"
        )
    
    # Sanitize string inputs
    sanitized_name = sanitize_string(restaurant_data.name, 255)
    if not sanitized_name:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Restaurant name cannot be empty"
        )
    
    new_restaurant = Restaurant(
        platform_id=platform_id,
        name=sanitized_name,
        address=validated_address,
        phone=restaurant_data.phone,
        email=restaurant_data.email,
        timezone=restaurant_data.timezone,
        business_hours=validated_business_hours,
        settings=validated_settings
    )
    
    db.add(new_restaurant)
    db.commit()
    db.refresh(new_restaurant)
    
    return RestaurantResponse(
        id=str(new_restaurant.id),
        platform_id=str(new_restaurant.platform_id),
        name=new_restaurant.name,
        address=new_restaurant.address,
        phone=new_restaurant.phone,
        email=new_restaurant.email,
        timezone=new_restaurant.timezone,
        business_hours=new_restaurant.business_hours,
        settings=new_restaurant.settings,
        tax_configuration=new_restaurant.tax_configuration,
        payment_methods=new_restaurant.payment_methods,
        is_active=new_restaurant.is_active,
        created_at=new_restaurant.created_at,
        updated_at=new_restaurant.updated_at
    )

@router.post("/onboarding/create", response_model=RestaurantResponse)
async def create_restaurant_onboarding(
    restaurant_data: RestaurantOnboardingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a restaurant during onboarding for users without restaurants"""
    
    # Check if user already has a restaurant
    if current_user.restaurant_id:
        raise ValidationException(message="User already has a restaurant associated", field="restaurant_id")    
    # Get user's platform (should be set during auth)
    platform_id = str(current_user.platform_id) if current_user.platform_id else None
    if not platform_id:
        # If no platform, use default platform
        default_platform = db.query(Platform).filter(Platform.name == "Fynlo").first()
        if not default_platform:
            raise ServiceUnavailableError(message="No default platform found", service_name="Platform")
        platform_id = str(default_platform.id)
    
    # Validate and sanitize JSONB fields
    try:
        validated_address = validate_model_jsonb_fields('restaurant', 'address', restaurant_data.address)
        validated_business_hours = validate_model_jsonb_fields('restaurant', 'business_hours', restaurant_data.business_hours)
        
        # Create settings from the additional fields
        settings = {
            "display_name": restaurant_data.display_name,
            "business_type": restaurant_data.business_type,
            "description": restaurant_data.description or "",
            "website": restaurant_data.website or "",
            "owner_info": restaurant_data.owner_info,
            "bank_details": restaurant_data.bank_details,
            "currency": "GBP",
            "date_format": "DD/MM/YYYY",
            "time_format": "24h",
            "allow_tips": True,
            "auto_gratuity_percentage": 12.5,
            "print_receipt_default": True
        }
        validated_settings = validate_model_jsonb_fields('restaurant', 'settings', settings)
    except ValidationErr as e:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"JSONB validation failed: {str(e)}"
        )
    
    # Validate email and phone if provided
    if restaurant_data.email and not validate_email(restaurant_data.email):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid email format"
        )
    
    if restaurant_data.phone and not validate_phone(restaurant_data.phone):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid phone number format"
        )
    
    # Sanitize string inputs
    sanitized_name = sanitize_string(restaurant_data.name, 255)
    if not sanitized_name:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Restaurant name cannot be empty"
        )
    
    # Get subscription info from Supabase metadata
    # We need to fetch from Supabase since User model doesn't have subscription fields
    from app.core.supabase_client import get_supabase_client
    supabase = get_supabase_client()
    
    # Get the Supabase user to access metadata
    supabase_user = None
    if current_user.supabase_id:
        try:
            response = supabase.auth.admin.get_user_by_id(str(current_user.supabase_id))
            if response and response.user:
                supabase_user = response.user
        except Exception as e:
            logger.warning(f"Failed to fetch Supabase user: {e}")
    
    # Extract subscription info from Supabase metadata or use defaults
    user_metadata = supabase_user.user_metadata if supabase_user else {}
    subscription_plan = user_metadata.get('subscription_plan', 'alpha')
    subscription_status = user_metadata.get('subscription_status', 'active')
    
    # Create restaurant with proper defaults
    new_restaurant = Restaurant(
        platform_id=platform_id,
        name=sanitized_name,
        address=validated_address,
        phone=restaurant_data.phone,
        email=restaurant_data.email or current_user.email,
        timezone="Europe/London",  # Default to UK timezone
        business_hours=validated_business_hours,
        settings=validated_settings,
        subscription_plan=subscription_plan,
        subscription_status=subscription_status,
        subscription_started_at=datetime.utcnow(),
        # Set default configurations
        tax_configuration={"vat_rate": 0.20, "included_in_price": True},
        payment_methods={"cash": True, "card": True, "qr_code": True},
        is_active=True
    )
    
    db.add(new_restaurant)
    db.flush()  # Get the ID before updating user
    
    # Update user with restaurant_id and mark onboarding complete
    current_user.restaurant_id = new_restaurant.id
    current_user.needs_onboarding = False
    current_user.updated_at = datetime.utcnow()
    
    # Set user role to restaurant_owner if not already set
    if current_user.role not in ["platform_owner", "restaurant_owner"]:
        current_user.role = "restaurant_owner"
    
    # Create employees if provided
    if restaurant_data.employees:
        for emp_data in restaurant_data.employees:
            try:
                # Create user for each employee
                employee_user = User(
                    email=emp_data['email'],
                    first_name=emp_data['name'].split()[0] if ' ' in emp_data['name'] else emp_data['name'],
                    last_name=' '.join(emp_data['name'].split()[1:]) if ' ' in emp_data['name'] else '',
                    role=emp_data.get('role', 'employee'),
                    restaurant_id=new_restaurant.id,
                    platform_id=platform_id,
                    permissions={"access_level": emp_data.get('access_level', 'pos_only')},
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(employee_user)
                logger.info(f"Created employee user: {employee_user.email}")
            except Exception as e:
                logger.warning(f"Failed to create employee {emp_data.get('email', 'unknown')}: {e}")
                # Continue with other employees even if one fails
    
    db.commit()
    db.refresh(new_restaurant)
    db.refresh(current_user)
    
    # Notify via WebSocket that onboarding is complete
    try:
        await websocket_manager.broadcast_to_restaurant(
            str(new_restaurant.id),
            {
                "type": "onboarding_complete",
                "restaurant_id": str(new_restaurant.id),
                "user_id": str(current_user.id)
            }
        )
    except Exception as e:
        # Don't fail if WebSocket fails
        pass
    
    return RestaurantResponse(
        id=str(new_restaurant.id),
        platform_id=str(new_restaurant.platform_id),
        name=new_restaurant.name,
        address=new_restaurant.address,
        phone=new_restaurant.phone,
        email=new_restaurant.email,
        timezone=new_restaurant.timezone,
        business_hours=new_restaurant.business_hours,
        settings=new_restaurant.settings,
        tax_configuration=new_restaurant.tax_configuration,
        payment_methods=new_restaurant.payment_methods,
        is_active=new_restaurant.is_active,
        created_at=new_restaurant.created_at,
        updated_at=new_restaurant.updated_at
    )

@router.put("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: str,
    restaurant_data: RestaurantUpdate,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update restaurant settings"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise ResourceNotFoundException(resource="Restaurant", resource_id=restaurant_id)    
    # Platform owners can update any restaurant in their platform
    if current_user.role == "platform_owner":
        if str(restaurant.platform_id) != str(current_user.platform_id):
            raise AuthorizationException(message="Access denied", details={"reason": "Restaurant not in user's platform"})
    else:
        # Restaurant users - validate access to the specific restaurant
        await TenantSecurity.validate_restaurant_access(
            current_user, 
            restaurant_id,  # Must match the restaurant being updated
            db=db
        )
        
        # Additional check for managers - they can only update settings, not critical fields
        if current_user.role == "manager" and any(key in restaurant_data.dict(exclude_unset=True) for key in ['is_active', 'payment_methods']):
            raise AuthorizationException(message="Managers cannot modify critical settings", details={"restricted_fields": ["is_active", "payment_methods"]})
    # Validate and sanitize fields if provided
    update_data = restaurant_data.dict(exclude_unset=True)
    
    # Validate JSONB fields
    try:
        if 'address' in update_data:
            update_data['address'] = validate_model_jsonb_fields('restaurant', 'address', update_data['address'])
        
        if 'business_hours' in update_data:
            update_data['business_hours'] = validate_model_jsonb_fields('restaurant', 'business_hours', update_data['business_hours'])
        
        if 'settings' in update_data:
            update_data['settings'] = validate_model_jsonb_fields('restaurant', 'settings', update_data['settings'])
        
        if 'tax_configuration' in update_data:
            update_data['tax_configuration'] = validate_model_jsonb_fields('restaurant', 'tax_configuration', update_data['tax_configuration'])
        
        if 'payment_methods' in update_data:
            update_data['payment_methods'] = validate_model_jsonb_fields('restaurant', 'payment_methods', update_data['payment_methods'])
            
    except ValidationErr as e:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"JSONB validation failed: {str(e)}"
        )
    
    # Validate email and phone if provided
    if 'email' in update_data and update_data['email'] and not validate_email(update_data['email']):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid email format"
        )
    
    if 'phone' in update_data and update_data['phone'] and not validate_phone(update_data['phone']):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Invalid phone number format"
        )
    
    # Sanitize string inputs
    if 'name' in update_data:
        sanitized_name = sanitize_string(update_data['name'], 255)
        if not sanitized_name:
            raise FynloException(
                error_code=ErrorCodes.VALIDATION_ERROR,
                detail="Restaurant name cannot be empty"
            )
        update_data['name'] = sanitized_name
    
    # Update fields
    for field, value in update_data.items():
        setattr(restaurant, field, value)
    
    restaurant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(restaurant)
    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

@router.get("/{restaurant_id}/stats", response_model=RestaurantStats)
async def get_restaurant_stats(
    restaurant_id: str,
    days: int = Query(30, le=365),
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get restaurant performance statistics"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise ResourceNotFoundException(resource="Restaurant", resource_id=restaurant_id)    
    # Platform owners can view stats for any restaurant in their platform
    if current_user.role == "platform_owner":
        if str(restaurant.platform_id) != str(current_user.platform_id):
            raise AuthorizationException(message="Access denied", details={"reason": "Restaurant not in user's platform"})
    else:
        # Restaurant users - validate access to the specific restaurant
        await TenantSecurity.validate_restaurant_access(
            current_user, 
            restaurant_id,  # Must match the restaurant being queried
            db=db
        )
    
    # Date ranges
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    period_start = today_start - timedelta(days=days)
    
    # Daily revenue (today)
    daily_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Period revenue
    period_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Total orders in period
    total_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start
        )
    ).count()
    
    # Active customers (customers with orders in period)
    active_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= period_start,
            Order.customer_id.isnot(None)
        )
    ).scalar() or 0
    
    # Average order value
    avg_order_value = (period_revenue / total_orders) if total_orders > 0 else 0
    
    # Payment method breakdown (last 30 days)
    payment_breakdown = {}
    # This would require a proper Payment table join - simplified for now
    payment_breakdown = {
        "qr_code": 0.45,
        "cash": 0.30,
        "card": 0.20,
        "apple_pay": 0.05
    }
    
    return RestaurantStats(
        restaurant_id=str(restaurant.id),
        name=restaurant.name,
        daily_revenue=float(daily_revenue),
        monthly_revenue=float(period_revenue),
        total_orders=total_orders,
        active_customers=active_customers,
        average_order_value=round(avg_order_value, 2),
        payment_method_breakdown=payment_breakdown
    )

@router.get("/platform/stats", response_model=PlatformStats)
async def get_platform_stats(
    platform_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get platform-wide statistics (platform owners only)"""
    
    if current_user.role != "platform_owner":
        raise AuthorizationException(message="Platform owners only", details={"required_role": "platform_owner"})    
    platform_id = platform_id or str(current_user.platform_id)
    
    # Get all restaurants in platform
    restaurants = db.query(Restaurant).filter(Restaurant.platform_id == platform_id).all()
    restaurant_ids = [str(r.id) for r in restaurants]
    
    # Total and active restaurants
    total_restaurants = len(restaurants)
    active_restaurants = sum(1 for r in restaurants if r.is_active)
    
    # Get period for calculations (last 30 days)
    period_start = datetime.now() - timedelta(days=30)
    
    # Total revenue across all restaurants
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.created_at >= period_start,
            Order.status == "completed"
        )
    ).scalar() or 0
    
    # Total orders
    total_orders = db.query(Order).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.created_at >= period_start
        )
    ).count()
    
    # Total customers
    total_customers = db.query(Customer).filter(
        Customer.restaurant_id.in_(restaurant_ids)
    ).count()
    
    # Top performing restaurants
    top_restaurants = []
    for restaurant in restaurants[:5]:  # Top 5
        restaurant_revenue = db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start,
                Order.status == "completed"
            )
        ).scalar() or 0
        
        restaurant_orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start
            )
        ).count()
        
        restaurant_customers = db.query(func.count(func.distinct(Order.customer_id))).filter(
            and_(
                Order.restaurant_id == restaurant.id,
                Order.created_at >= period_start,
                Order.customer_id.isnot(None)
            )
        ).scalar() or 0
        
        avg_order = (restaurant_revenue / restaurant_orders) if restaurant_orders > 0 else 0
        
        top_restaurants.append(RestaurantStats(
            restaurant_id=str(restaurant.id),
            name=restaurant.name,
            daily_revenue=float(restaurant_revenue / 30),  # Average daily
            monthly_revenue=float(restaurant_revenue),
            total_orders=restaurant_orders,
            active_customers=restaurant_customers,
            average_order_value=round(avg_order, 2),
            payment_method_breakdown={}
        ))
    
    # Sort by revenue
    top_restaurants.sort(key=lambda x: x.monthly_revenue, reverse=True)
    
    return PlatformStats(
        total_restaurants=total_restaurants,
        active_restaurants=active_restaurants,
        total_revenue=float(total_revenue),
        total_orders=total_orders,
        total_customers=total_customers,
        top_performing_restaurants=top_restaurants[:5]
    )

@router.get("/{restaurant_id}")
async def get_restaurant(
    restaurant_id: str,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific restaurant details"""
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise ResourceNotFoundException(resource="Restaurant", resource_id=restaurant_id)    
    # Platform owners can view any restaurant in their platform
    if current_user.role == "platform_owner":
        if str(restaurant.platform_id) != str(current_user.platform_id):
            raise AuthorizationException(message="Access denied", details={"reason": "Restaurant not in user's platform"})
    else:
        # Restaurant users - validate access to the specific restaurant
        await TenantSecurity.validate_restaurant_access(
            current_user, 
            restaurant_id,  # Must match the restaurant being queried
            db=db
        )
    
    return RestaurantResponse(
        id=str(restaurant.id),
        platform_id=str(restaurant.platform_id) if restaurant.platform_id else None,
        name=restaurant.name,
        address=restaurant.address,
        phone=restaurant.phone,
        email=restaurant.email,
        timezone=restaurant.timezone,
        business_hours=restaurant.business_hours,
        settings=restaurant.settings,
        tax_configuration=restaurant.tax_configuration,
        payment_methods=restaurant.payment_methods,
        is_active=restaurant.is_active,
        created_at=restaurant.created_at,
        updated_at=restaurant.updated_at
    )

# Floor Plan and Table Management Endpoints
class TableResponse(BaseModel):
    id: str
    name: str
    section_id: str
    section_name: str
    seats: int
    status: str  # 'available', 'occupied', 'reserved', 'cleaning'
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    x_position: int = 0
    y_position: int = 0

class SectionResponse(BaseModel):
    id: str
    name: str
    restaurant_id: str
    color: str = "#00A651"
    is_active: bool = True

class SectionCreate(BaseModel):
    name: str
    color: str = "#00A651"
    sort_order: int = 0

class TableCreate(BaseModel):
    section_id: str
    name: str
    seats: int = 4
    x_position: int = 0
    y_position: int = 0

@router.get("/floor-plan")
async def get_floor_plan(
    section_id: Optional[str] = Query(None),
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get restaurant floor plan with tables and sections"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Get sections
    sections_query = db.query(Section).filter(
        and_(
            Section.restaurant_id == restaurant_id,
            Section.is_active == True
        )
    ).order_by(Section.sort_order, Section.name)
    
    if section_id:
        sections_query = sections_query.filter(Section.id == section_id)
    
    sections = sections_query.all()
    section_ids = [str(s.id) for s in sections]
    
    # Get tables
    tables_query = db.query(Table, Section).join(
        Section, Table.section_id == Section.id
    ).filter(
        and_(
            Table.restaurant_id == restaurant_id,
            Table.is_active == True
        )
    )
    
    if section_id:
        tables_query = tables_query.filter(Table.section_id == section_id)
    
    tables_data = tables_query.all()
    
    # Format sections
    sections_response = []
    for section in sections:
        sections_response.append({
            "id": str(section.id),
            "name": section.name,
            "restaurant_id": str(section.restaurant_id),
            "color": section.color,
            "is_active": section.is_active
        })
    
    # Format tables
    tables_response = []
    for table, section in tables_data:
        # Get server name if assigned
        server_name = None
        if table.server_id:
            server = db.query(User).filter(User.id == table.server_id).first()
            if server:
                server_name = f"{server.first_name} {server.last_name}"
        
        tables_response.append({
            "id": str(table.id),
            "name": table.name,
            "section_id": str(table.section_id),
            "section_name": section.name,
            "seats": table.seats,
            "status": table.status,
            "server_id": str(table.server_id) if table.server_id else None,
            "server_name": server_name,
            "x_position": table.x_position,
            "y_position": table.y_position
        })
    
    return APIResponseHelper.success(
        data={
            "sections": sections_response,
            "tables": tables_response
        },
        message=f"Retrieved floor plan with {len(sections_response)} sections and {len(tables_response)} tables"
    )

@router.get("/sections")
async def get_sections(
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all restaurant sections"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    sections = db.query(Section).filter(
        and_(
            Section.restaurant_id == restaurant_id,
            Section.is_active == True
        )
    ).order_by(Section.sort_order, Section.name).all()
    
    sections_response = []
    for section in sections:
        sections_response.append({
            "id": str(section.id),
            "name": section.name,
            "restaurant_id": str(section.restaurant_id),
            "color": section.color,
            "is_active": section.is_active
        })
    
    return APIResponseHelper.success(
        data=sections_response,
        message=f"Retrieved {len(sections_response)} sections"
    )

@router.post("/sections")
async def create_section(
    section_data: SectionCreate,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new section"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    new_section = Section(
        restaurant_id=restaurant_id,
        name=section_data.name,
        color=section_data.color,
        sort_order=section_data.sort_order
    )
    
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    
    return APIResponseHelper.success(
        data={
            "id": str(new_section.id),
            "name": new_section.name,
            "restaurant_id": str(new_section.restaurant_id),
            "color": new_section.color,
            "is_active": new_section.is_active
        },
        message=f"Section '{new_section.name}' created successfully"
    )

@router.post("/tables")
async def create_table(
    table_data: TableCreate,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new table"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Verify section exists and belongs to restaurant
    section = db.query(Section).filter(
        and_(
            Section.id == table_data.section_id,
            Section.restaurant_id == restaurant_id
        )
    ).first()
    
    if not section:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Section not found"
        )
    
    new_table = Table(
        restaurant_id=restaurant_id,
        section_id=table_data.section_id,
        name=table_data.name,
        seats=table_data.seats,
        x_position=table_data.x_position,
        y_position=table_data.y_position
    )
    
    db.add(new_table)
    db.commit()
    db.refresh(new_table)
    
    return APIResponseHelper.success(
        data={
            "id": str(new_table.id),
            "name": new_table.name,
            "section_id": str(new_table.section_id),
            "section_name": section.name,
            "seats": new_table.seats,
            "status": new_table.status,
            "server_id": None,
            "server_name": None,
            "x_position": new_table.x_position,
            "y_position": new_table.y_position
        },
        message=f"Table '{new_table.name}' created successfully"
    )

@router.put("/tables/{table_id}/status")
async def update_table_status(
    table_id: str,
    status: str,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update table status"""
    
    # Validate status
    valid_statuses = ["available", "occupied", "reserved", "cleaning"]
    if status not in valid_statuses:
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Find table
    table = db.query(Table).filter(
        and_(
            Table.id == table_id,
            Table.restaurant_id == restaurant_id
        )
    ).first()
    
    if not table:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Table not found"
        )
    
    table.status = status
    table.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(table)
    
    # Get section name
    section = db.query(Section).filter(Section.id == table.section_id).first()
    
    # Get server name if assigned
    server_name = None
    if table.server_id:
        server = db.query(User).filter(User.id == table.server_id).first()
        if server:
            server_name = f"{server.first_name} {server.last_name}"
    
    table_data = {
        "id": str(table.id),
        "name": table.name,
        "section_id": str(table.section_id),
        "section_name": section.name if section else "",
        "seats": table.seats,
        "status": table.status,
        "server_id": str(table.server_id) if table.server_id else None,
        "server_name": server_name,
        "x_position": table.x_position,
        "y_position": table.y_position
    }
    
    return APIResponseHelper.success(
        data=table_data,
        message=f"Table {table.name} status updated to {status}"
    )

@router.put("/tables/{table_id}/server")
async def update_table_server(
    table_id: str,
    server_id: Optional[str] = None,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign server to table"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Find table
    table = db.query(Table).filter(
        and_(
            Table.id == table_id,
            Table.restaurant_id == restaurant_id
        )
    ).first()
    
    if not table:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Table not found"
        )
    
    # Validate server if provided
    server_name = None
    if server_id:
        server = db.query(User).filter(
            and_(
                User.id == server_id,
                User.restaurant_id == restaurant_id
            )
        ).first()
        
        if not server:
            raise FynloException(
                error_code=ErrorCodes.RESOURCE_NOT_FOUND,
                detail="Server not found"
            )
        
        server_name = f"{server.first_name} {server.last_name}"
    
    table.server_id = server_id
    table.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(table)
    
    # Get section name
    section = db.query(Section).filter(Section.id == table.section_id).first()
    
    table_data = {
        "id": str(table.id),
        "name": table.name,
        "section_id": str(table.section_id),
        "section_name": section.name if section else "",
        "seats": table.seats,
        "status": table.status,
        "server_id": str(table.server_id) if table.server_id else None,
        "server_name": server_name,
        "x_position": table.x_position,
        "y_position": table.y_position
    }
    
    return APIResponseHelper.success(
        data=table_data,
        message=f"Table {table.name} server updated"
    )

# Layout Management Endpoints
# COMMENTED OUT: Floor plan layout endpoints temporarily disabled 
# The floor_plan_layout column was removed from the database
# These endpoints need to be updated to use a different storage mechanism
# before they can be re-enabled

# class FloorPlanLayoutUpdate(BaseModel):
#     layout: dict

# @router.get("/floor-plan/layout")
# async def get_floor_plan_layout(
#     current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """Get restaurant floor plan layout"""
#     
#     # Validate restaurant access
#     await TenantSecurity.validate_restaurant_access(
#         current_user, 
#         current_restaurant_id or current_user.restaurant_id, 
#         db=db
#     )
#     # Use the provided restaurant_id or fall back to user's default
#     restaurant_id = current_restaurant_id or current_user.restaurant_id
#     
#     restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
#     
#     if not restaurant:
#         raise FynloException(
#             error_code=ErrorCodes.RESOURCE_NOT_FOUND,
#             detail="Restaurant not found"
#         )
#     
#     return APIResponseHelper.success(
#         data={
#             "layout": restaurant.floor_plan_layout or {},
#             "restaurant_id": str(restaurant.id)
#         },
#         message="Floor plan layout retrieved successfully"
#     )

# @router.put("/floor-plan/layout")
# async def update_floor_plan_layout(
#     layout_data: FloorPlanLayoutUpdate,
#     current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db)
# ):
#     """Update restaurant floor plan layout"""
#     
#     # Validate restaurant access
#     await TenantSecurity.validate_restaurant_access(
#         current_user, 
#         current_restaurant_id or current_user.restaurant_id, 
#         db=db
#     )
#     # Use the provided restaurant_id or fall back to user's default
#     restaurant_id = current_restaurant_id or current_user.restaurant_id
#     
#     restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
#     
#     if not restaurant:
#         raise FynloException(
#             error_code=ErrorCodes.RESOURCE_NOT_FOUND,
#             detail="Restaurant not found"
#         )
#     
#     # Validate layout JSON
#     try:
#         validated_layout = validate_model_jsonb_fields('restaurant', 'floor_plan_layout', layout_data.layout)
#     except ValidationErr as e:
#         raise FynloException(
#             error_code=ErrorCodes.VALIDATION_ERROR,
#             detail=f"Layout validation failed: {str(e)}"
#         )
#     
#     restaurant.floor_plan_layout = validated_layout
#     restaurant.updated_at = datetime.utcnow()
#     db.commit()
#     db.refresh(restaurant)
#     
#     return APIResponseHelper.success(
#         data={
#             "layout": restaurant.floor_plan_layout,
#             "restaurant_id": str(restaurant.id)
#         },
#         message="Floor plan layout updated successfully"
#     )

# Table Position Updates
class TablePositionUpdate(BaseModel):
    x_position: int
    y_position: int
    width: Optional[int] = None
    height: Optional[int] = None
    rotation: Optional[int] = None

@router.put("/tables/{table_id}/position")
async def update_table_position(
    table_id: str,
    position_data: TablePositionUpdate,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update table position and dimensions"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Find table
    table = db.query(Table).filter(
        and_(
            Table.id == table_id,
            Table.restaurant_id == restaurant_id
        )
    ).first()
    
    if not table:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Table not found"
        )
    
    # Update position and dimensions
    table.x_position = position_data.x_position
    table.y_position = position_data.y_position
    
    if position_data.width is not None:
        table.width = position_data.width
    if position_data.height is not None:
        table.height = position_data.height
    if position_data.rotation is not None:
        table.rotation = position_data.rotation
    
    table.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(table)
    
    # Get section name for response
    section = db.query(Section).filter(Section.id == table.section_id).first()
    
    # Broadcast table update via WebSocket
    try:
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            {
                "type": "table_updated",
                "table_id": str(table.id),
                "position": {
                    "x": table.x_position,
                    "y": table.y_position,
                    "width": table.width,
                    "height": table.height,
                    "rotation": table.rotation
                }
            }
        )
    except Exception as e:
        # Don't fail the request if WebSocket fails
        pass
    
    table_data = {
        "id": str(table.id),
        "name": table.name,
        "section_id": str(table.section_id),
        "section_name": section.name if section else "",
        "seats": table.seats,
        "status": table.status,
        "x_position": table.x_position,
        "y_position": table.y_position,
        "width": table.width,
        "height": table.height,
        "rotation": table.rotation,
        "shape": table.shape
    }
    
    return APIResponseHelper.success(
        data=table_data,
        message=f"Table {table.name} position updated"
    )

# Table Merge/Split Operations
class TableMergeRequest(BaseModel):
    primary_table_id: str
    tables_to_merge: List[str]
    merged_name: Optional[str] = None

@router.post("/tables/merge")
async def merge_tables(
    merge_data: TableMergeRequest,
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Merge multiple tables into one"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Validate primary table
    primary_table = db.query(Table).filter(
        and_(
            Table.id == merge_data.primary_table_id,
            Table.restaurant_id == restaurant_id
        )
    ).first()
    
    if not primary_table:
        raise FynloException(
            error_code=ErrorCodes.RESOURCE_NOT_FOUND,
            detail="Primary table not found"
        )
    
    # Validate merge tables
    merge_tables = db.query(Table).filter(
        and_(
            Table.id.in_(merge_data.tables_to_merge),
            Table.restaurant_id == restaurant_id
        )
    ).all()
    
    if len(merge_tables) != len(merge_data.tables_to_merge):
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail="Some tables to merge were not found"
        )
    
    # Check if any tables are occupied
    occupied_tables = [t for t in [primary_table] + merge_tables if t.status == 'occupied']
    if occupied_tables:
        table_names = [t.name for t in occupied_tables]
        raise FynloException(
            error_code=ErrorCodes.VALIDATION_ERROR,
            detail=f"Cannot merge occupied tables: {', '.join(table_names)}"
        )
    
    # Calculate merged capacity
    total_seats = primary_table.seats + sum(t.seats for t in merge_tables)
    
    # Update primary table
    primary_table.seats = total_seats
    primary_table.name = merge_data.merged_name or f"{primary_table.name} (Merged)"
    primary_table.status = "reserved"  # Mark as reserved during merge
    primary_table.updated_at = datetime.utcnow()
    
    # Mark merge tables as inactive (soft delete)
    for table in merge_tables:
        table.is_active = False
        table.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(primary_table)
    
    # Broadcast merge via WebSocket
    try:
        await websocket_manager.broadcast_to_restaurant(
            restaurant_id,
            {
                "type": "tables_merged",
                "primary_table_id": str(primary_table.id),
                "merged_table_ids": [str(t.id) for t in merge_tables],
                "new_capacity": total_seats
            }
        )
    except Exception as e:
        pass
    
    return APIResponseHelper.success(
        data={
            "merged_table": {
                "id": str(primary_table.id),
                "name": primary_table.name,
                "seats": primary_table.seats,
                "status": primary_table.status
            },
            "merged_table_ids": [str(t.id) for t in merge_tables]
        },
        message=f"Tables merged successfully. New capacity: {total_seats} seats"
    )

# Revenue Analytics
@router.get("/analytics/revenue-by-table")
async def get_revenue_by_table(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_restaurant_id: Optional[str] = Query(None, description="Specific restaurant ID for multi-restaurant users"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get revenue breakdown by table"""
    
    # Validate restaurant access
    await TenantSecurity.validate_restaurant_access(
        current_user, 
        current_restaurant_id or current_user.restaurant_id, 
        db=db
    )
    # Use the provided restaurant_id or fall back to user's default
    restaurant_id = current_restaurant_id or current_user.restaurant_id
    
    # Set default date range (today if not specified)
    if not start_date:
        start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    
    if not end_date:
        end_date = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)
    else:
        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Get orders with table information
    orders_query = db.query(Order, Table).join(
        Table, Order.table_id == Table.id, isouter=True
    ).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= start_date,
            Order.created_at <= end_date,
            Order.status == "completed"
        )
    )
    
    orders_data = orders_query.all()
    
    # Group by table
    table_revenue = {}
    total_revenue = 0
    orders_without_table = []
    
    for order, table in orders_data:
        total_revenue += float(order.total_amount)
        
        if table:
            table_key = str(table.id)
            if table_key not in table_revenue:
                table_revenue[table_key] = {
                    "table_id": str(table.id),
                    "table_name": table.name,
                    "section_name": "",  # Will be filled below
                    "total_revenue": 0,
                    "order_count": 0,
                    "average_order_value": 0
                }
            
            table_revenue[table_key]["total_revenue"] += float(order.total_amount)
            table_revenue[table_key]["order_count"] += 1
        else:
            orders_without_table.append({
                "order_id": str(order.id),
                "order_number": order.order_number,
                "amount": float(order.total_amount),
                "order_type": order.order_type
            })
    
    # Get section names
    if table_revenue:
        table_ids = list(table_revenue.keys())
        tables_with_sections = db.query(Table, Section).join(
            Section, Table.section_id == Section.id
        ).filter(Table.id.in_(table_ids)).all()
        
        for table, section in tables_with_sections:
            table_key = str(table.id)
            if table_key in table_revenue:
                table_revenue[table_key]["section_name"] = section.name
    
    # Calculate averages
    for table_data in table_revenue.values():
        if table_data["order_count"] > 0:
            table_data["average_order_value"] = round(
                table_data["total_revenue"] / table_data["order_count"], 2
            )
    
    # Sort by revenue
    table_revenue_list = list(table_revenue.values())
    table_revenue_list.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    return APIResponseHelper.success(
        data={
            "date_range": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "total_revenue": round(total_revenue, 2),
            "table_revenue": table_revenue_list,
            "orders_without_table": orders_without_table,
            "summary": {
                "tables_with_revenue": len(table_revenue_list),
                "orders_without_table_count": len(orders_without_table)
            }
        },
        message=f"Revenue analysis for {len(table_revenue_list)} tables"
    )

# Include restaurant deletion endpoints from restaurant_deletion module
# Import the router from restaurant_deletion module
from .restaurant_deletion import router as deletion_router
router.include_router(deletion_router, tags=["restaurant_deletion"])
