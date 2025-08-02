# Fix Authentication Issues - Implementation Plan

## Problem Summary
Users are unable to sign into the app. The authentication system has multiple issues:
1. Supabase configuration not properly set up in the backend
2. Frontend trying to use Supabase auth but backend not configured
3. WebSocket authentication still using JWT instead of Supabase
4. No proper error messages shown to users

## Root Causes
1. **Backend Configuration**: Supabase admin client not initialized due to missing environment variables
2. **Token Validation**: WebSocket endpoints trying to validate Supabase tokens as JWT
3. **Frontend Fallback**: App falling back to mock auth when real auth fails
4. **Error Handling**: Errors not properly propagated to users

## TODO Items

### 1. Check and Fix Backend Configuration
- [ ] Check if Supabase environment variables are set in backend
- [ ] Create .env file with proper Supabase credentials if missing
- [ ] Verify Supabase client initialization
- [ ] Test backend auth endpoint directly

### 2. Fix WebSocket Authentication
- [ ] Update WebSocket endpoint to use Supabase token validation
- [ ] Remove JWT validation code from WebSocket
- [ ] Test WebSocket connection with Supabase tokens

### 3. Fix Frontend Authentication Flow
- [ ] Ensure frontend uses real Supabase auth (not mock)
- [ ] Add proper error messages for auth failures
- [ ] Test login flow end-to-end
- [ ] Verify token storage and retrieval

### 4. Create Test Script
- [ ] Create a script to test authentication flow
- [ ] Test with real Supabase credentials
- [ ] Verify all endpoints work correctly

### 5. Security Audit
- [ ] Ensure no hardcoded credentials
- [ ] Verify token validation is secure
- [ ] Check for authentication bypass vulnerabilities
- [ ] Test with invalid tokens

## Implementation Steps

### Step 1: Backend Configuration
```bash
# Check current environment
cd backend
cat .env

# Create/update .env with Supabase credentials
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Test Backend Auth
```bash
# Test auth endpoint directly
curl -X POST http://localhost:8000/api/v1/auth/verify \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json"
```

### Step 3: Fix WebSocket
Update `/backend/app/api/v1/endpoints/websocket.py` to use Supabase validation

### Step 4: Frontend Testing
1. Clear app storage
2. Try to log in with real credentials
3. Check error messages
4. Verify token storage

## Success Criteria
- [ ] Users can log in with Supabase credentials
- [ ] WebSocket connections authenticate properly
- [ ] No fallback to mock authentication
- [ ] Clear error messages shown for failures
- [ ] All security vulnerabilities fixed

## Timeline
Target: 2-3 hours for complete fix and testing