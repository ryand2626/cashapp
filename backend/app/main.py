"""
Fynlo POS Backend API
Clean FastAPI implementation for hardware-free restaurant management
Version: 2.1.0 - Portal alignment with optional PDF exports
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, get_db, User
from app.api.v1.api import api_router
from app.api.mobile.endpoints import router as mobile_router
from app.core.redis_client import init_redis, close_redis
from app.core.websocket import websocket_manager
from app.core.exceptions import register_exception_handlers
from app.middleware.rate_limit_middleware import init_fastapi_limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.responses import APIResponseHelper
from app.core.mobile_middleware import (
    MobileCompatibilityMiddleware,
    MobileDataOptimizationMiddleware
)
from app.middleware.version_middleware import APIVersionMiddleware
from app.middleware.security_headers_middleware import SecurityHeadersMiddleware # Added import
from app.middleware.sql_injection_waf import SQLInjectionWAFMiddleware
from app.core.auth import get_current_user
from datetime import datetime

# Configure logging
# Logging level will be set by Uvicorn based on settings.LOG_LEVEL
# logging.basicConfig(level=settings.LOG_LEVEL.upper()) # Not needed if uvicorn handles it
logger = logging.getLogger(__name__)

# Apply logging filters for production
# This should be done after basic logging config but before the app starts handling requests.
# Note: Uvicorn sets up its own handlers. This filter will apply to log records
# processed by the application's loggers. For Uvicorn's access logs,
# different configuration might be needed if they also contain sensitive data.
from app.core.logging_filters import setup_logging_filters
if settings.ENVIRONMENT == "production" or not settings.ERROR_DETAIL_ENABLED:
    # We call this early, but it depends on `settings` being initialized.
    # Logging needs to be configured before this call if it relies on basicConfig.
    # If Uvicorn manages basicConfig, this should be fine.
    setup_logging_filters()


security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize application on startup"""
    logger.info(f"🚀 Fynlo POS Backend starting in {settings.ENVIRONMENT} mode...")
    
    # Initialize database and Redis
    try:
        from app.core.database import init_db
        from app.core.redis_client import init_redis
        
        logger.info("Initializing database...")
        await init_db()
        
        logger.info("Initializing Redis...")
        await init_redis()
        
        logger.info("Initializing rate limiter...")
        await init_fastapi_limiter()
        
        # Set the limiter on app.state for SlowAPI middleware
        from app.middleware.rate_limit_middleware import limiter
        app.state.limiter = limiter
        logger.info("✅ SlowAPI limiter attached to app.state")
        
        logger.info("Initializing WebSocket services...")
        from app.api.v1.endpoints.websocket_enhanced import init_websocket_services, start_health_monitor
        await init_websocket_services()
        await start_health_monitor()
        
        logger.info("Initializing instance tracker...")
        from app.services.instance_tracker import init_instance_tracker
        from app.core.redis_client import redis_client
        await init_instance_tracker(redis_client)
        
        # Initialize cache warming
        logger.info("Initializing cache warming...")
        from app.core.cache_warmer import warm_cache_on_startup, warm_cache_task
        from app.core.database import SessionLocal
        import asyncio
        
        # Use SessionLocal directly for non-dependency-injection contexts
        db = SessionLocal()
        try:
            await warm_cache_on_startup(db)
        finally:
            db.close()
        
        # Start background cache warming task
        asyncio.create_task(warm_cache_task())
        logger.info("✅ Cache warming initialized")
        
        logger.info("✅ Core services initialized successfully")
    except Exception as e:
        logger.error(f"Core services initialization failed: {e}")
        # Continue startup even if initialization fails
    
    yield
    
    # Cleanup
    logger.info("Stopping instance tracker...")
    from app.services.instance_tracker import stop_instance_tracker
    await stop_instance_tracker()
    
    logger.info("Closing Redis connection...")
    await close_redis()
    
    logger.info("✅ Cleanup complete")

app = FastAPI(
    title=settings.APP_NAME,
    description="Hardware-Free Restaurant Management Platform",
    version="1.0.0",
    lifespan=lifespan,
    debug=settings.DEBUG and settings.ENVIRONMENT != "production"  # Ensure debug is disabled in production
)

# CORS middleware for React Native frontend and Supabase
if settings.ENVIRONMENT == "production":
    allowed_origins = settings.PRODUCTION_ALLOWED_ORIGINS
else:
    # Use CORS_ORIGINS from settings for development, fallback to permissive
    allowed_origins = settings.cors_origins_list if settings.cors_origins_list else ["*"]

