# Multi-Tenant Security Implementation Guide

## Overview

This guide explains how to implement the multi-tenant security fixes across the Fynlo POS backend to resolve issue #361.

## Security Model

### Platform Owners (Full Access)
- **Ryan** (ryan@fynlo.com, ryand2626@gmail.com)
- **Arnaud** (arnaud@fynlo.com, arno@fynlo.com)
- Have complete access to all restaurants and data
- Can perform cross-restaurant operations
- This is BY DESIGN and required for platform management

### Everyone Else (Restricted Access)
- Restaurant owners, managers, employees
- Can ONLY access their own restaurant's data
- Cannot see or modify other restaurants' information

## Implementation Steps

### 1. Apply Database Migration

Run the RLS migration to enable PostgreSQL row-level security:

```bash
cd backend
alembic upgrade head
```

This will:
- Enable RLS on all tenant tables
- Create platform owner validation function
- Set up policies for data isolation

### 2. Update Existing Endpoints

For each API endpoint, apply the following pattern:

#### Before (Vulnerable):
```python
@router.put("/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # VULNERABILITY: No check if user can access this product!
    product = db.query(Product).filter(Product.id == product_id).first()
    # ... update product
```

#### After (Secure):
```python
from app.core.tenant_security import TenantSecurity

@router.put("/{product_id}")
async def update_product(
    product_id: str,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # SECURITY: Validate restaurant access
    TenantSecurity.validate_restaurant_access(
        user=current_user,
        restaurant_id=str(product.restaurant_id),
        operation="modify"
    )
    
    # ... update product
```

### 3. Use Secure Dependencies

Replace manual validation with reusable dependencies:

```python
from app.core.dependencies import get_current_user_with_tenant_validation, TenantFilter

@router.get("/orders")
async def get_orders(
    filters: dict = Depends(TenantFilter()),
    current_user: User = Depends(get_current_user_with_tenant_validation)
):
    # filters automatically includes correct restaurant_id
    # Platform owners can see all, others see only their restaurant
```

### 4. Apply to All Endpoints

Endpoints that need security updates:

#### High Priority (Direct Data Access):
- ✅ `/api/v1/products/*` - Product management
- ✅ `/api/v1/orders/*` - Order processing
- ✅ `/api/v1/employees/*` - Employee management
- ✅ `/api/v1/customers/*` - Customer data
- ✅ `/api/v1/payments/*` - Payment information
- ✅ `/api/v1/inventory/*` - Inventory management

#### Medium Priority (Analytics/Reports):
- ✅ `/api/v1/analytics/*` - Business analytics
- ✅ `/api/v1/reports/*` - Financial reports
- ✅ `/api/v1/dashboard/*` - Dashboard data

#### Platform-Only Endpoints:
- ✅ `/api/v1/platform/*` - Use `platform_owner_required` dependency
- ✅ `/api/v1/admin/*` - Restrict to Ryan & Arnaud only

### 5. WebSocket Security

Update WebSocket handlers:

```python
# In websocket endpoint
has_access = await verify_websocket_access_secure(
    restaurant_id=restaurant_id,
    user=verified_user,
    connection_type=connection_type
)

# For broadcasts
await SecureWebSocketManager.broadcast_to_restaurant_secure(
    restaurant_id=restaurant_id,
    message=message,
    sender_user=current_user
)
```

### 6. Testing Security

Run the security test suite:

```bash
cd backend
pytest tests/test_ryan_arnaud_platform_access.py -v
pytest tests/test_correct_multitenant_isolation.py -v
pytest tests/test_multitenant_api_isolation.py -v
```

## Quick Reference

### Check if Platform Owner:
```python
if TenantSecurity.is_platform_owner(current_user):
    # Ryan or Arnaud - full access
else:
    # Regular user - restricted access
```

### Validate Restaurant Access:
```python
TenantSecurity.validate_restaurant_access(
    user=current_user,
    restaurant_id=resource.restaurant_id,
    operation="view"  # or "modify", "delete"
)
```

### Filter Query by Tenant:
```python
query = TenantSecurity.apply_tenant_filter(
    query=db.query(Order),
    user=current_user,
    model_class=Order
)
```

### Platform-Only Endpoint:
```python
@router.post("/platform/settings")
async def update_settings(
    current_user: User = Depends(platform_owner_required)
):
    # Only Ryan and Arnaud can access
```

## Important Notes

1. **Never remove platform owner access** - Ryan and Arnaud must maintain full access
2. **Test after each change** - Ensure no functionality breaks
3. **Log security events** - Track access attempts for audit
4. **No hardcoded checks** - Always use TenantSecurity module
5. **WebSocket isolation** - Events must not leak between restaurants

## Rollback Plan

If issues occur:
1. Revert to commit: `f33b433bb27c902c8024fbfce20493492e9a569b`
2. Disable RLS: `alembic downgrade -1`
3. Remove middleware from app startup
4. Notify Ryan immediately