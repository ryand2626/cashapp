# Security Fix Summary: Supabase Authentication Vulnerability

## Issue Description

The authentication system was using `User.email` for user lookup instead of `User.supabase_id`, which introduced critical security vulnerabilities:

1. **Account Takeover**: An attacker with a valid Supabase token for an email could authenticate as a different user sharing that email
2. **Data Exposure via Email Reuse**: A new user registering with an email previously used by a deleted Supabase account could gain access to the former user's data
3. **Race Condition during User Creation**: Concurrent first-time logins with the same email could result in incorrect user assignment

## Root Cause

The code incorrectly assumed that the `supabase_id` column was not available in the database, despite it being added in migration `009_add_supabase_auth_support.py`. This led to using email-based lookups which are not secure for authentication purposes.

## Files Fixed

### 1. `backend/app/api/v1/endpoints/websocket.py`
- **Line 63-77**: Changed user lookup from `User.email == supabase_user.email` to `User.supabase_id == supabase_user.id`

### 2. `backend/app/api/v1/endpoints/auth.py`
- **Line 98-101**: Changed user lookup from `User.email == supabase_user.email` to `User.supabase_id == supabase_user.id`
- **Line 116**: Added `supabase_id=supabase_user.id` to new user creation
- **Line 134**: Changed race condition recovery lookup from email to supabase_id
- **Line 375**: Changed another user lookup from email to supabase_id

## Technical Details

### Before (Vulnerable Code)
```python
# User lookup by email - VULNERABLE
user = db.query(User).filter(User.email == supabase_user.email).first()
```

### After (Secure Code)
```python
# User lookup by supabase_id - SECURE
user = db.query(User).filter(User.supabase_id == supabase_user.id).first()
```

## Migration Requirements

1. Ensure all existing users have their `supabase_id` populated by running:
   ```bash
   python backend/scripts/link_supabase_users.py
   ```

2. The database schema already has the correct constraints:
   - `users.supabase_id` has a UNIQUE constraint
   - `users.email` has a UNIQUE constraint
   - Index exists on `supabase_id` for performance

## Security Improvements

1. **Eliminated Account Takeover Risk**: Users are now uniquely identified by their Supabase ID, which cannot be duplicated
2. **Protected Against Email Reuse**: Even if emails are reused in Supabase, each user maintains a unique identity
3. **Fixed Race Conditions**: User creation race conditions now properly handle concurrent requests using the unique supabase_id

## Testing

A test script has been created at `backend/test_supabase_auth_fix.py` to verify:
- Supabase ID column exists and has proper constraints
- No duplicate emails exist in the database
- Proper indexes are in place for performance

## Recommendations

1. Run the `link_supabase_users.py` script immediately to ensure all existing users have their Supabase IDs populated
2. Monitor authentication logs for any failed lookups that might indicate users without Supabase IDs
3. Consider adding a database constraint to ensure `supabase_id` is NOT NULL for all users using Supabase authentication
4. Review other endpoints that might be using email-based lookups for authentication purposes