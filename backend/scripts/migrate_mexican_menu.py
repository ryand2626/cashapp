#!/usr/bin/env python3
"""
Backend Migration Script: Mexican Restaurant Menu Data
=====================================

This script migrates the Mexican restaurant menu data from the frontend
to the backend database, preserving exact menu items for production continuity.

Usage:
    python scripts/migrate_mexican_menu.py

Requirements:
    - Backend database connection configured
    - SQLAlchemy models for menu items and categories
    - Restaurant tenant ID for Mexican restaurant
"""

import json
import sys
import os
from pathlib import Path

# Add the backend root to Python path
backend_root = Path(__file__).parent.parent
sys.path.append(str(backend_root))

try:
    from app.database import SessionLocal
    from app.models.menu import MenuItem, MenuCategory
    from app.models.restaurant import Restaurant
    from sqlalchemy.orm import Session
    from datetime import datetime
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running this from the backend directory with proper dependencies installed")
    sys.exit(1)

# Load the menu data from the frontend migration file
def load_menu_data():
    """Load Mexican menu data from the frontend migration file"""
    frontend_menu_file = backend_root.parent / "CashApp-iOS" / "CashAppPOS" / "mexican_menu_migration.json"
    
    if not frontend_menu_file.exists():
        print(f"❌ Menu data file not found: {frontend_menu_file}")
        print("Make sure mexican_menu_migration.json exists in the frontend directory")
        return None
    
    try:
        with open(frontend_menu_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded menu data: {len(data['menu_items'])} items, {len(data['categories'])} categories")
        return data
    except Exception as e:
        print(f"❌ Error loading menu data: {e}")
        return None

def ensure_mexican_restaurant(db: Session):
    """Ensure the Mexican restaurant exists in the database"""
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
        print(f"✅ Created Mexican restaurant: {restaurant.name} (ID: {restaurant.id})")
    else:
        print(f"✅ Mexican restaurant exists: {restaurant.name} (ID: {restaurant.id})")
    
    return restaurant

def migrate_categories(db: Session, restaurant_id: int, categories_data: list):
    """Migrate menu categories to the database"""
    category_map = {}
    
    for cat_data in categories_data:
        existing_category = db.query(MenuCategory).filter(
            MenuCategory.restaurant_id == restaurant_id,
            MenuCategory.name == cat_data['name']
        ).first()
        
        if not existing_category:
            category = MenuCategory(
                restaurant_id=restaurant_id,
                name=cat_data['name'],
                description=cat_data.get('description', ''),
                emoji=cat_data.get('emoji', '🍽️'),
                sort_order=cat_data.get('sort_order', 0),
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(category)
            db.commit()
            db.refresh(category)
            category_map[cat_data['id']] = category.id
            print(f"✅ Created category: {category.name}")
        else:
            category_map[cat_data['id']] = existing_category.id
            print(f"ℹ️  Category exists: {existing_category.name}")
    
    return category_map

def migrate_menu_items(db: Session, restaurant_id: int, menu_items_data: list, category_map: dict):
    """Migrate menu items to the database"""
    items_created = 0
    items_updated = 0
    
    for item_data in menu_items_data:
        existing_item = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.name == item_data['name']
        ).first()
        
        category_id = category_map.get(item_data['category_id'])
        if not category_id:
            print(f"⚠️  Warning: Category not found for item {item_data['name']}")
            continue
        
        if not existing_item:
            menu_item = MenuItem(
                restaurant_id=restaurant_id,
                category_id=category_id,
                name=item_data['name'],
                description=item_data.get('description', ''),
                price=float(item_data['price']),
                emoji=item_data.get('emoji', '🍽️'),
                allergens=item_data.get('allergens', []),
                dietary_info=item_data.get('dietary_info', []),
                preparation_time=item_data.get('preparation_time', 15),
                calories=item_data.get('calories'),
                is_available=item_data.get('available', True),
                is_featured=item_data.get('featured', False),
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(menu_item)
            items_created += 1
            print(f"✅ Created menu item: {menu_item.name} - £{menu_item.price}")
        else:
            # Update existing item with new data
            existing_item.price = float(item_data['price'])
            existing_item.description = item_data.get('description', existing_item.description)
            existing_item.emoji = item_data.get('emoji', existing_item.emoji)
            existing_item.is_available = item_data.get('available', existing_item.is_available)
            existing_item.updated_at = datetime.utcnow()
            items_updated += 1
            print(f"🔄 Updated menu item: {existing_item.name} - £{existing_item.price}")
    
    db.commit()
    print(f"📊 Migration summary: {items_created} items created, {items_updated} items updated")

def main():
    """Main migration function"""
    print("🚀 Starting Mexican Restaurant Menu Migration...")
    print("=" * 60)
    
    # Load menu data
    menu_data = load_menu_data()
    if not menu_data:
        return False
    
    # Connect to database
    try:
        db = SessionLocal()
        print("✅ Connected to database")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False
    
    try:
        # Ensure restaurant exists
        restaurant = ensure_mexican_restaurant(db)
        
        # Migrate categories
        print("\n📁 Migrating menu categories...")
        category_map = migrate_categories(db, restaurant.id, menu_data['categories'])
        
        # Migrate menu items
        print("\n🍽️  Migrating menu items...")
        migrate_menu_items(db, restaurant.id, menu_data['menu_items'], category_map)
        
        print("\n🎉 Mexican restaurant menu migration completed successfully!")
        print(f"Restaurant: {restaurant.name}")
        print(f"Categories: {len(menu_data['categories'])}")
        print(f"Menu Items: {len(menu_data['menu_items'])}")
        
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
    print("\n✅ Ready for frontend testing!")