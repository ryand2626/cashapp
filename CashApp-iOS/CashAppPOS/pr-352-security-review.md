# Security Review: PR #352 - WebSocket Restaurant Owner Onboarding Fix

## Executive Summary
PR #352 addresses a critical UX issue where new restaurant owners couldn't connect to WebSocket during onboarding. The fix is functional but introduces several security concerns that need immediate attention.

## The Fix Analysis

### What Changed
The PR modifies the `verify_websocket_access` function to allow restaurant owners without a `restaurant_id` to connect to "onboarding" endpoints:

```python
elif user.role == "restaurant_owner":
    # Handle restaurant owners
    if not user.restaurant_id:
        # Restaurant owner without a restaurant - they're in onboarding
        if restaurant_id != "onboarding":
            logger.warning(f"Restaurant owner without restaurant trying to access: {restaurant_id}")
            return False
        logger.info(f"Restaurant owner {user.id} in onboarding phase (no restaurant yet)")
    elif str(user.restaurant_id) != restaurant_id and restaurant_id != "onboarding":
        logger.warning(f"Restaurant owner access denied: {user.restaurant_id} != {restaurant_id}")
        return False
```

### Security Assessment

## 🔴 Critical Security Issues

### 1. **No Input Validation on restaurant_id**
```python
restaurant_id: str = Path(..., description="Restaurant ID")
```
**Risk**: SQL injection, path traversal, or malformed input attacks
**Impact**: Could allow unauthorized access to other restaurants' data
**Fix Required**: 
```python
# Add validation
if not re.match(r'^[a-zA-Z0-9-_]+$', restaurant_id):
    raise ValueError("Invalid restaurant_id format")
if len(restaurant_id) > 50:
    raise ValueError("Restaurant ID too long")
```

### 2. **Information Disclosure in Error Messages**
```python
logger.warning(f"Restaurant owner without restaurant trying to access: {restaurant_id}")
logger.warning(f"Restaurant owner access denied: {user.restaurant_id} != {restaurant_id}")
```
**Risk**: Exposes internal system state and user relationships
**Impact**: Attackers can enumerate valid restaurant IDs and user associations
**Fix Required**: Use generic error messages for external responses

### 3. **Missing Rate Limiting**
**Risk**: DoS attacks through WebSocket connection flooding
**Impact**: System overload, service disruption
**Fix Required**: Implement connection rate limiting per IP/user

### 4. **No Connection Limits**
**Risk**: Resource exhaustion attacks
**Impact**: Memory/CPU exhaustion through unlimited connections
**Fix Required**: Limit concurrent connections per user/restaurant

## 🟡 Medium Security Issues

### 5. **Weak Token Handling**
```python
token = websocket.query_params.get("token")
```
**Risk**: Tokens in query parameters are logged and cached
**Impact**: Token exposure in server logs, browser history
**Recommendation**: Use headers exclusively for authentication tokens

### 6. **Missing CORS/Origin Validation**
**Risk**: Cross-origin WebSocket hijacking
**Impact**: Unauthorized connections from malicious websites
**Fix Required**: Validate Origin header against whitelist

### 7. **No Message Size Limits**
**Risk**: Memory exhaustion through large messages
**Impact**: DoS through oversized payloads
**Fix Required**: Implement message size limits

## 🟢 Positive Security Aspects

1. **Proper Authentication Check**: Validates Supabase tokens
2. **User ID Verification**: Checks token user matches claimed user
3. **Role-Based Access**: Enforces role-specific restrictions
4. **Active User Check**: Verifies user.is_active status

## Recommended Immediate Actions

### 1. Add Input Validation Helper
```python
def validate_restaurant_id(restaurant_id: str) -> bool:
    """Validate restaurant ID format"""
    if restaurant_id == "onboarding":
        return True
    if not restaurant_id:
        return False
    if len(restaurant_id) > 50:
        return False
    if not re.match(r'^[a-zA-Z0-9-_]+$', restaurant_id):
        return False
    return True
```

### 2. Implement Rate Limiting
```python
from app.core.rate_limiter import RateLimiter

rate_limiter = RateLimiter(
    max_connections_per_user=10,
    max_connections_per_ip=50,
    time_window=60  # seconds
)

# In websocket_endpoint_general
if not await rate_limiter.check_allowed(user_id, client_ip):
    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    return
```

### 3. Add Connection Limits
```python
# In ConnectionManager
def can_connect(self, user_id: str, restaurant_id: str) -> bool:
    user_connections = sum(
        1 for ws, meta in self.connection_metadata.items()
        if meta.get("user_id") == user_id
    )
    return user_connections < MAX_CONNECTIONS_PER_USER
```

### 4. Sanitize Error Messages
```python
# Instead of exposing details
logger.warning(f"Access denied for user {user.id}")
await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
# Don't send detailed error to client
```

## Testing Recommendations

1. **Security Tests**:
   - Attempt SQL injection in restaurant_id
   - Try connecting with invalid/expired tokens
   - Test rate limiting with connection flooding
   - Verify cross-origin connection blocking

2. **Functional Tests**:
   - New restaurant owner can connect to "onboarding"
   - Existing restaurant owner can connect to their restaurant
   - Restaurant owner cannot connect to other restaurants
   - Staff can only connect to assigned restaurant

## Conclusion

While PR #352 successfully fixes the onboarding issue, it requires immediate security hardening before production deployment. The identified vulnerabilities could allow unauthorized access, DoS attacks, and information disclosure.

**Recommendation**: Approve with required changes - implement security fixes in a follow-up PR before deploying to production.

## Security Checklist
- [ ] Add input validation for restaurant_id
- [ ] Implement rate limiting
- [ ] Add connection limits per user
- [ ] Sanitize error messages
- [ ] Move token from query params to headers only
- [ ] Add Origin validation
- [ ] Implement message size limits
- [ ] Add security unit tests
- [ ] Update logging to avoid sensitive data exposure