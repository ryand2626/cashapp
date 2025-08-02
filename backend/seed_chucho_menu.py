#!/usr/bin/env python3
"""
Seed Chucho Restaurant Menu Data
Seeds the Chucho restaurant menu data into the production database
"""

import sys
import os
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, Restaurant, Category, Product, User
from app.core.config import settings
import uuid
from decimal import Decimal

# Chucho Restaurant Menu Data (from src/data/chuchoMenu.ts)
CHUCHO_CATEGORIES = [
    {'name': 'Snacks', 'color': '#FF6B6B', 'icon': '🍲', 'sort_order': 1},
    {'name': 'Tacos', 'color': '#4ECDC4', 'icon': '🌮', 'sort_order': 2},
    {'name': 'Special Tacos', 'color': '#45B7D1', 'icon': '⭐', 'sort_order': 3},
    {'name': 'Burritos', 'color': '#96CEB4', 'icon': '🌯', 'sort_order': 4},
    {'name': 'Sides', 'color': '#FECA57', 'icon': '🍟', 'sort_order': 5},
    {'name': 'Drinks', 'color': '#FF9FF3', 'icon': '🍹', 'sort_order': 6},
]

CHUCHO_MENU_ITEMS = [
    # SNACKS
    {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'emoji': '🍲', 'available': True, 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
    {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'available': True, 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
    {'name': 'Chorizo Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'available': True, 'description': 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'},
    {'name': 'Chicken Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'available': True, 'description': 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'},
    {'name': 'Tostada', 'price': 6.50, 'category': 'Snacks', 'emoji': '🍲', 'available': True, 'description': 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'},
    
    # TACOS (All £3.50 each or 3 for £9)
    {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
    {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Marinated pulled pork served with pickle red onion'},
    {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
    {'name': 'Chorizo', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'},
    {'name': 'Rellena', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Chicken Fajita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'},
    {'name': 'Haggis', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Pescado', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'},
    {'name': 'Dorados', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta'},
    {'name': 'Dorados Papa', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta'},
    {'name': 'Nopal', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta'},
    {'name': 'Frijol', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Black beans with fried plantain served with tomato salsa, feta & coriander'},
    {'name': 'Verde', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta'},
    {'name': 'Fajita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander'},
    
    # SPECIAL TACOS (All £4.50 each)
    {'name': 'Carne Asada', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '🥩', 'available': True, 'description': 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander'},
    {'name': 'Camaron', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '🍤', 'available': True, 'description': 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole'},
    {'name': 'Pulpos', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '🐙', 'available': True, 'description': 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander'},
    
    # BURRITOS
    {'name': 'Regular Burrito', 'price': 8.00, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander'},
    {'name': 'Special Burrito', 'price': 10.00, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander'},
    {'name': 'Add Mozzarella', 'price': 1.00, 'category': 'Burritos', 'emoji': '🧀', 'available': True, 'description': 'Add extra cheese to any burrito'},
    
    # SIDES & SALSAS
    {'name': 'Skinny Fries', 'price': 3.50, 'category': 'Sides', 'emoji': '🍟', 'available': True, 'description': 'Thin cut fries'},
    {'name': 'Pico de gallo', 'price': 0.00, 'category': 'Sides', 'emoji': '🍅', 'available': True, 'description': 'Diced tomato, onion and chilli - FREE'},
    {'name': 'Green Chili', 'price': 0.00, 'category': 'Sides', 'emoji': '🌶️', 'available': True, 'description': 'Homemade green chili salsa - HOT! - FREE'},
    {'name': 'Pineapple Habanero', 'price': 0.00, 'category': 'Sides', 'emoji': '🍍', 'available': True, 'description': 'Pineapple sauce with habanero chili - HOT! - FREE'},
    {'name': 'Scotch Bonnet', 'price': 0.00, 'category': 'Sides', 'emoji': '🔥', 'available': True, 'description': 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE'},
    
    # DRINKS
    {'name': 'Pink Paloma', 'price': 3.75, 'category': 'Drinks', 'emoji': '🍹', 'available': True, 'description': 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine'},
    {'name': 'Coco-Nought', 'price': 3.75, 'category': 'Drinks', 'emoji': '🥥', 'available': True, 'description': 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!'},
    {'name': 'Corona', 'price': 3.80, 'category': 'Drinks', 'emoji': '🍺', 'available': True, 'description': 'Mexican beer'},
    {'name': 'Modelo', 'price': 4.00, 'category': 'Drinks', 'emoji': '🍺', 'available': True, 'description': 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml'},
    {'name': 'Pacifico', 'price': 4.00, 'category': 'Drinks', 'emoji': '🍺', 'available': True, 'description': 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml'},
    {'name': 'Dos Equis', 'price': 4.00, 'category': 'Drinks', 'emoji': '🍺', 'available': True, 'description': 'Two X\'s. German brewing heritage with the spirit of Mexican traditions. 355ml'},
]

def find_chucho_restaurant(db: Session) -> Restaurant:
    """Find Chucho restaurant by name"""
    # Simple query to avoid schema mismatch issues
    from sqlalchemy import text
    
    # First, find the restaurant by name
    result = db.execute(
        text("SELECT id, name FROM restaurants WHERE LOWER(name) = LOWER(:name)"),
        {"name": "Chucho"}
    ).fetchone()
    
    if not result:
        # If not found by exact name, try to find any restaurant with "Chucho" in the name
        result = db.execute(
            text("SELECT id, name FROM restaurants WHERE LOWER(name) LIKE LOWER(:pattern)"),
            {"pattern": "%chucho%"}
        ).fetchone()
    
    if not result:
        raise Exception("No restaurant found with name 'Chucho'")
    
    # Create a simple object with the needed fields
    class SimpleRestaurant:
        def __init__(self, id, name):
            self.id = id
            self.name = name
    
    return SimpleRestaurant(result[0], result[1])

def clear_existing_menu(db: Session, restaurant_id: str):
    """Clear existing menu items and categories for the restaurant"""
    print(f"🧹 Clearing existing menu data for restaurant {restaurant_id}...")
    
    # Delete existing products
    from sqlalchemy import text
    db.execute(
        text("DELETE FROM products WHERE restaurant_id = :restaurant_id"),
        {"restaurant_id": restaurant_id}
    )
    
    # Delete existing categories
    db.execute(
        text("DELETE FROM categories WHERE restaurant_id = :restaurant_id"),
        {"restaurant_id": restaurant_id}
    )
    
    db.commit()
    print("   ✅ Existing menu data cleared")

def clear_all_menu_data(db: Session):
    """Clear ALL menu data from all restaurants"""
    print("🧹 Clearing ALL menu data from database...")
    
    from sqlalchemy import text
    
    # Delete all products
    result = db.execute(text("DELETE FROM products"))
    product_count = result.rowcount
    
    # Delete all categories
    result = db.execute(text("DELETE FROM categories"))
    category_count = result.rowcount
    
    db.commit()
    print(f"   ✅ Deleted {product_count} products and {category_count} categories")

def remove_other_restaurants(db: Session, chucho_restaurant_id: str):
    """Remove all restaurants except the specified Chucho restaurant"""
    print("🧹 Removing all non-Chucho restaurants...")
    
    from sqlalchemy import text
    
    # First, clear dependent data from other restaurants
    # Get list of restaurants to delete
    other_restaurants = db.execute(
        text("SELECT id FROM restaurants WHERE id != :restaurant_id"),
        {"restaurant_id": chucho_restaurant_id}
    ).fetchall()
    
    if other_restaurants:
        other_ids = [r[0] for r in other_restaurants]  # Keep as UUID objects
        print(f"   Found {len(other_ids)} other restaurants to remove")
        
        # Clear dependent data first to avoid foreign key violations
        # 1. Clear products from other restaurants using SQLAlchemy's safe in_ operator
        products_deleted = db.query(Product).filter(
            Product.restaurant_id.in_(other_ids)
        ).delete(synchronize_session=False)
        print(f"   ✅ Deleted {products_deleted} products from other restaurants")
        
        # 2. Clear categories from other restaurants
        categories_deleted = db.query(Category).filter(
            Category.restaurant_id.in_(other_ids)
        ).delete(synchronize_session=False)
        print(f"   ✅ Deleted {categories_deleted} categories from other restaurants")
        
        # 3. Now safe to delete the restaurants
        restaurants_deleted = db.query(Restaurant).filter(
            Restaurant.id.in_(other_ids)
        ).delete(synchronize_session=False)
        print(f"   ✅ Deleted {restaurants_deleted} other restaurants")
    else:
        print("   ✅ No other restaurants found - only Chucho exists")
    
    db.commit()

def ensure_restaurant_owner(db: Session, restaurant_id: str):
    """Ensure Chucho restaurant is owned by arnaud@luciddirections.co.uk"""
    print("🔧 Setting restaurant owner...")
    
    from sqlalchemy import text
    
    # First check if user exists
    user = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": "arnaud@luciddirections.co.uk"}
    ).fetchone()
    
    if user:
        # Update user's restaurant_id
        db.execute(
            text("UPDATE users SET restaurant_id = :restaurant_id WHERE id = :user_id"),
            {"restaurant_id": restaurant_id, "user_id": user[0]}
        )
        print(f"   ✅ Updated arnaud@luciddirections.co.uk to own Chucho restaurant")
    else:
        print(f"   ⚠️  User arnaud@luciddirections.co.uk not found - please ensure user exists in Supabase")
    
    db.commit()

def seed_categories(db: Session, restaurant_id: str) -> dict:
    """Seed menu categories and return mapping"""
    category_mapping = {}
    
    print(f"🏷️  Creating categories for restaurant {restaurant_id}...")
    
    for cat_data in CHUCHO_CATEGORIES:
        # Check if category already exists
        existing = db.query(Category).filter(
            and_(Category.restaurant_id == restaurant_id, Category.name == cat_data['name'])
        ).first()
        
        if existing:
            print(f"   ✅ Category '{cat_data['name']}' already exists")
            category_mapping[cat_data['name']] = existing.id
            continue
        
        # Create new category
        category = Category(
            restaurant_id=restaurant_id,
            name=cat_data['name'],
            description=f"{cat_data['name']} items",
            color=cat_data['color'],
            icon=cat_data['icon'],
            sort_order=cat_data['sort_order'],
            is_active=True
        )
        
        db.add(category)
        db.flush()  # Get the ID
        
        category_mapping[cat_data['name']] = category.id
        print(f"   ✅ Created category: {cat_data['name']}")
    
    return category_mapping

def seed_products(db: Session, restaurant_id: str, category_mapping: dict):
    """Seed menu products"""
    
    print(f"🍽️  Creating menu items for restaurant {restaurant_id}...")
    
    for idx, item_data in enumerate(CHUCHO_MENU_ITEMS):
        category_id = category_mapping.get(item_data['category'])
        if not category_id:
            print(f"   ⚠️  Warning: Category '{item_data['category']}' not found for item '{item_data['name']}'")
            continue
        
        # Check if product already exists
        existing = db.query(Product).filter(
            and_(Product.restaurant_id == restaurant_id, Product.name == item_data['name'])
        ).first()
        
        if existing:
            print(f"   ✅ Product '{item_data['name']}' already exists")
            continue
        
        # Create new product
        product = Product(
            restaurant_id=restaurant_id,
            category_id=category_id,
            name=item_data['name'],
            description=item_data['description'],
            price=Decimal(str(item_data['price'])),
            cost=Decimal('0.00'),  # Default cost
            image_url=None,
            barcode=None,
            sku=f"CHU{idx+1:03d}",  # Generate SKU like CHU001, CHU002, etc.
            prep_time=5,  # Default 5 minutes
            dietary_info=[],
            modifiers=[],
            is_active=item_data['available'],
            stock_tracking=False,
            stock_quantity=None
        )
        
        db.add(product)
        print(f"   ✅ Created product: {item_data['name']} (£{item_data['price']})")

def main():
    """Main seeding function"""
    print("🚀 Starting Chucho Restaurant Menu Seeding...")
    print(f"📍 Database: {settings.DATABASE_URL[:50]}...")
    
    db = SessionLocal()
    
    try:
        # Step 1: Find Chucho restaurant FIRST (before any deletions)
        restaurant = find_chucho_restaurant(db)
        restaurant_id = str(restaurant.id)
        
        print(f"🏪 Found restaurant: {restaurant.name} (ID: {restaurant_id})")
        
        # Step 2: Remove all OTHER restaurants (now that we have Chucho's ID)
        remove_other_restaurants(db, restaurant_id)
        
        # Step 3: Ensure restaurant is owned by arnaud@luciddirections.co.uk
        ensure_restaurant_owner(db, restaurant_id)
        
        # Step 4: Clear ALL menu data from database
        clear_all_menu_data(db)
        
        # Step 5: Seed categories
        category_mapping = seed_categories(db, restaurant_id)
        
        # Step 6: Seed products
        seed_products(db, restaurant_id, category_mapping)
        
        # Commit all changes
        db.commit()
        
        # Summary
        total_categories = len(CHUCHO_CATEGORIES)
        total_products = len(CHUCHO_MENU_ITEMS)
        
        print(f"")
        print(f"✅ SUCCESS: Chucho restaurant menu seeded!")
        print(f"   📋 Categories: {total_categories}")
        print(f"   🍽️  Products: {total_products}")
        print(f"   🏪 Restaurant: {restaurant.name}")
        print(f"   🔗 Menu API endpoints now available:")
        print(f"      GET /api/v1/menu/categories")
        print(f"      GET /api/v1/menu/items")
        print(f"      GET /api/v1/products/mobile")
        
    except Exception as e:
        print(f"❌ Error seeding menu: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()