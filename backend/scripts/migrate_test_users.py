#!/usr/bin/env python3
"""
Backend Migration Script: Test Users for Authentication
=====================================================

This script creates test users in the backend authentication system
for frontend testing of different user roles and permissions.

Usage:
    python scripts/migrate_test_users.py

Requirements:
    - Backend database connection configured
    - SQLAlchemy models for users and authentication
    - Password hashing utilities
    - Restaurant and platform models
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

# Add the backend root to Python path
backend_root = Path(__file__).parent.parent
sys.path.append(str(backend_root))

try:
    from app.database import SessionLocal
    from app.models.user import User, UserRole
    from app.models.restaurant import Restaurant
    from app.models.platform import Platform
    from app.core.security import get_password_hash, verify_password
    from sqlalchemy.orm import Session
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running this from the backend directory with proper dependencies installed")
    sys.exit(1)

def load_test_users_data():
    """Load test users data from the frontend file"""
    frontend_users_file = backend_root.parent / "CashApp-iOS" / "CashAppPOS" / "test_users.json"
    
    if not frontend_users_file.exists():
        print(f"❌ Test users file not found: {frontend_users_file}")
        print("Make sure test_users.json exists in the frontend directory")
        return None
    
    try:
        with open(frontend_users_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded test users data: {len(data['test_users'])} users")
        return data
    except Exception as e:
        print(f"❌ Error loading test users data: {e}")
        return None

def ensure_platform_exists(db: Session):
    """Ensure the Fynlo platform exists in the database"""
    platform = db.query(Platform).filter(
        Platform.name == "Fynlo POS Platform"
    ).first()
    
    if not platform:
        platform = Platform(
            name="Fynlo POS Platform",
            description="Multi-tenant restaurant POS platform",
            domain="fynlo.com",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(platform)
        db.commit()
        db.refresh(platform)
        print(f"✅ Created platform: {platform.name} (ID: {platform.id})")
    else:
        print(f"✅ Platform exists: {platform.name} (ID: {platform.id})")
    
    return platform

def ensure_restaurant_exists(db: Session):
    """Ensure the Mexican restaurant exists for restaurant users"""
    restaurant = db.query(Restaurant).filter(
        Restaurant.slug == "mexican-pilot-001"
    ).first()
    
    if not restaurant:
        restaurant = Restaurant(
            name="Authentic Mexican Cuisine",
            slug="mexican-pilot-001",
            description="Traditional Mexican flavors with authentic recipes",
            address="123 Main Street, London, UK",
            phone="+44 20 1234 5678",
            email="info@mexicanrestaurant.com",
            is_active=True,
            created_at=datetime.utcnow()
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        print(f"✅ Created restaurant: {restaurant.name} (ID: {restaurant.id})")
    else:
        print(f"✅ Restaurant exists: {restaurant.name} (ID: {restaurant.id})")
    
    return restaurant

def map_user_role(role_string: str) -> UserRole:
    """Map string role to UserRole enum"""
    role_mapping = {
        "platform_owner": UserRole.PLATFORM_OWNER,
        "restaurant_owner": UserRole.RESTAURANT_OWNER,
        "manager": UserRole.MANAGER,
        "employee": UserRole.EMPLOYEE
    }
    return role_mapping.get(role_string, UserRole.EMPLOYEE)

def create_test_user(db: Session, user_data: dict, restaurant_id: int = None, platform_id: int = None):
    """Create a single test user"""
    existing_user = db.query(User).filter(
        User.username == user_data['username']
    ).first()
    
    if existing_user:
        print(f"ℹ️  User exists: {existing_user.username} ({existing_user.name})")
        # Update password and other details if needed
        existing_user.password_hash = get_password_hash(user_data['password'])
        existing_user.email = user_data['email']
        existing_user.name = user_data['name']
        existing_user.role = map_user_role(user_data['role'])
        existing_user.is_active = user_data.get('isActive', True)
        existing_user.updated_at = datetime.utcnow()
        
        # Update associations
        if user_data['role'] == 'platform_owner':
            existing_user.platform_id = platform_id
            existing_user.restaurant_id = None
        else:
            existing_user.restaurant_id = restaurant_id
            existing_user.platform_id = None
        
        db.commit()
        print(f"🔄 Updated user: {existing_user.username}")
        return existing_user
    
    # Create new user
    user = User(
        username=user_data['username'],
        email=user_data['email'],
        password_hash=get_password_hash(user_data['password']),
        name=user_data['name'],
        role=map_user_role(user_data['role']),
        is_active=user_data.get('isActive', True),
        created_at=datetime.utcnow()
    )
    
    # Set associations based on role
    if user_data['role'] == 'platform_owner':
        user.platform_id = platform_id
        user.restaurant_id = None
    else:
        user.restaurant_id = restaurant_id
        user.platform_id = None
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    print(f"✅ Created user: {user.username} ({user.name}) - Role: {user.role.value}")
    return user

def verify_test_user_login(db: Session, username: str, password: str):
    """Verify that a test user can authenticate"""
    user = db.query(User).filter(User.username == username).first()
    if user and verify_password(password, user.password_hash):
        print(f"✅ Login verification successful: {username}")
        return True
    else:
        print(f"❌ Login verification failed: {username}")
        return False

def main():
    """Main migration function"""
    print("👥 Starting Test Users Migration...")
    print("=" * 50)
    
    # Load test users data
    users_data = load_test_users_data()
    if not users_data:
        return False
    
    # Connect to database
    try:
        db = SessionLocal()
        print("✅ Connected to database")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
    
    try:
        # Ensure platform and restaurant exist
        platform = ensure_platform_exists(db)
        restaurant = ensure_restaurant_exists(db)
        
        # Create test users
        print("\n👤 Creating test users...")
        created_users = []
        
        for user_data in users_data['test_users']:
            try:
                user = create_test_user(
                    db, 
                    user_data, 
                    restaurant_id=restaurant.id, 
                    platform_id=platform.id
                )
                created_users.append(user)
            except Exception as e:
                print(f"❌ Failed to create user {user_data['username']}: {e}")
                continue
        
        # Verify authentication for all users
        print("\n🔐 Verifying authentication...")
        auth_success = True
        for user_data in users_data['test_users']:
            if not verify_test_user_login(db, user_data['username'], user_data['password']):
                auth_success = False
        
        # Summary
        print(f"\n📊 Migration Summary:")
        print(f"Users created/updated: {len(created_users)}")
        print(f"Authentication verification: {'✅ PASSED' if auth_success else '❌ FAILED'}")
        
        # Display login credentials for testing
        print(f"\n🧪 Test Login Credentials:")
        print("=" * 40)
        for user_data in users_data['test_users']:
            user_info = f"{user_data['name']} ({user_data['role']})"
            print(f"Username: {user_data['username']}")
            print(f"Password: {user_data['password']}")
            print(f"Name: {user_info}")
            print("-" * 30)
        
        print("\n🎉 Test users migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
    print("\n✅ Frontend can now authenticate with real users!")