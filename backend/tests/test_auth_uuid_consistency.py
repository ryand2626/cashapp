#!/usr/bin/env python3
"""
Test script to verify UUID type consistency for Supabase authentication
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, User
from app.core.supabase import supabase_admin
import uuid

def test_uuid_consistency():
    """Test that all supabase_id fields use UUID objects, not strings"""
    
    db = SessionLocal()
    
    try:
        print("=== Testing UUID Type Consistency ===\n")
        
        # Get Supabase users
        print("1. Fetching users from Supabase...")
        response = supabase_admin.auth.admin.list_users(per_page=10)
        
        # FIXED: Correctly extract users from response
        supabase_users = response.users if hasattr(response, 'users') else []
        
        print(f"   Found {len(supabase_users)} users in Supabase\n")
        
        # Check each user
        issues_found = 0
        for su_user in supabase_users:
            if not hasattr(su_user, 'email'):
                continue
                
            print(f"2. Checking user: {su_user.email}")
            
            # Check type of Supabase ID
            print(f"   Supabase ID type: {type(su_user.id)} = {su_user.id}")
            
            # Find user in database
            db_user = db.query(User).filter(User.email == su_user.email).first()
            
            if db_user:
                print(f"   Database user found: ID = {db_user.id}")
                
                # Check if supabase_id is set and its type
                if db_user.supabase_id:
                    print(f"   DB supabase_id type: {type(db_user.supabase_id)} = {db_user.supabase_id}")
                    
                    # Verify it's a UUID object
                    if isinstance(db_user.supabase_id, str):
                        print("   ❌ ERROR: supabase_id is stored as string!")
                        issues_found += 1
                    elif isinstance(db_user.supabase_id, uuid.UUID):
                        print("   ✅ GOOD: supabase_id is stored as UUID object")
                        
                        # Check if IDs match
                        if str(db_user.supabase_id) == str(su_user.id):
                            print("   ✅ IDs match correctly")
                        else:
                            print("   ❌ ERROR: IDs don't match!")
                            issues_found += 1
                else:
                    print("   ⚠️  WARNING: supabase_id is NULL")
                    
                    # Test updating with UUID object
                    print("   Testing update with UUID object...")
                    try:
                        db_user.supabase_id = su_user.id  # Should be UUID object
                        db.flush()  # Test if it works without committing
                        print("   ✅ Update successful (not committed)")
                        db.rollback()  # Don't actually save
                    except Exception as e:
                        print(f"   ❌ Update failed: {e}")
                        issues_found += 1
                        db.rollback()
            else:
                print("   User not found in database")
            
            print()
        
        # Summary
        print("\n=== Summary ===")
        if issues_found == 0:
            print("✅ All tests passed! UUID types are consistent.")
        else:
            print(f"❌ Found {issues_found} issues with UUID type consistency")
            
        # Test column type
        print("\n=== Database Column Type Check ===")
        from sqlalchemy import inspect
        inspector = inspect(db.bind)
        columns = inspector.get_columns('users')
        
        supabase_id_col = next((col for col in columns if col['name'] == 'supabase_id'), None)
        if supabase_id_col:
            print(f"supabase_id column type: {supabase_id_col['type']}")
        
    except Exception as e:
        print(f"\n❌ Test error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_uuid_consistency()