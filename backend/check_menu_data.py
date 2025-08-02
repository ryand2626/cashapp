#!/usr/bin/env python3
"""Quick check for menu data in production"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    # Check restaurant
    result = conn.execute(text("SELECT id, name FROM restaurants WHERE name LIKE '%Chucho%'"))
    restaurant = result.fetchone()
    if restaurant:
        print(f"✅ Restaurant: {restaurant[1]} (ID: {restaurant[0]})")
        
        # Count products
        result = conn.execute(text("SELECT COUNT(*) FROM products WHERE restaurant_id = :rid"), {"rid": restaurant[0]})
        count = result.scalar()
        print(f"✅ Products: {count}")
        
        # Count categories
        result = conn.execute(text("SELECT COUNT(*) FROM categories WHERE restaurant_id = :rid"), {"rid": restaurant[0]})
        count = result.scalar()
        print(f"✅ Categories: {count}")
        
        # Show sample
        result = conn.execute(text("""
            SELECT p.name, p.price, c.name as category
            FROM products p
            JOIN categories c ON p.category_id = c.id
            WHERE p.restaurant_id = :rid
            LIMIT 5
        """), {"rid": restaurant[0]})
        
        print("\nSample items:")
        for item in result:
            print(f"  - {item[0]}: £{item[1]} ({item[2]})")
    else:
        print("❌ No Chucho restaurant found in database")