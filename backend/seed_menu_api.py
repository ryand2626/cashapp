#!/usr/bin/env python3
"""
Seed Chucho menu data via API
This script connects to the production API to seed menu data

Usage:
    AUTH_EMAIL=your@email.com AUTH_PASSWORD=yourpassword python seed_menu_api.py
    
Or:
    export AUTH_EMAIL=your@email.com
    python seed_menu_api.py yourpassword
    
Environment Variables:
    API_BASE_URL - API endpoint (defaults to production)
    AUTH_EMAIL - User email for authentication (required)
    AUTH_PASSWORD - User password for authentication (required)
"""

import requests
import json
import sys
import os
from decimal import Decimal

# Configuration
API_BASE_URL = os.environ.get('API_BASE_URL', 'https://fynlopos-9eg2c.ondigitalocean.app')
AUTH_EMAIL = os.environ.get('AUTH_EMAIL')
AUTH_PASSWORD = os.environ.get('AUTH_PASSWORD')

# Chucho Restaurant Menu Data
CHUCHO_CATEGORIES = [
    {'name': 'Snacks', 'color': '#FF6B6B', 'icon': '🍲', 'sort_order': 1},
    {'name': 'Tacos', 'color': '#4ECDC4', 'icon': '🌮', 'sort_order': 2},
    {'name': 'Special Tacos', 'color': '#45B7D1', 'icon': '⭐', 'sort_order': 3},
    {'name': 'Burritos', 'color': '#96CEB4', 'icon': '🌯', 'sort_order': 4},
    {'name': 'Sides', 'color': '#FECA57', 'icon': '🍟', 'sort_order': 5},
    {'name': 'Drinks', 'color': '#FF9FF3', 'icon': '🍹', 'sort_order': 6},
]

CHUCHO_MENU_ITEMS = [
    # Snacks
    {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
    {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
    # Tacos
    {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
    {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'description': 'Marinated pulled pork served with pickle red onion'},
    {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
    # Special Tacos
    {'name': 'Carne Asada', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander'},
    {'name': 'Camaron', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole'},
    # Burritos
    {'name': 'Regular Burrito', 'price': 8.00, 'category': 'Burritos', 'description': 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander'},
    # Sides
    {'name': 'Skinny Fries', 'price': 3.50, 'category': 'Sides', 'description': 'Thin cut fries'},
    # Drinks
    {'name': 'Corona', 'price': 3.80, 'category': 'Drinks', 'description': 'Mexican beer'},
    {'name': 'Modelo', 'price': 4.00, 'category': 'Drinks', 'description': 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml'},
]

def login():
    """Login to get authentication token"""
    if not AUTH_EMAIL or not AUTH_PASSWORD:
        raise ValueError("AUTH_EMAIL and AUTH_PASSWORD must be set")
    
    print(f"🔐 Logging in as {AUTH_EMAIL}...")
    
    response = requests.post(
        f"{API_BASE_URL}/api/v1/auth/login",
        json={"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.text}")
        sys.exit(1)
    
    data = response.json()
    if not data.get('success'):
        print(f"❌ Login failed: {data.get('message', 'Unknown error')}")
        sys.exit(1)
    
    token = data['data']['access_token']
    print("✅ Login successful")
    return token

def create_categories(token, restaurant_id):
    """Create menu categories"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    category_mapping = {}
    
    print("🏷️  Creating categories...")
    for cat_data in CHUCHO_CATEGORIES:
        payload = {
            "name": cat_data['name'],
            "description": f"{cat_data['name']} items",
            "color": cat_data['color'],
            "icon": cat_data['icon'],
            "sort_order": cat_data['sort_order'],
            "is_active": True
        }
        
        response = requests.post(
            f"{API_BASE_URL}/api/v1/categories",
            json=payload,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                category_id = data['data']['id']
                category_mapping[cat_data['name']] = category_id
                print(f"   ✅ Created category: {cat_data['name']}")
            else:
                print(f"   ⚠️  Failed to create category {cat_data['name']}: {data.get('message')}")
        else:
            print(f"   ❌ Error creating category {cat_data['name']}: {response.text}")
    
    return category_mapping

def create_products(token, category_mapping):
    """Create menu products"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("🍽️  Creating menu items...")
    for idx, item_data in enumerate(CHUCHO_MENU_ITEMS):
        category_id = category_mapping.get(item_data['category'])
        if not category_id:
            print(f"   ⚠️  Skipping {item_data['name']} - category not found")
            continue
        
        payload = {
            "category_id": category_id,
            "name": item_data['name'],
            "description": item_data['description'],
            "price": float(item_data['price']),
            "cost": 0.0,
            "sku": f"CHU{idx+1:03d}",
            "prep_time": 5,
            "is_active": True,
            "stock_tracking": False
        }
        
        response = requests.post(
            f"{API_BASE_URL}/api/v1/products",
            json=payload,
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print(f"   ✅ Created product: {item_data['name']} (£{item_data['price']})")
            else:
                print(f"   ⚠️  Failed to create product {item_data['name']}: {data.get('message')}")
        else:
            print(f"   ❌ Error creating product {item_data['name']}: {response.text}")

def main():
    """Main seeding function"""
    print("🚀 Starting Chucho Restaurant Menu Seeding via API...")
    print(f"📍 API URL: {API_BASE_URL}")
    
    # Login
    token = login()
    
    # Get user info to find restaurant
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE_URL}/api/v1/auth/me", headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Failed to get user info: {response.text}")
        sys.exit(1)
    
    user_data = response.json()['data']
    restaurant_id = user_data.get('restaurant_id')
    
    if not restaurant_id:
        print("❌ User has no associated restaurant")
        sys.exit(1)
    
    print(f"🏪 Restaurant ID: {restaurant_id}")
    
    # Create categories
    category_mapping = create_categories(token, restaurant_id)
    
    if not category_mapping:
        print("❌ No categories created, cannot create products")
        sys.exit(1)
    
    # Create products
    create_products(token, category_mapping)
    
    print("\n✅ Menu seeding completed!")
    print(f"   📋 Categories: {len(category_mapping)}")
    print(f"   🍽️  Products: {len(CHUCHO_MENU_ITEMS)}")
    print(f"   🔗 Menu should now be visible in the POS screen")

if __name__ == "__main__":
    # Check for required credentials
    if not AUTH_EMAIL:
        print("Error: AUTH_EMAIL environment variable is required")
        print("Usage: AUTH_EMAIL=<email> AUTH_PASSWORD=<password> python seed_menu_api.py")
        sys.exit(1)
    
    if len(sys.argv) > 1:
        AUTH_PASSWORD = sys.argv[1]
    elif not AUTH_PASSWORD:
        print("Error: AUTH_PASSWORD is required")
        print("Usage: python seed_menu_api.py <password>")
        print("Or set AUTH_PASSWORD environment variable")
        sys.exit(1)
    
    main()