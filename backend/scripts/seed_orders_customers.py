#!/usr/bin/env python3
"""
Focused seed script for Orders and Customers
Creates realistic historical transaction data for reports to function properly
"""

import asyncio
import sys
import os
from datetime import datetime, date, timedelta
from decimal import Decimal
import uuid
import random
import json

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db, engine, SessionLocal
from app.models import Order, Payment, Customer, Restaurant, Product, User, EmployeeProfile
from sqlalchemy.orm import Session
from sqlalchemy import select, text

class OrderCustomerSeeder:
    """Create realistic orders and customers for report functionality"""
    
    def __init__(self):
        self.session: Session = None
        self.restaurant_id: str = None
        self.employees = []
        self.products = []
        self.customers = []
        
    async def run(self):
        """Execute the seeding process"""
        print("📊 Creating Orders & Customers for Reports...")
        print("🎯 Target: Generate 90 days of transaction history")
        print("-" * 50)
        
        try:
            # Create database session
            self.session = SessionLocal()
            
            await self.load_existing_data()
            await self.create_customers()
            await self.create_order_history()
            
            self.session.commit()
            print("✅ Order and customer seeding completed successfully!")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            if self.session:
                self.session.rollback()
            raise
        finally:
            if self.session:
                self.session.close()
    
    async def load_existing_data(self):
        """Load existing restaurants, employees, and products"""
        print("1️⃣ Loading existing data...")
        
        # Get restaurant
        restaurant = self.session.execute(select(Restaurant).limit(1)).scalar_one_or_none()
        if not restaurant:
            raise Exception("No restaurant found. Please run the main seeding script first.")
        
        self.restaurant_id = str(restaurant.id)
        print(f"   ✓ Using restaurant: {restaurant.name}")
        
        # Get employees
        employees = self.session.execute(
            select(EmployeeProfile).where(EmployeeProfile.restaurant_id == restaurant.id)
        ).scalars().all()
        
        self.employees = [
            {
                "id": str(emp.id),
                "user_id": str(emp.user_id),
                "name": f"{emp.first_name} {emp.last_name}",
                "role": emp.role
            }
            for emp in employees
        ]
        print(f"   ✓ Found {len(self.employees)} employees")
        
        # Get products
        products = self.session.execute(
            select(Product).where(Product.restaurant_id == restaurant.id)
        ).scalars().all()
        
        self.products = [
            {
                "id": str(prod.id),
                "name": prod.name,
                "price": prod.price,
                "category": prod.category_id
            }
            for prod in products
        ]
        print(f"   ✓ Found {len(self.products)} products")
        
    async def create_customers(self):
        """Create realistic customer base"""
        print("2️⃣ Creating customer base...")
        
        customer_data = [
            {"name": "James Thompson", "email": "james.t@email.com", "phone": "+44 7911 123456"},
            {"name": "Sarah Wilson", "email": "sarah.wilson@email.com", "phone": "+44 7911 234567"},
            {"name": "Michael Brown", "email": "m.brown@email.com", "phone": "+44 7911 345678"},
            {"name": "Emma Davis", "email": "emma.davis@email.com", "phone": "+44 7911 456789"},
            {"name": "David Miller", "email": "d.miller@email.com", "phone": "+44 7911 567890"},
            {"name": "Lisa Johnson", "email": "lisa.j@email.com", "phone": "+44 7911 678901"},
            {"name": "Chris Evans", "email": "c.evans@email.com", "phone": "+44 7911 789012"},
            {"name": "Amanda Taylor", "email": "amanda.taylor@email.com", "phone": "+44 7911 890123"},
            {"name": "Robert Garcia", "email": "robert.g@email.com", "phone": "+44 7911 901234"},
            {"name": "Jennifer Lee", "email": "jennifer.lee@email.com", "phone": "+44 7911 012345"},
            {"name": "Mark Anderson", "email": "mark.anderson@email.com", "phone": "+44 7911 123450"},
            {"name": "Rachel White", "email": "rachel.w@email.com", "phone": "+44 7911 234501"},
            {"name": "Paul Martinez", "email": "paul.martinez@email.com", "phone": "+44 7911 345012"},
            {"name": "Sophie Clark", "email": "sophie.clark@email.com", "phone": "+44 7911 450123"},
            {"name": "Daniel Rodriguez", "email": "daniel.r@email.com", "phone": "+44 7911 501234"},
        ]
        
        for cust_data in customer_data:
            customer = Customer(
                id=uuid.uuid4(),
                restaurant_id=uuid.UUID(self.restaurant_id),
                name=cust_data["name"],
                email=cust_data["email"],
                phone=cust_data["phone"],
                total_visits=0,
                total_spent=Decimal("0.00"),
                created_at=datetime.now() - timedelta(days=random.randint(30, 365))
            )
            self.session.add(customer)
            self.customers.append({
                "id": str(customer.id),
                "name": customer.name,
                "email": customer.email
            })
        
        print(f"   ✓ Created {len(customer_data)} customers")
    
    async def create_order_history(self):
        """Create 90 days of realistic order history"""
        print("3️⃣ Creating 90 days of order history...")
        
        if not self.employees:
            raise Exception("No employees found")
        if not self.products:
            raise Exception("No products found")
        
        total_orders = 0
        
        # Create orders for the last 90 days
        for days_ago in range(90, 0, -1):
            order_date = datetime.now() - timedelta(days=days_ago)
            
            # Different order volumes based on day of week
            day_of_week = order_date.weekday()  # 0=Monday, 6=Sunday
            if day_of_week in [4, 5, 6]:  # Friday, Saturday, Sunday
                daily_orders = random.randint(60, 95)
            elif day_of_week in [1, 2, 3]:  # Tuesday, Wednesday, Thursday  
                daily_orders = random.randint(35, 60)
            else:  # Monday
                daily_orders = random.randint(20, 40)
            
            for order_num in range(daily_orders):
                # Create realistic order timing
                if order_num < daily_orders * 0.35:  # Lunch rush
                    hour = random.randint(12, 15)
                elif order_num < daily_orders * 0.75:  # Dinner rush
                    hour = random.randint(18, 22)
                else:  # Other times
                    hour = random.choice([11, 16, 17, 23])
                
                minute = random.randint(0, 59)
                order_time = order_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
                
                # Select random employee (server or cashier)
                servers = [emp for emp in self.employees if emp["role"] in ["server", "cashier", "manager"]]
                employee = random.choice(servers) if servers else self.employees[0]
                
                # Create order
                order_id = uuid.uuid4()
                order = Order(
                    id=order_id,
                    restaurant_id=uuid.UUID(self.restaurant_id),
                    order_number=f"CE{order_time.strftime('%y%m%d')}{order_num+1:03d}",
                    order_type=random.choices(
                        ["dine_in", "takeaway", "delivery"], 
                        weights=[0.6, 0.3, 0.1]
                    )[0],
                    table_number=str(random.randint(1, 25)) if random.random() > 0.4 else None,
                    status="completed",
                    payment_status="completed",
                    created_at=order_time,
                    updated_at=order_time,
                    created_by=uuid.UUID(employee["user_id"]),
                    subtotal=Decimal("0.00"),
                    tax_amount=Decimal("0.00"), 
                    service_charge=Decimal("0.00"),
                    total_amount=Decimal("0.00"),
                    items=[]
                )
                
                # Add 1-6 items to the order
                num_items = random.randint(1, 6)
                order_total = Decimal("0.00")
                order_items = []
                
                selected_products = random.sample(self.products, min(num_items, len(self.products)))
                
                for product in selected_products:
                    quantity = random.randint(1, 3)
                    item_total = Decimal(str(product["price"])) * quantity
                    
                    item_data = {
                        "product_id": product["id"],
                        "product_name": product["name"],
                        "quantity": quantity,
                        "unit_price": float(product["price"]),
                        "total_price": float(item_total),
                        "modifiers": [],
                        "special_instructions": random.choice([
                            "", "", "", "No onions", "Extra spicy", "On the side", "Light cheese"
                        ])
                    }
                    order_items.append(item_data)
                    order_total += item_total
                
                # Calculate realistic totals
                subtotal = order_total
                tax_amount = subtotal * Decimal("0.20")  # 20% VAT
                service_charge = subtotal * Decimal("0.125")  # 12.5% service charge
                total_amount = subtotal + tax_amount + service_charge
                
                # Update order with totals and items
                order.items = order_items
                order.subtotal = subtotal
                order.tax_amount = tax_amount
                order.service_charge = service_charge
                order.total_amount = total_amount
                
                # Link to customer (80% of orders have customer)
                if self.customers and random.random() < 0.8:
                    customer = random.choice(self.customers)
                    order.customer_id = uuid.UUID(customer["id"])
                
                self.session.add(order)
                
                # Create payment record
                payment_method = random.choices(
                    ["card", "cash", "qr_code", "mobile_payment"],
                    weights=[0.55, 0.25, 0.15, 0.05]
                )[0]
                
                # Calculate payment fees (realistic rates)
                if payment_method == "cash":
                    fee_amount = Decimal("0.00")
                    net_amount = total_amount
                elif payment_method == "qr_code":
                    fee_amount = total_amount * Decimal("0.012")  # 1.2% for QR
                    net_amount = total_amount - fee_amount
                else:  # card or mobile
                    fee_amount = total_amount * Decimal("0.029")  # 2.9% for cards
                    net_amount = total_amount - fee_amount
                
                payment = Payment(
                    id=uuid.uuid4(),
                    order_id=order_id,
                    payment_method=payment_method,
                    amount=total_amount,
                    fee_amount=fee_amount,
                    net_amount=net_amount,
                    status="completed",
                    processed_at=order_time,
                    created_at=order_time
                )
                self.session.add(payment)
                
                total_orders += 1
                
                # Commit in batches to avoid memory issues
                if total_orders % 100 == 0:
                    self.session.commit()
                    print(f"   📈 Created {total_orders} orders...")
        
        print(f"   ✅ Created {total_orders} orders over 90 days")

async def main():
    """Main execution function"""
    seeder = OrderCustomerSeeder()
    await seeder.run()

if __name__ == "__main__":
    asyncio.run(main())