# Add Supabase domains to allowed origins
supabase_origins = [
    "https://*.supabase.co",
    "https://*.supabase.io"
]

# Add specific Supabase URL if configured
if settings.SUPABASE_URL:
    supabase_origins.append(settings.SUPABASE_URL)

# Combine all allowed origins
if isinstance(allowed_origins, list):
    allowed_origins = allowed_origins + supabase_origins
else:
    allowed_origins = [allowed_origins] + supabase_origins

# Ensure unique origins
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"^https://fynlo-[a-zA-Z0-9\-]+\.vercel\.app$" if settings.ENVIRONMENT != "production" else None
)

# TEMPORARY: Disable complex middleware for deployment
# Add API version middleware for backward compatibility (FIRST in middleware stack)
# app.add_middleware(APIVersionMiddleware)

# Add Security Headers Middleware (after CORS and Versioning, before others)
# app.add_middleware(SecurityHeadersMiddleware)

# Add RLS middleware for session variable isolation
from app.middleware.rls_middleware import RLSMiddleware
app.add_middleware(RLSMiddleware)

# Add SQL Injection WAF middleware for additional protection
app.add_middleware(SQLInjectionWAFMiddleware, enabled=True, log_attacks=True)

# Add mobile compatibility middleware
# app.add_middleware(MobileCompatibilityMiddleware, enable_cors=True, enable_port_redirect=True)
# app.add_middleware(MobileDataOptimizationMiddleware)

# Add SlowAPI middleware (for rate limiting)
app.add_middleware(SlowAPIMiddleware)

# Register standardized exception handlers
# register_exception_handlers(app) # General handlers

# Add specific handler for rate limit exceeded
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Include mobile-optimized routes (both prefixed and Odoo-style)
app.include_router(mobile_router, prefix="/api/mobile", tags=["mobile"])
app.include_router(mobile_router, prefix="", tags=["mobile-compatibility"])  # For Odoo-style endpoints

# WebSocket routes are handled through the websocket router in api.py

@app.get("/")
async def root():
    """Health check endpoint with standardized response"""
    return APIResponseHelper.success(
        data={
            "service": "Fynlo POS Backend API",
            "version": "1.0.0",
            "status": "healthy",
            "api_version": "v1",
            "backward_compatible": True
        },
        message="Fynlo POS API is running"
    )

@app.get("/health")
async def health_check():
    """Ultra-fast health check for DigitalOcean deployment - NO EXTERNAL CHECKS"""
    
    # CRITICAL FIX: Return immediately without any DB/Redis checks to avoid Error 524 timeouts
    # This endpoint is called every 10 seconds by DigitalOcean - it MUST be instant
    return {
        "status": "healthy",
        "service": "fynlo-pos-backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/version")
async def api_version_info():
    """API version information endpoint"""
    return APIResponseHelper.success(
        data={
            "current_version": "v1",
            "supported_versions": ["v1"],
            "backward_compatible": True,
            "version_middleware_enabled": True,
            "websocket_path_normalization": True,
            "documentation": {
                "versioned_endpoints": "/api/v1/{resource}",
                "unversioned_fallback": "/api/{resource} → /api/v1/{resource}",
                "websocket_paths": {
                    "/ws/{id}": "/api/v1/websocket/ws/{id}",
                    "/websocket/{id}": "/api/v1/websocket/ws/{id}"
                }
            }
        },
        message="API version information"
    )


# Hardcoded menu endpoints removed - now using proper router at /api/v1/menu/
# See app/api/v1/endpoints/menu.py for database-driven menu endpoints

def format_employee_response(employee):
    """Format employee with all required fields"""
    from datetime import datetime
    
    return {
        "id": employee.id,
        "name": f"{getattr(employee, 'first_name', '')} {getattr(employee, 'last_name', '')}".strip() or employee.email,
        "email": employee.email,
        "role": employee.role,
        "hourlyRate": float(getattr(employee, 'hourly_rate', 0) or 0),
        "totalSales": float(getattr(employee, 'total_sales', 0) or 0),
        "performanceScore": float(getattr(employee, 'performance_score', 0) or 0),
        "isActive": getattr(employee, 'is_active', True),
        "hireDate": employee.hire_date.isoformat() if hasattr(employee, 'hire_date') and employee.hire_date else datetime.now().isoformat(),
        "startDate": employee.start_date.isoformat() if hasattr(employee, 'start_date') and employee.start_date else datetime.now().isoformat(),
        "phone": getattr(employee, 'phone', '') or '',
        "totalOrders": int(getattr(employee, 'total_orders', 0) or 0),
        "avgOrderValue": float(getattr(employee, 'avg_order_value', 0) or 0),
        "hoursWorked": float(getattr(employee, 'hours_worked', 0) or 0)
    }

