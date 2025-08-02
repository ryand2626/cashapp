#!/usr/bin/env python3
"""
Script to link existing Supabase users to database records
This ensures users can authenticate with Supabase while maintaining data integrity
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import SessionLocal, User
from app.core.supabase import get_supabase_client
from datetime import datetime
import uuid

def link_supabase_users():
    """Link existing Supabase users to database records"""
    
    # Initialize database session
    db = SessionLocal()
    
    try:
        # Initialize Supabase client
        supabase = get_supabase_client()
        
        # Get all users from Supabase
        print("Fetching users from Supabase...")
        response = supabase.auth.admin.list_users()
        
        # Extract users from response object
        supabase_users = response.users if hasattr(response, 'users') else []
        
        if not supabase_users:
            print("No users found in Supabase")
            return
        
        print(f"Found {len(supabase_users)} users in Supabase")
        
        for su_user in supabase_users:
            # Skip users without email (e.g., phone-only auth)
            email = getattr(su_user, 'email', None)
            if not email:
                print(f"\nSkipping user without email (ID: {getattr(su_user, 'id', 'unknown')})")
                continue
            
            # Safely get user ID
            user_id = getattr(su_user, 'id', None)
            if not user_id:
                print(f"\nSkipping user without ID (Email: {email})")
                continue
                
            print(f"\nProcessing user: {email}")
            
            # Check if user exists in database (case-insensitive)
            db_user = db.query(User).filter(func.lower(User.email) == func.lower(email)).first()
            
            if db_user:
                # Update existing user with Supabase ID
                if not db_user.supabase_id:
                    db_user.supabase_id = user_id
                    db_user.auth_provider = 'supabase'
                    db_user.updated_at = datetime.utcnow()
                    print(f"  ✓ Updated existing user with Supabase ID")
                else:
                    print(f"  - User already linked to Supabase")
            else:
                # Create new user record for Supabase user
                # Safe extraction of name from email
                first_name = 'User'
                last_name = 'User'
                
                try:
                    # Only try to extract from email if it's valid
                    if '@' in email:
                        username_part = email.split('@')[0]
                        if username_part:  # Ensure we have something before @
                            # Split by common separators
                            parts = username_part.replace('_', '.').replace('-', '.').split('.')
                            # Filter out empty parts
                            parts = [p for p in parts if p]
                            
                            if parts:
                                first_name = parts[0].capitalize()
                                if len(parts) > 1:
                                    last_name = parts[1].capitalize()
                except Exception:
                    # If any error occurs, keep default names
                    pass
                
                # Check user metadata for actual name
                user_metadata = getattr(su_user, 'user_metadata', {}) or {}
                if 'first_name' in user_metadata and user_metadata['first_name']:
                    first_name = user_metadata['first_name']
                if 'last_name' in user_metadata and user_metadata['last_name']:
                    last_name = user_metadata['last_name']
                
                # Determine role based on email or metadata
                role = user_metadata.get('role', 'employee')
                
                # Create new user
                new_user = User(
                    id=uuid.uuid4(),
                    email=email,
                    supabase_id=user_id,
                    auth_provider='supabase',
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                
                db.add(new_user)
                print(f"  ✓ Created new user record for Supabase user")
        
        # Commit all changes
        db.commit()
        print("\n✅ Successfully linked all Supabase users to database")
        
        # Show summary
        total_users = db.query(User).filter(User.supabase_id.isnot(None)).count()
        print(f"\nTotal users linked to Supabase: {total_users}")
        
    except Exception as e:
        print(f"\n❌ Error linking users: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """Main entry point"""
    print("=== Supabase User Linking Script ===")
    print("This script will link existing Supabase users to database records")
    print()
    
    # Confirm before proceeding
    response = input("Continue? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled")
        return
    
    link_supabase_users()

if __name__ == "__main__":
    main()