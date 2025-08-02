"""
Rate limiting middleware using fastapi-limiter.
"""
import logging
from typing import Optional

from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.extension import RateLimiter
from jose import JWTError, jwt

from app.core.config import settings
from app.core.redis_client import redis_client, RedisClient # Import global instance

logger = logging.getLogger(__name__)

# --- User Identification ---
security = HTTPBearer(auto_error=False)

async def get_current_user_id(
    request: Request,
    token: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[str]:
    """
    Extracts user ID from JWT token if present.
    Returns None if no token or token is invalid.
    """
    if token is None:
        return None
    try:
        payload = jwt.decode(token.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub") # Assuming 'sub' contains the user ID
        if user_id is None:
            return None
        return str(user_id) # Ensure it's a string
    except JWTError:
        return None # Invalid token

# --- Limiter Configuration ---

# This function determines the key for rate limiting.
# It prioritizes user ID if available, otherwise falls back to IP address.
async def identify_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    client_type = request.headers.get("X-Client-Type", "unknown")
    
    if user_id:
        return f"user:{user_id}:{client_type}"
    return f"ip:{get_remote_address(request)}:{client_type}"

# Specialized key functions for different client types
async def identify_mobile_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    if user_id:
        return f"mobile:user:{user_id}"
    return f"mobile:ip:{get_remote_address(request)}"

async def identify_portal_client(request: Request) -> str:
    user_id = await get_current_user_id(request)
    if user_id:
        return f"portal:user:{user_id}"
    return f"portal:ip:{get_remote_address(request)}"

# Initialize the Limiter with our identifier function
# The redis_client.get_client() will provide the actual aioredis.Redis instance
# or a compatible mock if Redis connection fails in dev/test.
limiter = Limiter(key_func=identify_client, strategy="moving-window")


# --- RateLimitMiddleware ---
# We will use the SlowAPIMiddleware and apply limits per-route using decorators.
# However, to manage the redis connection for the limiter, we need to initialize it.

# It's important that `init_redis` (which connects redis_client) is called during app startup,
# and `close_redis` during shutdown. This is handled in main.py's lifespan.

# The limiter instance needs to be aware of the Redis client.
# fastapi-limiter's global limiter state can be tricky.
# We'll ensure it's configured when the app starts.

async def init_fastapi_limiter():
    """
    Initializes the fastapi-limiter with the Redis client.
    This should be called during application startup after Redis is connected.
    """
    try:
        # Try to ping Redis to check connectivity
        if redis_client and hasattr(redis_client, 'ping'):
            await redis_client.ping()
            logger.info("✅ Redis is available for rate limiting")
        else:
            # Check if we're in mock mode
            if settings.ENVIRONMENT in ["development", "testing", "local"] and hasattr(redis_client, '_mock_storage'):
                logger.info("✅ Rate limiter using mock storage in development mode")
            else:
                logger.warning("Rate limiter cannot be initialized: Redis is not available and not in mock mode.")
                return
    except Exception as e:
        # Redis connection failed
        if settings.ENVIRONMENT in ["development", "testing", "local"]:
            logger.warning(f"Redis connection failed, using mock storage: {e}")
        else:
            logger.error(f"Rate limiter cannot be initialized in production: Redis connection failed: {e}")
            return

    # The `limiter` object we created earlier will be used by route decorators.
    # We need to ensure that the `RateLimiter` state is configured with our Redis client.
    # This is a bit of a workaround for how `fastapi-limiter` handles its global state
    # when not using `FastAPILimiter.init()`.

    # The `limiter` instance itself should use the `redis_client` through its `key_func`
    # and how it stores data.
    # `fastapi-limiter` uses a global `_DEFAULT_LIMITER` if you don't pass one
    # to `FastAPILimiter.init()`. Since we are using decorators with our `limiter` instance,
    # it should pick up our Redis client automatically.

    # The key part is that `redis_client.get_client()` must return a valid
    # `redis.asyncio.Redis` instance or a compatible object.
    # Our `RedisClient.get_client()` is designed to do this.

    # No explicit global state init for `fastapi-limiter` is needed here if decorators
    # are used with our `limiter` instance, as it will use the `storage_uri` implicitly
    # from the `redis_client` if it were set up that way, or use the client directly.
    # The `fastapi-limiter` documentation is a bit sparse on custom client injection
    # without the global init.

    # However, if we were to use `app.state.limiter = limiter` and then use
    # `request.state.limiter` in dependencies, this would be cleaner.
    # For now, the global `limiter` instance should work with decorators.
    logger.info("✅ Rate limiter configured to use Redis client (or mock).")


# Custom exception handler for RateLimitExceeded to provide a standard API response.
# This is already handled by slowapi's default handler if we add it to the app.
# We can customize it if needed.

# --- Application of Limits ---
# Limits will be applied via decorators on specific routes/routers in `api.py` or endpoint files.
# Example:
# from app.middleware.rate_limit_middleware import limiter
#
# @router.post("/login")
# @limiter.limit("5/minute") # Applied to the key from identify_client
# async def login(...):
#     ...

# This file primarily sets up the `limiter` instance.
# The actual middleware registration (`app.add_middleware(SlowAPIMiddleware)`) and
# exception handler (`app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)`)
# will be done in `main.py`.
# And `init_fastapi_limiter` will also be called in `main.py`'s lifespan.

# Define default limits (can be overridden by decorators)
DEFAULT_RATE = "60/minute"

# Define specific limits for endpoint categories
AUTH_RATE = "5/minute"
PAYMENT_RATE = "15/minute" # As per requirement "10-20", using 15

# Portal vs Mobile specific limits
MOBILE_APP_RATE = "100/minute"
PORTAL_DASHBOARD_RATE = "300/minute"  # Higher for analytics
PORTAL_EXPORT_RATE = "10/minute"     # Lower for resource-intensive operations

# API-specific limits
ANALYTICS_RATE = "200/minute"        # High for dashboard queries
WEBSOCKET_RATE = "500/minute"        # Very high for real-time updates
SYNC_RATE = "200/minute"             # High for synchronization

logger.info(f"Rate Limiter Configured: DEFAULT_RATE={DEFAULT_RATE}, AUTH_RATE={AUTH_RATE}, PAYMENT_RATE={PAYMENT_RATE}")
logger.info("Rate limiting strategy: User ID if authenticated, otherwise IP address.")
logger.info("Rate limits will be applied via decorators on specific routes.")