@app.get("/api/v1/employees")
async def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get employees"""
    from datetime import datetime, timedelta
    
    # Try to get real employees from database
    try:
        employees = db.query(User).filter(
            User.restaurant_id == current_user.restaurant_id,
            User.is_active == True
        ).all()
        
        if employees:
            return APIResponseHelper.success(
                data=[format_employee_response(emp) for emp in employees],
                message=f"Retrieved {len(employees)} employees"
            )
    except Exception as e:
        print(f"Error fetching employees: {str(e)}")
    
    # Fallback to mock data if no real data
    base_date = datetime.now() - timedelta(days=365)
    
    return APIResponseHelper.success(
        data=[
            {
                "id": 1,
                "name": "John Manager",
                "email": "john@restaurant.com",
                "role": "manager",
                "hourlyRate": 25.00,
                "totalSales": 15420.50,
                "performanceScore": 9.2,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=730)).isoformat(),  # 2 years ago
                "startDate": (base_date - timedelta(days=730)).isoformat(),
                "phone": "+44 7700 900100",
                "totalOrders": 342,
                "avgOrderValue": 45.03,
                "hoursWorked": 1680
            },
            {
                "id": 2,
                "name": "Sarah Cashier", 
                "email": "sarah@restaurant.com",
                "role": "cashier",
                "hourlyRate": 15.50,
                "totalSales": 8750.25,
                "performanceScore": 8.8,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=365)).isoformat(),  # 1 year ago
                "startDate": (base_date - timedelta(days=365)).isoformat(),
                "phone": "+44 7700 900101",
                "totalOrders": 256,
                "avgOrderValue": 34.18,
                "hoursWorked": 1120
            },
            {
                "id": 3,
                "name": "Mike Server",
                "email": "mike@restaurant.com",
                "role": "server",
                "hourlyRate": 12.50,
                "totalSales": 6230.15,
                "performanceScore": 8.5,
                "isActive": True,
                "hireDate": (base_date - timedelta(days=180)).isoformat(),  # 6 months ago
                "startDate": (base_date - timedelta(days=180)).isoformat(),
                "phone": "+44 7700 900102",
                "totalOrders": 198,
                "avgOrderValue": 31.47,
                "hoursWorked": 560
            }
        ],
        message="Employees retrieved"
    )

@app.get("/api/v1/platform/settings/service-charge")
async def get_service_charge():
    """Get platform service charge settings"""
    return APIResponseHelper.success(
        data={
            "enabled": True,
            "rate": 0.125,  # 12.5%
            "description": "Platform service charge",
            "lastUpdated": "2025-01-08T16:30:00Z"
        },
        message="Service charge settings retrieved"
    )

@app.get("/api/v1/orders")
async def get_orders():
    """Get recent orders"""
    from datetime import datetime, timedelta
    import random
    
    # Generate mock orders
    orders = []
    statuses = ["completed", "in_progress", "pending"]
    
    for i in range(20):
        order_time = datetime.now() - timedelta(minutes=random.randint(0, 1440))
        orders.append({
            "id": f"ORD{1000 + i}",
            "orderNumber": 1000 + i,
            "customerName": f"Customer {i + 1}",
            "items": [
                {"name": "Nachos", "quantity": 1, "price": 5.00},
                {"name": "Tacos", "quantity": 2, "price": 3.50}
            ],
            "total": 12.00 + (i * 2.5),
            "status": random.choice(statuses),
            "createdAt": order_time.isoformat(),
            "completedAt": (order_time + timedelta(minutes=15)).isoformat() if random.choice(statuses) == "completed" else None
        })
    
    return APIResponseHelper.success(
        data=orders,
        message="Orders retrieved"
    )

@app.get("/api/v1/customers")
async def get_customers():
    """Get customers"""
    customers = [
        {
            "id": "CUST001",
            "name": "John Smith",
            "email": "john@example.com",
            "phone": "+44 7700 900001",
            "totalOrders": 25,
            "totalSpent": 312.50,
            "lastVisit": "2025-01-08"
        },
        {
            "id": "CUST002",
            "name": "Sarah Johnson",
            "email": "sarah@example.com",
            "phone": "+44 7700 900002",
            "totalOrders": 18,
            "totalSpent": 245.00,
            "lastVisit": "2025-01-07"
        }
    ]
    
    return APIResponseHelper.success(
        data=customers,
        message="Customers retrieved"
    )

@app.get("/api/v1/inventory")
async def get_inventory():
    """Get inventory items"""
    inventory = [
        {
            "id": "INV001",
            "name": "Tortilla Chips",
            "category": "Dry Goods",
            "currentStock": 50,
            "unit": "bags",
            "reorderLevel": 20,
            "lastRestocked": "2025-01-05"
        },
        {
            "id": "INV002",
            "name": "Black Beans",
            "category": "Canned Goods",
            "currentStock": 30,
            "unit": "cans",
            "reorderLevel": 15,
            "lastRestocked": "2025-01-03"
        }
    ]
    
    return APIResponseHelper.success(
        data=inventory,
        message="Inventory retrieved"
    )

@app.get("/api/v1/test/supabase-config")
async def test_supabase_config():
    """Test endpoint to verify Supabase configuration"""
    import os
    
    # Check all possible sources
    env_checks = {
        "settings_url": bool(getattr(settings, 'SUPABASE_URL', None)),
        "settings_key": bool(getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', None)),
        "env_url": bool(os.getenv("SUPABASE_URL")),
        "env_key": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
        "env_alt_key": bool(os.getenv("supabase_secret_key")),
    }
    
    # List all env vars containing SUPA or SECRET (names only)
    all_env_vars = list(os.environ.keys())
    relevant_vars = [var for var in all_env_vars if 'SUPA' in var.upper() or ('SECRET' in var.upper() and 'KEY' in var.upper())]
    
    try:
        from app.core.supabase import get_admin_client
        client = get_admin_client()
        
        return APIResponseHelper.success(
            data={
                "status": "success",
                "checks": env_checks,
                "client_initialized": client is not None,
                "environment": settings.ENVIRONMENT,
                "relevant_env_vars": relevant_vars
            },
            message="Supabase configuration verified"
        )
    except Exception as e:
        return APIResponseHelper.success(
            data={
                "status": "error",
                "error": str(e),
                "checks": env_checks,
                "environment": settings.ENVIRONMENT,
                "relevant_env_vars": relevant_vars
            },
            message="Supabase configuration check failed"
        )

@app.get("/api/v1/analytics/dashboard/mobile")
async def get_analytics_dashboard():
    """Get analytics dashboard for mobile"""
    return APIResponseHelper.success(
        data={
            "revenue": {
                "today": 2847.50,
                "yesterday": 3156.80,
                "thisWeek": 18432.75,
                "lastWeek": 19875.20,
                "thisMonth": 67890.50,
                "lastMonth": 71234.80
            },
            "orders": {
                "today": 42,
                "yesterday": 48,
                "thisWeek": 287,
                "lastWeek": 312,
                "averageOrderValue": 67.80
            },
            "topItems": [
                {"name": "Nachos", "quantity": 156, "revenue": 780.00},
                {"name": "Carnitas Tacos", "quantity": 134, "revenue": 469.00},
                {"name": "Quesadillas", "quantity": 98, "revenue": 539.00}
            ],
            "hourlyBreakdown": [],
            "paymentMethods": {
                "card": {"count": 178, "percentage": 62},
                "cash": {"count": 65, "percentage": 23},
                "applePay": {"count": 44, "percentage": 15}
            },
            "staffPerformance": [
                {"name": "John Manager", "orders": 89, "revenue": 5234.50},
                {"name": "Sarah Cashier", "orders": 76, "revenue": 4567.80}
            ]
        },
        message="Analytics dashboard data retrieved"
    )

@app.get("/api/v1/schedule/week")
async def get_week_schedule():
    """Get weekly schedule"""
    from datetime import datetime, timedelta
    
    # Generate a mock weekly schedule
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    
    schedule_data = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for i, day in enumerate(days):
        date = week_start + timedelta(days=i)
        schedule_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "day": day,
            "shifts": [
                {
                    "employeeId": 1,
                    "employeeName": "John Manager",
                    "startTime": "09:00",
                    "endTime": "17:00",
                    "role": "manager"
                },
                {
                    "employeeId": 2,
                    "employeeName": "Sarah Cashier",
                    "startTime": "10:00",
                    "endTime": "18:00",
                    "role": "cashier"
                }
            ]
        })
    
    return APIResponseHelper.success(
        data=schedule_data,
        message="Weekly schedule retrieved"
    )

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 8000))  # Use DigitalOcean's PORT env var
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )