#!/usr/bin/env python3
"""
Production Seed Data Script for Fynlo POS
Creates realistic data for ONE Mexican restaurant as if the owner entered it themselves.

This script replaces all mock/demo data with production-ready seed data that can be used
for testing reports, employee management, inventory tracking, and all other features.

NO MOCK DATA - Only realistic data a Mexican restaurant would actually have.
"""

import asyncio
import sys
import os
from datetime import datetime, date, time, timedelta
from decimal import Decimal
from typing import List, Dict, Any
import uuid
import random

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db, Base, engine
from app.models import *
from sqlalchemy.orm import Session
from sqlalchemy import select
import bcrypt


class ProductionSeeder:
    """Seed production data for ONE Mexican restaurant"""
    
    def __init__(self):
        self.session: Session = None
        self.restaurant_id: str = None
        self.platform_id: str = None
        self.owner_user_id: str = None
        self.employees: List[Dict] = []
        self.categories: List[Dict] = []
        self.products: List[Dict] = []
        self.inventory_items: List[Dict] = []
        self.suppliers: List[Dict] = []
        
    async def run(self):
        """Execute the complete seeding process"""
        print("🌮 Starting Production Seed Data for Fynlo POS...")
        print("📍 Target: ONE Mexican Restaurant (Casa Estrella)")
        print("🚨 NO MOCK DATA - Only realistic production data")
        print("-" * 50)
        
        # Get database session
        db_gen = get_db()
        self.session = next(db_gen)
        
        try:
            # Step 1: Create Platform Owner
            await self._create_platform_owner()
            
            # Step 2: Create Mexican Restaurant
            await self._create_restaurant()
            
            # Step 3: Create Restaurant Owner & Manager
            await self._create_restaurant_management()
            
            # Step 4: Create Employees (8-10 realistic staff)
            await self._create_employees()
            
            # Step 5: Create Menu Categories
            await self._create_categories()
            
            # Step 6: Create Menu Items (30-40 authentic Mexican dishes)
            await self._create_menu_items()
            
            # Step 7: Create Inventory Items
            await self._create_inventory_items()
            
            # Step 8: Create Suppliers
            await self._create_suppliers()
            
            # Step 9: Create 30 days of order history
            await self._create_order_history()
            
            # Step 10: Create Employee Schedules (current week + next week)
            await self._create_schedules()
            
            # Step 11: Create Stock Movements
            await self._create_stock_movements()
            
            # Step 12: Generate Reports
            await self._generate_reports()
            
            # Step 13: Create Restaurant Settings
            await self._create_restaurant_settings()
            
            self.session.commit()
            print("\n✅ Production seed data created successfully!")
            print(f"🏪 Restaurant: Casa Estrella Mexican Cuisine")
            print(f"👥 Staff: {len(self.employees)} employees")
            print(f"🍽️ Menu: {len(self.products)} authentic Mexican dishes")
            print(f"📦 Inventory: {len(self.inventory_items)} tracked items")
            print(f"🚚 Suppliers: {len(self.suppliers)} vendors")
            print(f"📊 30 days of realistic order history")
            print(f"📅 Current week + next week schedules")
            
        except Exception as e:
            self.session.rollback()
            print(f"❌ Error creating seed data: {e}")
            raise
        finally:
            self.session.close()

    async def _create_platform_owner(self):
        """Create the platform owner account"""
        print("1️⃣ Creating Platform Owner...")
        
        # Create platform
        platform = Platform(
            id=str(uuid.uuid4()),
            name="Fynlo POS Platform",
            owner_email="admin@fynlo.com",
            subscription_tier="professional"
        )
        self.session.add(platform)
        self.platform_id = platform.id
        
        # Create platform owner user
        hashed_password = bcrypt.hashpw("FynloPlatform2025!".encode('utf-8'), bcrypt.gensalt())
        platform_owner = User(
            id=str(uuid.uuid4()),
            email="admin@fynlo.com",
            first_name="Platform",
            last_name="Administrator",
            role="platform_owner",
            is_active=True,
            password_hash=hashed_password.decode('utf-8')
        )
        self.session.add(platform_owner)
        print("   ✓ Platform owner created")

    async def _create_restaurant(self):
        """Create Casa Estrella Mexican Restaurant"""
        print("2️⃣ Creating Mexican Restaurant...")
        
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            platform_id=self.platform_id,
            name="Casa Estrella Mexican Cuisine",
            address={
                "line1": "145 Camden High Street",
                "line2": "Camden Market",
                "city": "London",
                "postcode": "NW1 7JR",
                "country": "United Kingdom"
            },
            phone="+44 20 7485 2847",
            email="info@casaestrella.co.uk",
            timezone="Europe/London",
            business_hours={
                "monday": {"open": "11:00", "close": "22:00"},
                "tuesday": {"open": "11:00", "close": "22:00"},
                "wednesday": {"open": "11:00", "close": "22:00"},
                "thursday": {"open": "11:00", "close": "22:30"},
                "friday": {"open": "11:00", "close": "23:00"},
                "saturday": {"open": "10:00", "close": "23:00"},
                "sunday": {"open": "10:00", "close": "21:30"}
            },
            settings={
                "pos": {
                    "table_service": True,
                    "takeaway": True,
                    "delivery": False,
                    "order_number_prefix": "CE",
                    "receipt_footer": "¡Gracias por su visita! Thanks for visiting!"
                },
                "payment": {
                    "cash_enabled": True,
                    "card_enabled": True,
                    "qr_enabled": True,
                    "apple_pay_enabled": True,
                    "split_bills": True
                },
                "tax": {
                    "vat_rate": "20.0",
                    "service_charge": "12.5",
                    "include_vat_in_prices": True
                },
                "kitchen": {
                    "prep_time_default": 15,
                    "allergen_warnings": True,
                    "spice_levels": ["Mild", "Medium", "Hot", "Extra Hot"]
                }
            }
        )
        
        self.session.add(restaurant)
        self.restaurant_id = restaurant.id
        print("   ✓ Casa Estrella Mexican Cuisine created")

    async def _create_restaurant_management(self):
        """Create restaurant owner and manager accounts"""
        print("3️⃣ Creating Restaurant Management...")
        
        # Restaurant Owner
        owner_password = bcrypt.hashpw("CasaEstrella2025!".encode('utf-8'), bcrypt.gensalt())
        owner = User(
            id=str(uuid.uuid4()),
            email="carlos@casaestrella.co.uk",
            first_name="Carlos",
            last_name="Hernández",
            role="restaurant_owner",
            restaurant_id=self.restaurant_id,
            is_active=True,
            password_hash=owner_password.decode('utf-8')
        )
        self.session.add(owner)
        self.owner_user_id = owner.id
        
        # Restaurant Manager
        manager_password = bcrypt.hashpw("Manager2025!".encode('utf-8'), bcrypt.gensalt())
        manager = User(
            id=str(uuid.uuid4()),
            email="maria@casaestrella.co.uk",
            first_name="María",
            last_name="González",
            role="manager",
            restaurant_id=self.restaurant_id,
            is_active=True,
            password_hash=manager_password.decode('utf-8')
        )
        self.session.add(manager)
        
        print("   ✓ Owner: Carlos Hernández")
        print("   ✓ Manager: María González")

    async def _create_employees(self):
        """Create 8-10 realistic restaurant employees"""
        print("4️⃣ Creating Restaurant Staff...")
        
        staff_data = [
            {
                "first_name": "Luis", "last_name": "Morales", "role": "employee",
                "email": "luis@casaestrella.co.uk", "phone": "+44 7723 445 667",
                "employee_role": "head_chef", "hourly_rate": Decimal("16.50"),
                "hire_date": date.today() - timedelta(days=180),
                "employment_type": "full_time", "max_hours": 40
            },
            {
                "first_name": "Sofia", "last_name": "Ramírez", "role": "employee",
                "email": "sofia@casaestrella.co.uk", "phone": "+44 7892 334 556",
                "employee_role": "sous_chef", "hourly_rate": Decimal("14.25"),
                "hire_date": date.today() - timedelta(days=120),
                "employment_type": "full_time", "max_hours": 38
            },
            {
                "first_name": "Diego", "last_name": "Castillo", "role": "employee",
                "email": "diego@casaestrella.co.uk", "phone": "+44 7756 223 445",
                "employee_role": "line_cook", "hourly_rate": Decimal("12.80"),
                "hire_date": date.today() - timedelta(days=95),
                "employment_type": "full_time", "max_hours": 35
            },
            {
                "first_name": "Isabella", "last_name": "Torres", "role": "employee",
                "email": "isabella@casaestrella.co.uk", "phone": "+44 7667 112 334",
                "employee_role": "server", "hourly_rate": Decimal("11.50"),
                "hire_date": date.today() - timedelta(days=75),
                "employment_type": "part_time", "max_hours": 25
            },
            {
                "first_name": "Miguel", "last_name": "Vargas", "role": "employee",
                "email": "miguel@casaestrella.co.uk", "phone": "+44 7534 998 776",
                "employee_role": "server", "hourly_rate": Decimal("11.50"),
                "hire_date": date.today() - timedelta(days=60),
                "employment_type": "part_time", "max_hours": 30
            },
            {
                "first_name": "Carmen", "last_name": "Jiménez", "role": "employee",
                "email": "carmen@casaestrella.co.uk", "phone": "+44 7445 887 665",
                "employee_role": "server", "hourly_rate": Decimal("11.80"),
                "hire_date": date.today() - timedelta(days=45),
                "employment_type": "part_time", "max_hours": 20
            },
            {
                "first_name": "José", "last_name": "Mendoza", "role": "employee",
                "email": "jose@casaestrella.co.uk", "phone": "+44 7778 554 332",
                "employee_role": "bartender", "hourly_rate": Decimal("12.20"),
                "hire_date": date.today() - timedelta(days=30),
                "employment_type": "part_time", "max_hours": 25
            },
            {
                "first_name": "Ana", "last_name": "López", "role": "employee",
                "email": "ana@casaestrella.co.uk", "phone": "+44 7665 443 221",
                "employee_role": "cashier", "hourly_rate": Decimal("11.20"),
                "hire_date": date.today() - timedelta(days=25),
                "employment_type": "part_time", "max_hours": 20
            }
        ]
        
        for staff in staff_data:
            # Create User account
            password = bcrypt.hashpw(f"{staff['first_name']}2025!".encode('utf-8'), bcrypt.gensalt())
            user = User(
                id=str(uuid.uuid4()),
                email=staff["email"],
                first_name=staff["first_name"],
                last_name=staff["last_name"],
                role=staff["role"],
                restaurant_id=self.restaurant_id,
                is_active=True,
                password_hash=password.decode('utf-8')
            )
            self.session.add(user)
            
            # Create Employee Profile
            employee = EmployeeProfile(
                id=str(uuid.uuid4()),
                user_id=user.id,
                restaurant_id=self.restaurant_id,
                employee_id=f"CE{len(self.employees) + 1:03d}",
                hire_date=staff["hire_date"],
                employment_type=staff["employment_type"],
                hourly_rate=staff["hourly_rate"],
                phone=staff["phone"],
                emergency_contact={
                    "name": f"{staff['first_name']} Emergency Contact",
                    "phone": f"+44 7{random.randint(100, 999)} {random.randint(100, 999)} {random.randint(100, 999)}",
                    "relationship": random.choice(["spouse", "parent", "sibling"])
                },
                max_hours_per_week=staff["max_hours"],
                min_hours_per_week=10 if staff["employment_type"] == "part_time" else 30,
                availability={
                    "monday": {"start": "10:00", "end": "22:00"},
                    "tuesday": {"start": "10:00", "end": "22:00"},
                    "wednesday": {"start": "10:00", "end": "22:00"},
                    "thursday": {"start": "10:00", "end": "23:00"},
                    "friday": {"start": "10:00", "end": "23:30"},
                    "saturday": {"start": "09:30", "end": "23:30"},
                    "sunday": {"start": "09:30", "end": "22:00"}
                },
                performance_rating=Decimal(str(round(random.uniform(3.5, 5.0), 2))),
                total_sales=Decimal(str(random.randint(5000, 25000))),
                orders_served=random.randint(200, 1200),
                average_order_time=random.randint(8, 18),
                is_active=True
            )
            self.session.add(employee)
            
            # Store for later use
            self.employees.append({
                "user_id": user.id,
                "employee_id": employee.id,
                "role": staff["employee_role"],
                "name": f"{staff['first_name']} {staff['last_name']}",
                "hourly_rate": staff["hourly_rate"],
                "employment_type": staff["employment_type"]
            })
            
            print(f"   ✓ {staff['first_name']} {staff['last_name']} - {staff['employee_role']}")

    async def _create_categories(self):
        """Create authentic Mexican menu categories"""
        print("5️⃣ Creating Menu Categories...")
        
        categories_data = [
            {
                "name": "Antojitos", "name_es": "Antojitos",
                "description": "Traditional Mexican appetizers and small plates",
                "display_order": 1, "color": "#E53E3E"
            },
            {
                "name": "Tacos", "name_es": "Tacos",
                "description": "Authentic tacos with fresh tortillas and traditional fillings",
                "display_order": 2, "color": "#38A169"
            },
            {
                "name": "Enchiladas", "name_es": "Enchiladas",
                "description": "Rolled tortillas with various fillings and sauces",
                "display_order": 3, "color": "#D69E2E"
            },
            {
                "name": "Quesadillas", "name_es": "Quesadillas",
                "description": "Grilled tortillas filled with cheese and other ingredients",
                "display_order": 4, "color": "#9F7AEA"
            },
            {
                "name": "Platos Principales", "name_es": "Platos Principales",
                "description": "Hearty main dishes and traditional specialties",
                "display_order": 5, "color": "#F56500"
            },
            {
                "name": "Bebidas", "name_es": "Bebidas",
                "description": "Traditional drinks, fresh juices, and cocktails",
                "display_order": 6, "color": "#0BC5EA"
            },
            {
                "name": "Postres", "name_es": "Postres",
                "description": "Traditional Mexican desserts and sweet treats",
                "display_order": 7, "color": "#ED64A6"
            }
        ]
        
        for cat_data in categories_data:
            category = Category(
                id=str(uuid.uuid4()),
                restaurant_id=self.restaurant_id,
                name=cat_data["name"],
                description=cat_data["description"],
                color=cat_data["color"],
                sort_order=cat_data["display_order"],
                is_active=True
            )
            self.session.add(category)
            self.categories.append({
                "id": category.id,
                "name": cat_data["name"],
                "display_order": cat_data["display_order"]
            })
            print(f"   ✓ {cat_data['name']} ({cat_data['name_es']})")

    async def _create_menu_items(self):
        """Create 30-40 authentic Mexican menu items"""
        print("6️⃣ Creating Menu Items...")
        
        # Get category IDs
        antojitos_id = next(c["id"] for c in self.categories if c["name"] == "Antojitos")
        tacos_id = next(c["id"] for c in self.categories if c["name"] == "Tacos")
        enchiladas_id = next(c["id"] for c in self.categories if c["name"] == "Enchiladas")
        quesadillas_id = next(c["id"] for c in self.categories if c["name"] == "Quesadillas")
        platos_id = next(c["id"] for c in self.categories if c["name"] == "Platos Principales")
        bebidas_id = next(c["id"] for c in self.categories if c["name"] == "Bebidas")
        postres_id = next(c["id"] for c in self.categories if c["name"] == "Postres")
        
        menu_items = [
            # Antojitos
            {
                "name": "Guacamole & Chips", "name_es": "Guacamole y Totopos",
                "description": "Fresh avocado dip with crispy tortilla chips", "category_id": antojitos_id,
                "price": Decimal("8.95"), "cost": Decimal("2.50"), "prep_time": 5,
                "allergens": [], "spice_level": "Mild"
            },
            {
                "name": "Jalapeño Poppers", "name_es": "Chiles Rellenos Pequeños",
                "description": "Fresh jalapeños stuffed with cream cheese, battered and fried", "category_id": antojitos_id,
                "price": Decimal("7.50"), "cost": Decimal("2.00"), "prep_time": 8,
                "allergens": ["dairy", "gluten"], "spice_level": "Medium"
            },
            {
                "name": "Nachos Supreme", "name_es": "Nachos Supremos",
                "description": "Crispy tortilla chips with melted cheese, jalapeños, sour cream, and salsa", "category_id": antojitos_id,
                "price": Decimal("11.95"), "cost": Decimal("3.50"), "prep_time": 10,
                "allergens": ["dairy", "gluten"], "spice_level": "Medium"
            },
            {
                "name": "Elote (Mexican Street Corn)", "name_es": "Elote",
                "description": "Grilled corn on the cob with mayo, cotija cheese, chili powder, and lime", "category_id": antojitos_id,
                "price": Decimal("6.50"), "cost": Decimal("1.80"), "prep_time": 8,
                "allergens": ["dairy"], "spice_level": "Mild"
            },
            
            # Tacos
            {
                "name": "Taco de Carnitas", "name_es": "Taco de Carnitas",
                "description": "Slow-cooked pork shoulder with onions and cilantro on corn tortilla", "category_id": tacos_id,
                "price": Decimal("4.25"), "cost": Decimal("1.50"), "prep_time": 5,
                "allergens": [], "spice_level": "Mild"
            },
            {
                "name": "Taco de Pollo", "name_es": "Taco de Pollo",
                "description": "Grilled chicken with pico de gallo and avocado on corn tortilla", "category_id": tacos_id,
                "price": Decimal("4.50"), "cost": Decimal("1.75"), "prep_time": 6,
                "allergens": [], "spice_level": "Mild"
            },
            {
                "name": "Taco de Carne Asada", "name_es": "Taco de Carne Asada",
                "description": "Grilled beef with onions, cilantro, and salsa verde on corn tortilla", "category_id": tacos_id,
                "price": Decimal("4.75"), "cost": Decimal("2.00"), "prep_time": 8,
                "allergens": [], "spice_level": "Medium"
            },
            {
                "name": "Taco de Pescado", "name_es": "Taco de Pescado",
                "description": "Beer-battered fish with cabbage slaw and chipotle mayo", "category_id": tacos_id,
                "price": Decimal("5.25"), "cost": Decimal("2.25"), "prep_time": 10,
                "allergens": ["fish", "gluten"], "spice_level": "Medium"
            },
            {
                "name": "Taco de Vegetales", "name_es": "Taco de Vegetales",
                "description": "Grilled peppers, onions, and mushrooms with black beans", "category_id": tacos_id,
                "price": Decimal("3.95"), "cost": Decimal("1.25"), "prep_time": 5,
                "allergens": [], "spice_level": "Mild"
            },
            
            # Enchiladas
            {
                "name": "Enchiladas Verdes", "name_es": "Enchiladas Verdes",
                "description": "Three chicken enchiladas with green tomatillo sauce and Mexican cream", "category_id": enchiladas_id,
                "price": Decimal("14.95"), "cost": Decimal("4.50"), "prep_time": 15,
                "allergens": ["dairy", "gluten"], "spice_level": "Medium"
            },
            {
                "name": "Enchiladas Rojas", "name_es": "Enchiladas Rojas",
                "description": "Three beef enchiladas with red chile sauce and melted cheese", "category_id": enchiladas_id,
                "price": Decimal("15.95"), "cost": Decimal("5.00"), "prep_time": 15,
                "allergens": ["dairy", "gluten"], "spice_level": "Medium"
            },
            {
                "name": "Enchiladas de Mole", "name_es": "Enchiladas de Mole",
                "description": "Three chicken enchiladas with traditional mole sauce", "category_id": enchiladas_id,
                "price": Decimal("16.95"), "cost": Decimal("5.50"), "prep_time": 18,
                "allergens": ["dairy", "gluten", "nuts"], "spice_level": "Mild"
            },
            
            # Quesadillas
            {
                "name": "Quesadilla de Queso", "name_es": "Quesadilla de Queso",
                "description": "Classic cheese quesadilla with Oaxaca and Monterey Jack cheese", "category_id": quesadillas_id,
                "price": Decimal("9.95"), "cost": Decimal("2.50"), "prep_time": 8,
                "allergens": ["dairy", "gluten"], "spice_level": "None"
            },
            {
                "name": "Quesadilla de Pollo", "name_es": "Quesadilla de Pollo",
                "description": "Grilled chicken quesadilla with peppers, onions, and cheese", "category_id": quesadillas_id,
                "price": Decimal("12.95"), "cost": Decimal("3.75"), "prep_time": 10,
                "allergens": ["dairy", "gluten"], "spice_level": "Mild"
            },
            {
                "name": "Quesadilla de Hongos", "name_es": "Quesadilla de Hongos",
                "description": "Mushroom quesadilla with huitlacoche and Oaxaca cheese", "category_id": quesadillas_id,
                "price": Decimal("11.50"), "cost": Decimal("3.25"), "prep_time": 9,
                "allergens": ["dairy", "gluten"], "spice_level": "Mild"
            },
            
            # Platos Principales
            {
                "name": "Carne Asada Platter", "name_es": "Plato de Carne Asada",
                "description": "Grilled beef steak with rice, beans, guacamole, and tortillas", "category_id": platos_id,
                "price": Decimal("18.95"), "cost": Decimal("6.50"), "prep_time": 20,
                "allergens": ["gluten"], "spice_level": "Medium"
            },
            {
                "name": "Pollo a la Plancha", "name_es": "Pollo a la Plancha",
                "description": "Grilled chicken breast with cilantro lime rice and black beans", "category_id": platos_id,
                "price": Decimal("16.95"), "cost": Decimal("5.25"), "prep_time": 18,
                "allergens": [], "spice_level": "Mild"
            },
            {
                "name": "Chiles Rellenos", "name_es": "Chiles Rellenos",
                "description": "Roasted poblano peppers stuffed with cheese, battered and fried", "category_id": platos_id,
                "price": Decimal("15.95"), "cost": Decimal("4.75"), "prep_time": 25,
                "allergens": ["dairy", "gluten", "eggs"], "spice_level": "Medium"
            },
            {
                "name": "Mole Poblano", "name_es": "Mole Poblano",
                "description": "Traditional chicken with complex mole sauce, rice, and tortillas", "category_id": platos_id,
                "price": Decimal("17.95"), "cost": Decimal("6.00"), "prep_time": 15,
                "allergens": ["nuts", "gluten"], "spice_level": "Mild"
            },
            {
                "name": "Pescado Veracruzano", "name_es": "Pescado Veracruzano",
                "description": "Fish fillet in Veracruz-style sauce with olives, capers, and tomatoes", "category_id": platos_id,
                "price": Decimal("19.95"), "cost": Decimal("7.25"), "prep_time": 22,
                "allergens": ["fish"], "spice_level": "Medium"
            },
            {
                "name": "Vegetarian Burrito Bowl", "name_es": "Bowl Vegetariano",
                "description": "Black beans, cilantro rice, grilled vegetables, guacamole, and salsa", "category_id": platos_id,
                "price": Decimal("13.95"), "cost": Decimal("3.50"), "prep_time": 12,
                "allergens": [], "spice_level": "Mild"
            },
            
            # Bebidas
            {
                "name": "Fresh Lime Margarita", "name_es": "Margarita de Lima",
                "description": "Classic margarita with fresh lime juice and premium tequila", "category_id": bebidas_id,
                "price": Decimal("8.95"), "cost": Decimal("2.25"), "prep_time": 3,
                "allergens": [], "spice_level": "None"
            },
            {
                "name": "Horchata", "name_es": "Horchata",
                "description": "Traditional rice and cinnamon drink, served cold", "category_id": bebidas_id,
                "price": Decimal("4.50"), "cost": Decimal("1.00"), "prep_time": 2,
                "allergens": ["dairy"], "spice_level": "None"
            },
            {
                "name": "Agua Fresca (Watermelon)", "name_es": "Agua de Sandía",
                "description": "Fresh watermelon water with lime and mint", "category_id": bebidas_id,
                "price": Decimal("3.95"), "cost": Decimal("0.75"), "prep_time": 2,
                "allergens": [], "spice_level": "None"
            },
            {
                "name": "Mexican Hot Chocolate", "name_es": "Chocolate Caliente",
                "description": "Rich hot chocolate with cinnamon and a touch of chili", "category_id": bebidas_id,
                "price": Decimal("4.25"), "cost": Decimal("1.25"), "prep_time": 5,
                "allergens": ["dairy"], "spice_level": "Mild"
            },
            {
                "name": "Cerveza (Corona)", "name_es": "Cerveza Corona",
                "description": "Mexican beer served with lime", "category_id": bebidas_id,
                "price": Decimal("4.95"), "cost": Decimal("1.50"), "prep_time": 1,
                "allergens": ["gluten"], "spice_level": "None"
            },
            
            # Postres
            {
                "name": "Tres Leches Cake", "name_es": "Pastel de Tres Leches",
                "description": "Sponge cake soaked in three types of milk with cinnamon", "category_id": postres_id,
                "price": Decimal("6.95"), "cost": Decimal("1.75"), "prep_time": 3,
                "allergens": ["dairy", "gluten", "eggs"], "spice_level": "None"
            },
            {
                "name": "Churros with Chocolate", "name_es": "Churros con Chocolate",
                "description": "Fried dough pastry with cinnamon sugar and chocolate dipping sauce", "category_id": postres_id,
                "price": Decimal("5.95"), "cost": Decimal("1.50"), "prep_time": 8,
                "allergens": ["gluten", "dairy"], "spice_level": "None"
            },
            {
                "name": "Flan", "name_es": "Flan",
                "description": "Traditional vanilla custard with caramel sauce", "category_id": postres_id,
                "price": Decimal("5.50"), "cost": Decimal("1.25"), "prep_time": 2,
                "allergens": ["dairy", "eggs"], "spice_level": "None"
            },
            {
                "name": "Sopapillas", "name_es": "Sopapillas",
                "description": "Fried pastry squares dusted with cinnamon sugar and honey", "category_id": postres_id,
                "price": Decimal("4.95"), "cost": Decimal("1.00"), "prep_time": 6,
                "allergens": ["gluten"], "spice_level": "None"
            }
        ]
        
        for item_data in menu_items:
            product = Product(
                id=str(uuid.uuid4()),
                restaurant_id=self.restaurant_id,
                category_id=item_data["category_id"],
                name=item_data["name"],
                description=item_data["description"],
                price=item_data["price"],
                cost=item_data["cost"],
                sku=f"CE-{len(self.products) + 1:03d}",
                barcode=f"7{random.randint(100000, 999999):06d}{random.randint(10000, 99999):05d}",
                is_active=True,
                prep_time=item_data["prep_time"],
                dietary_info=item_data["allergens"],
                modifiers=[],
                stock_tracking=False,
                stock_quantity=0
            )
            self.session.add(product)
            self.products.append({
                "id": product.id,
                "name": item_data["name"],
                "price": item_data["price"],
                "cost": item_data["cost"],
                "category": item_data["category_id"]
            })
            
        print(f"   ✓ Created {len(menu_items)} authentic Mexican dishes")

    async def _create_inventory_items(self):
        """Create inventory items that a Mexican restaurant would track"""
        print("7️⃣ Creating Inventory Items...")
        
        inventory_data = [
            # Proteins
            {"name": "Chicken Breast", "sku": "CHICKEN-001", "unit": "kg", "cost": Decimal("8.50"), "stock": Decimal("25.0"), "min": Decimal("5.0")},
            {"name": "Beef Chuck (Carne Asada)", "sku": "BEEF-001", "unit": "kg", "cost": Decimal("12.75"), "stock": Decimal("20.0"), "min": Decimal("3.0")},
            {"name": "Pork Shoulder (Carnitas)", "sku": "PORK-001", "unit": "kg", "cost": Decimal("9.25"), "stock": Decimal("15.0"), "min": Decimal("3.0")},
            {"name": "White Fish Fillets", "sku": "FISH-001", "unit": "kg", "cost": Decimal("15.50"), "stock": Decimal("8.0"), "min": Decimal("2.0")},
            
            # Vegetables & Fresh
            {"name": "Avocados", "sku": "VEG-001", "unit": "units", "cost": Decimal("0.85"), "stock": Decimal("50.0"), "min": Decimal("20.0")},
            {"name": "White Onions", "sku": "VEG-002", "unit": "kg", "cost": Decimal("2.20"), "stock": Decimal("12.0"), "min": Decimal("3.0")},
            {"name": "Tomatoes", "sku": "VEG-003", "unit": "kg", "cost": Decimal("3.50"), "stock": Decimal("15.0"), "min": Decimal("5.0")},
            {"name": "Cilantro", "sku": "HERB-001", "unit": "bunches", "cost": Decimal("1.25"), "stock": Decimal("25.0"), "min": Decimal("10.0")},
            {"name": "Limes", "sku": "FRUIT-001", "unit": "kg", "cost": Decimal("4.80"), "stock": Decimal("8.0"), "min": Decimal("3.0")},
            {"name": "Jalapeño Peppers", "sku": "VEG-004", "unit": "kg", "cost": Decimal("6.50"), "stock": Decimal("3.0"), "min": Decimal("1.0")},
            {"name": "Poblano Peppers", "sku": "VEG-005", "unit": "kg", "cost": Decimal("8.75"), "stock": Decimal("4.0"), "min": Decimal("1.0")},
            
            # Dairy & Cheese
            {"name": "Oaxaca Cheese", "sku": "DAIRY-001", "unit": "kg", "cost": Decimal("18.50"), "stock": Decimal("5.0"), "min": Decimal("2.0")},
            {"name": "Monterey Jack Cheese", "sku": "DAIRY-002", "unit": "kg", "cost": Decimal("12.80"), "stock": Decimal("8.0"), "min": Decimal("2.0")},
            {"name": "Mexican Crema", "sku": "DAIRY-003", "unit": "l", "cost": Decimal("8.25"), "stock": Decimal("6.0"), "min": Decimal("2.0")},
            {"name": "Cotija Cheese", "sku": "DAIRY-004", "unit": "kg", "cost": Decimal("22.50"), "stock": Decimal("3.0"), "min": Decimal("1.0")},
            
            # Pantry & Dry Goods
            {"name": "Corn Tortillas", "sku": "TORTILLA-001", "unit": "packs", "cost": Decimal("3.50"), "stock": Decimal("20.0"), "min": Decimal("10.0")},
            {"name": "Flour Tortillas", "sku": "TORTILLA-002", "unit": "packs", "cost": Decimal("4.25"), "stock": Decimal("15.0"), "min": Decimal("8.0")},
            {"name": "Black Beans (Dry)", "sku": "LEGUME-001", "unit": "kg", "cost": Decimal("4.80"), "stock": Decimal("10.0"), "min": Decimal("3.0")},
            {"name": "Rice (Long Grain)", "sku": "GRAIN-001", "unit": "kg", "cost": Decimal("2.75"), "stock": Decimal("25.0"), "min": Decimal("10.0")},
            {"name": "Masa Harina", "sku": "FLOUR-001", "unit": "kg", "cost": Decimal("3.25"), "stock": Decimal("8.0"), "min": Decimal("3.0")},
            
            # Spices & Seasonings
            {"name": "Cumin (Ground)", "sku": "SPICE-001", "unit": "g", "cost": Decimal("0.08"), "stock": Decimal("500.0"), "min": Decimal("100.0")},
            {"name": "Chili Powder", "sku": "SPICE-002", "unit": "g", "cost": Decimal("0.12"), "stock": Decimal("750.0"), "min": Decimal("200.0")},
            {"name": "Paprika", "sku": "SPICE-003", "unit": "g", "cost": Decimal("0.15"), "stock": Decimal("400.0"), "min": Decimal("100.0")},
            {"name": "Mexican Oregano", "sku": "HERB-002", "unit": "g", "cost": Decimal("0.25"), "stock": Decimal("300.0"), "min": Decimal("50.0")},
            
            # Beverages
            {"name": "Corona Beer", "sku": "BEER-001", "unit": "bottles", "cost": Decimal("1.50"), "stock": Decimal("72.0"), "min": Decimal("24.0")},
            {"name": "Agave Tequila", "sku": "ALCOHOL-001", "unit": "l", "cost": Decimal("45.00"), "stock": Decimal("3.0"), "min": Decimal("1.0")},
            {"name": "Triple Sec", "sku": "ALCOHOL-002", "unit": "l", "cost": Decimal("18.50"), "stock": Decimal("2.0"), "min": Decimal("0.5")},
            
            # Cooking Essentials
            {"name": "Vegetable Oil", "sku": "OIL-001", "unit": "l", "cost": Decimal("4.25"), "stock": Decimal("15.0"), "min": Decimal("5.0")},
            {"name": "Sea Salt", "sku": "SEASONING-001", "unit": "kg", "cost": Decimal("2.80"), "stock": Decimal("5.0"), "min": Decimal("2.0")},
            {"name": "Garlic", "sku": "VEG-006", "unit": "kg", "cost": Decimal("8.50"), "stock": Decimal("4.0"), "min": Decimal("1.0")}
        ]
        
        for inv_data in inventory_data:
            inventory = InventoryItem(
                sku=inv_data["sku"],
                name=inv_data["name"],
                description=f"Tracked for Casa Estrella - {inv_data['unit']} unit",
                qty_g=int(inv_data["stock"]) if inv_data["unit"] in ["g", "ml"] else int(inv_data["stock"] * 1000),
                par_level_g=int(inv_data["min"]) if inv_data["unit"] in ["g", "ml"] else int(inv_data["min"] * 1000),
                unit=inv_data["unit"],
                cost_per_unit=inv_data["cost"],
                supplier=f"Casa Estrella Supplier - {inv_data['sku']}"
            )
            self.session.add(inventory)
            self.inventory_items.append({
                "sku": inv_data["sku"],
                "name": inv_data["name"],
                "unit": inv_data["unit"],
                "current_stock": inv_data["stock"],
                "unit_cost": inv_data["cost"]
            })
            
        print(f"   ✓ Created {len(inventory_data)} inventory items")

    async def _create_suppliers(self):
        """Create realistic suppliers for a Mexican restaurant"""
        print("8️⃣ Creating Suppliers...")
        
        suppliers_data = [
            {
                "name": "London Fresh Meat Co.",
                "code": "LFM001",
                "contact_name": "David Richardson",
                "email": "orders@londonfreshmeat.co.uk",
                "phone": "+44 20 8547 3920",
                "address": {
                    "line1": "85 Smithfield Market",
                    "city": "London",
                    "postcode": "EC1A 9PS",
                    "country": "United Kingdom"
                },
                "categories": ["meat", "poultry"],
                "payment_terms": "net30",
                "delivery_days": ["tuesday", "friday"],
                "lead_time": 2
            },
            {
                "name": "Borough Market Produce",
                "code": "BMP002",
                "contact_name": "Sarah Williams",
                "email": "wholesale@boroughproduce.co.uk",
                "phone": "+44 20 7403 1002",
                "address": {
                    "line1": "8 Southwark Street",
                    "city": "London",
                    "postcode": "SE1 1TL",
                    "country": "United Kingdom"
                },
                "categories": ["produce", "vegetables", "fruits"],
                "payment_terms": "net14",
                "delivery_days": ["monday", "wednesday", "friday"],
                "lead_time": 1
            },
            {
                "name": "Mexican Specialty Foods Ltd",
                "code": "MSF003",
                "contact_name": "Carlos Mendez",
                "email": "sales@mexicanspecialty.co.uk",
                "phone": "+44 20 7252 8847",
                "address": {
                    "line1": "12 Commercial Road",
                    "city": "London",
                    "postcode": "E1 1AB",
                    "country": "United Kingdom"
                },
                "categories": ["spices", "specialty", "beverages"],
                "payment_terms": "net21",
                "delivery_days": ["thursday"],
                "lead_time": 3
            },
            {
                "name": "Camden Dairy Supplies",
                "code": "CDS004",
                "contact_name": "Emma Thompson",
                "email": "orders@camdendairy.co.uk",
                "phone": "+44 20 7485 9632",
                "address": {
                    "line1": "78 Chalk Farm Road",
                    "city": "London",
                    "postcode": "NW1 8AN",
                    "country": "United Kingdom"
                },
                "categories": ["dairy", "cheese"],
                "payment_terms": "net7",
                "delivery_days": ["tuesday", "thursday", "saturday"],
                "lead_time": 1
            }
        ]
        
        for sup_data in suppliers_data:
            supplier = Supplier(
                id=str(uuid.uuid4()),
                restaurant_id=self.restaurant_id,
                name=sup_data["name"],
                code=sup_data["code"],
                contact_name=sup_data["contact_name"],
                email=sup_data["email"],
                phone=sup_data["phone"],
                address=sup_data["address"],
                payment_terms=sup_data["payment_terms"],
                delivery_days=sup_data["delivery_days"],
                lead_time_days=sup_data["lead_time"],
                categories=sup_data["categories"],
                minimum_order=Decimal("50.00"),
                on_time_delivery_rate=Decimal(str(random.uniform(85.0, 98.0))),
                quality_rating=Decimal(str(random.uniform(4.0, 5.0))),
                total_purchases=Decimal(str(random.uniform(5000.0, 25000.0))),
                is_active=True,
                is_preferred=sup_data["code"] in ["BMP002", "MSF003"]
            )
            self.session.add(supplier)
            self.suppliers.append({
                "id": supplier.id,
                "name": sup_data["name"],
                "code": sup_data["code"],
                "categories": sup_data["categories"]
            })
            print(f"   ✓ {sup_data['name']} ({sup_data['code']})")

    async def _create_order_history(self):
        """Create 30 days of realistic order history"""
        print("9️⃣ Creating Order History (30 days)...")
        
        # Get some employees for order assignments
        server_employees = [emp for emp in self.employees if emp["role"] in ["server", "cashier"]]
        
        total_orders = 0
        for days_ago in range(30, 0, -1):
            order_date = datetime.now() - timedelta(days=days_ago)
            
            # Different order volumes based on day of week
            day_of_week = order_date.weekday()  # 0=Monday, 6=Sunday
            if day_of_week in [4, 5, 6]:  # Friday, Saturday, Sunday
                daily_orders = random.randint(45, 75)
            elif day_of_week in [1, 2, 3]:  # Tuesday, Wednesday, Thursday
                daily_orders = random.randint(25, 45)
            else:  # Monday
                daily_orders = random.randint(15, 30)
            
            for order_num in range(daily_orders):
                # Order timing throughout the day
                if order_num < daily_orders * 0.3:  # Lunch rush
                    hour = random.randint(12, 14)
                elif order_num < daily_orders * 0.7:  # Dinner rush
                    hour = random.randint(18, 21)
                else:  # Other times
                    hour = random.choice([11, 15, 16, 17, 22])
                
                minute = random.randint(0, 59)
                order_time = order_date.replace(hour=hour, minute=minute, second=0)
                
                # Select random employee
                employee = random.choice(server_employees)
                
                # Create order
                order = Order(
                    id=str(uuid.uuid4()),
                    restaurant_id=self.restaurant_id,
                    order_number=f"CE{order_time.strftime('%y%m%d')}{order_num+1:03d}",
                    order_type=random.choices(
                        ["dine_in", "takeaway"], 
                        weights=[0.7, 0.3]
                    )[0],
                    table_number=str(random.randint(1, 20)) if random.random() > 0.3 else None,
                    status="completed",
                    items=[],
                    subtotal=Decimal("0.00"),
                    tax_amount=Decimal("0.00"),
                    service_charge=Decimal("0.00"),
                    total_amount=Decimal("0.00"),
                    payment_status="completed",
                    created_by=employee["user_id"]
                )
                self.session.add(order)
                
                # Add 1-5 items to the order
                num_items = random.randint(1, 5)
                order_total = Decimal("0.00")
                order_items = []
                
                for _ in range(num_items):
                    product = random.choice(self.products)
                    quantity = random.randint(1, 3)
                    item_total = product["price"] * quantity
                    
                    item_data = {
                        "product_id": product["id"],
                        "product_name": product["name"],
                        "quantity": quantity,
                        "unit_price": float(product["price"]),
                        "total_price": float(item_total),
                        "special_instructions": random.choice([
                            "", "", "", "No onions", "Extra spicy", "On the side"
                        ])
                    }
                    order_items.append(item_data)
                    order_total += item_total
                
                # Calculate totals
                subtotal = order_total
                tax_amount = subtotal * Decimal("0.20")  # 20% VAT
                service_charge = subtotal * Decimal("0.125")  # 12.5% service charge
                total_amount = subtotal + tax_amount + service_charge
                
                # Update order totals
                order.items = order_items
                order.subtotal = subtotal
                order.tax_amount = tax_amount
                order.service_charge = service_charge
                order.total_amount = total_amount
                order.created_by = employee["user_id"]
                
                # Payment
                payment_method = random.choices(
                    ["card", "cash", "qr_code"],
                    weights=[0.6, 0.25, 0.15]
                )[0]
                
                payment = Payment(
                    id=str(uuid.uuid4()),
                    order_id=order.id,
                    payment_method=payment_method,
                    amount=total_amount,
                    fee_amount=Decimal("0.00") if payment_method == "cash" else total_amount * Decimal("0.029"),
                    net_amount=total_amount if payment_method == "cash" else total_amount * Decimal("0.971"),
                    status="completed",
                    processed_at=order.updated_at
                )
                self.session.add(payment)
                
                total_orders += 1
                
                # Commit every 50 orders to avoid memory issues
                if total_orders % 50 == 0:
                    self.session.commit()
        
        print(f"   ✓ Created {total_orders} orders over 30 days")

    async def _create_schedules(self):
        """Create employee schedules for current week and next week"""
        print("🔟 Creating Employee Schedules...")
        
        # Get current week start (Monday)
        today = date.today()
        days_since_monday = today.weekday()
        current_week_start = today - timedelta(days=days_since_monday)
        
        schedules_created = 0
        
        # Create schedules for current week and next week
        for week_offset in [0, 1]:
            week_start = current_week_start + timedelta(weeks=week_offset)
            week_label = "current" if week_offset == 0 else "next"
            
            # Schedule each day of the week
            for day_offset in range(7):  # Monday to Sunday
                schedule_date = week_start + timedelta(days=day_offset)
                day_name = schedule_date.strftime('%A').lower()
                
                # Different staffing based on day
                if day_name in ['friday', 'saturday']:
                    # Weekend - more staff
                    scheduled_employees = random.sample(self.employees, min(6, len(self.employees)))
                elif day_name in ['tuesday', 'wednesday', 'thursday']:
                    # Mid-week - moderate staff
                    scheduled_employees = random.sample(self.employees, min(5, len(self.employees)))
                else:
                    # Monday/Sunday - fewer staff
                    scheduled_employees = random.sample(self.employees, min(4, len(self.employees)))
                
                for emp in scheduled_employees:
                    # Different shift times based on role
                    if emp["role"] in ["head_chef", "sous_chef"]:
                        # Kitchen staff start earlier
                        start_time = time(10, 0)
                        end_time = time(22, 0) if day_name in ['friday', 'saturday'] else time(21, 0)
                    elif emp["role"] == "line_cook":
                        start_time = time(11, 0)
                        end_time = time(21, 30) if day_name in ['friday', 'saturday'] else time(20, 30)
                    elif emp["role"] in ["server", "cashier"]:
                        # Front of house
                        if random.random() > 0.5:  # Split shift possibility
                            start_time = time(11, 0)
                            end_time = time(19, 0)
                        else:
                            start_time = time(17, 0)
                            end_time = time(23, 0) if day_name in ['friday', 'saturday'] else time(22, 0)
                    else:  # bartender, manager
                        start_time = time(16, 0)
                        end_time = time(23, 0) if day_name in ['friday', 'saturday'] else time(22, 0)
                    
                    # Respect part-time constraints
                    if emp["employment_type"] == "part_time":
                        # Shorter shifts for part-time
                        shift_hours = (datetime.combine(date.min, end_time) - datetime.combine(date.min, start_time)).seconds // 3600
                        if shift_hours > 8:
                            end_time = time(start_time.hour + 6, start_time.minute)
                    
                    schedule = Schedule(
                        id=str(uuid.uuid4()),
                        employee_id=emp["employee_id"],
                        restaurant_id=self.restaurant_id,
                        date=schedule_date,
                        start_time=start_time,
                        end_time=end_time,
                        break_minutes=30 if (datetime.combine(date.min, end_time) - datetime.combine(date.min, start_time)).seconds > 6*3600 else 0,
                        role=emp["role"],
                        status="published" if week_offset == 0 else "scheduled",
                        is_published=True,
                        notes=f"{week_label.title()} week shift - {emp['role']}",
                        created_by=self.owner_user_id
                    )
                    self.session.add(schedule)
                    schedules_created += 1
        
        print(f"   ✓ Created {schedules_created} shifts (current week + next week)")

    async def _create_stock_movements(self):
        """Create realistic stock movements"""
        print("1️⃣1️⃣ Creating Stock Movements...")
        
        movements_created = 0
        
        # Create movements for the last 30 days
        for days_ago in range(30, 0, -1):
            movement_date = datetime.now() - timedelta(days=days_ago)
            
            # Random number of movements per day
            daily_movements = random.randint(5, 15)
            
            for _ in range(daily_movements):
                inventory_item = random.choice(self.inventory_items)
                movement_type = random.choices(
                    ["sale", "purchase", "adjustment", "waste"],
                    weights=[0.6, 0.2, 0.1, 0.1]
                )[0]
                
                if movement_type == "sale":
                    # Negative quantity for sales
                    quantity = -Decimal(str(random.uniform(0.5, 5.0)))
                elif movement_type == "purchase":
                    # Positive quantity for purchases
                    quantity = Decimal(str(random.uniform(5.0, 20.0)))
                elif movement_type == "waste":
                    # Small negative quantities for waste
                    quantity = -Decimal(str(random.uniform(0.1, 2.0)))
                else:  # adjustment
                    # Can be positive or negative
                    quantity = Decimal(str(random.uniform(-3.0, 3.0)))
                
                # Calculate stock levels
                current_stock = inventory_item["current_stock"]
                stock_before = current_stock
                stock_after = stock_before + quantity
                
                # Select random employee for the movement
                employee = random.choice(self.employees)
                
                movement = StockMovement(
                    id=str(uuid.uuid4()),
                    restaurant_id=self.restaurant_id,
                    inventory_sku=inventory_item["sku"],
                    movement_type=movement_type.upper(),
                    quantity=quantity,
                    unit=inventory_item["unit"],
                    stock_before=stock_before,
                    stock_after=stock_after,
                    unit_cost=inventory_item["unit_cost"],
                    total_cost=abs(quantity) * inventory_item["unit_cost"],
                    reference_type=movement_type,
                    reason=f"{movement_type.title()} - {inventory_item['name']}",
                    performed_by=employee["user_id"],
                    movement_date=movement_date
                )
                self.session.add(movement)
                movements_created += 1
        
        print(f"   ✓ Created {movements_created} stock movements")

    async def _generate_reports(self):
        """Generate daily reports for the last 30 days"""
        print("1️⃣2️⃣ Generating Reports...")
        
        reports_created = 0
        
        for days_ago in range(30, 0, -1):
            report_date = date.today() - timedelta(days=days_ago)
            
            # Calculate metrics for this date (simplified for seed data)
            daily_orders = random.randint(15, 75)
            avg_order_value = Decimal(str(random.uniform(18.0, 45.0)))
            total_revenue = daily_orders * avg_order_value
            
            # Create daily report
            daily_report = DailyReport(
                id=str(uuid.uuid4()),
                restaurant_id=self.restaurant_id,
                report_date=report_date,
                total_revenue=total_revenue,
                total_orders=daily_orders,
                average_order_value=avg_order_value,
                cash_sales=total_revenue * Decimal("0.25"),
                card_sales=total_revenue * Decimal("0.60"),
                qr_sales=total_revenue * Decimal("0.15"),
                dine_in_orders=int(daily_orders * 0.7),
                takeaway_orders=int(daily_orders * 0.3),
                total_tax=total_revenue * Decimal("0.20"),
                total_service_charge=total_revenue * Decimal("0.125"),
                total_labor_hours=Decimal(str(random.uniform(40.0, 80.0))),
                total_labor_cost=Decimal(str(random.uniform(500.0, 1200.0))),
                employees_worked=random.randint(4, 8),
                cogs=total_revenue * Decimal("0.30"),
                waste_cost=Decimal(str(random.uniform(20.0, 80.0))),
                unique_customers=int(daily_orders * random.uniform(0.7, 0.9)),
                hourly_sales={
                    "11": float(total_revenue * Decimal("0.08")),
                    "12": float(total_revenue * Decimal("0.15")),
                    "13": float(total_revenue * Decimal("0.12")),
                    "18": float(total_revenue * Decimal("0.20")),
                    "19": float(total_revenue * Decimal("0.25")),
                    "20": float(total_revenue * Decimal("0.15")),
                    "21": float(total_revenue * Decimal("0.05"))
                },
                is_complete=True
            )
            self.session.add(daily_report)
            reports_created += 1
        
        print(f"   ✓ Generated {reports_created} daily reports")

    async def _create_restaurant_settings(self):
        """Create restaurant-specific settings"""
        print("1️⃣3️⃣ Creating Restaurant Settings...")
        
        # Create sections (tables/areas)
        sections_data = [
            {"name": "Main Dining", "description": "Main restaurant area", "capacity": 48},
            {"name": "Bar Area", "description": "Bar seating and cocktail area", "capacity": 12},
            {"name": "Patio", "description": "Outdoor seating area", "capacity": 24},
            {"name": "Private Room", "description": "Private dining room", "capacity": 16}
        ]
        
        for section_data in sections_data:
            section = Section(
                id=str(uuid.uuid4()),
                restaurant_id=self.restaurant_id,
                name=section_data["name"],
                description=section_data["description"],
                capacity=section_data["capacity"],
                is_active=True
            )
            self.session.add(section)
        
        print("   ✓ Restaurant sections created")
        print("   ✓ All restaurant settings configured")


async def main():
    """Main execution function"""
    seeder = ProductionSeeder()
    await seeder.run()


if __name__ == "__main__":
    asyncio.run(main())