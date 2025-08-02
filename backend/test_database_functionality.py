#!/usr/bin/env python3
"""
Database Functionality Test Suite for Fynlo POS
Tests all database operations and API endpoints after setup
"""

import asyncio
import sys
import json
from pathlib import Path
from datetime import datetime, timedelta

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from app.core.database import SessionLocal, User, Restaurant, Platform, Product, Order, Category
from app.core.config import settings
from app.api.v1.endpoints.auth import authenticate_user, create_access_token
from sqlalchemy.exc import IntegrityError
import uuid

class DatabaseTester:
    def __init__(self):
        self.db = SessionLocal()
        self.test_results = []
    
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "data": data
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if data and isinstance(data, dict):
            print(f"    Data: {json.dumps(data, indent=2, default=str)}")
    
    def test_connection(self):
        """Test basic database connection"""
        try:
            result = self.db.execute("SELECT 1 as test").fetchone()
            self.log_test("Database Connection", True, f"Connection successful: {result[0]}")
            return True
        except Exception as e:
            self.log_test("Database Connection", False, f"Connection failed: {e}")
            return False
    
    def test_user_operations(self):
        """Test user CRUD operations"""
        try:
            # Test user creation
            test_user = User(
                email=f"test_{uuid.uuid4().hex[:8]}@example.com",
                username=f"testuser_{uuid.uuid4().hex[:8]}",
                password_hash="test_hash",
                first_name="Test",
                last_name="User",
                role="employee"
            )
            self.db.add(test_user)
            self.db.commit()
            self.db.refresh(test_user)
            
            self.log_test("User Creation", True, f"Created user with ID: {test_user.id}")
            
            # Test user query
            found_user = self.db.query(User).filter(User.id == test_user.id).first()
            if found_user and found_user.email == test_user.email:
                self.log_test("User Query", True, f"Successfully queried user: {found_user.email}")
            else:
                self.log_test("User Query", False, "Failed to find created user")
            
            # Test user update
            found_user.first_name = "Updated"
            self.db.commit()
            self.db.refresh(found_user)
            
            if found_user.first_name == "Updated":
                self.log_test("User Update", True, "Successfully updated user")
            else:
                self.log_test("User Update", False, "Failed to update user")
            
            # Cleanup
            self.db.delete(found_user)
            self.db.commit()
            self.log_test("User Deletion", True, "Successfully deleted test user")
            
            return True
        except Exception as e:
            self.log_test("User Operations", False, f"User operations failed: {e}")
            return False
    
    def test_authentication_system(self):
        """Test the authentication system"""
        try:
            # Find an existing user to test with
            user = self.db.query(User).filter(User.email == "admin@fynlo.com").first()
            if not user:
                self.log_test("Authentication Test", False, "No test user found")
                return False
            
            # Test authentication function
            authenticated_user = authenticate_user(self.db, "admin@fynlo.com", "admin123")
            if authenticated_user and authenticated_user.id == user.id:
                self.log_test("User Authentication", True, f"Successfully authenticated: {user.email}")
            else:
                self.log_test("User Authentication", False, "Authentication failed")
                return False
            
            # Test token creation
            token = create_access_token(data={"sub": str(user.id)})
            if token and len(token) > 50:  # JWT tokens are typically much longer
                self.log_test("Token Creation", True, f"Token created (length: {len(token)})")
            else:
                self.log_test("Token Creation", False, "Token creation failed")
                return False
            
            return True
        except Exception as e:
            self.log_test("Authentication System", False, f"Authentication test failed: {e}")
            return False
    
    def test_restaurant_platform_relationship(self):
        """Test platform and restaurant relationships"""
        try:
            # Get platform and restaurant
            platform = self.db.query(Platform).first()
            restaurant = self.db.query(Restaurant).filter(Restaurant.platform_id == platform.id).first()
            
            if platform and restaurant:
                self.log_test("Platform-Restaurant Relationship", True, 
                            f"Platform '{platform.name}' has restaurant '{restaurant.name}'")
            else:
                self.log_test("Platform-Restaurant Relationship", False, "Missing platform or restaurant")
                return False
            
            # Test user-restaurant relationship
            user = self.db.query(User).filter(User.restaurant_id == restaurant.id).first()
            if user:
                self.log_test("User-Restaurant Relationship", True,
                            f"User '{user.email}' belongs to restaurant '{restaurant.name}'")
            else:
                self.log_test("User-Restaurant Relationship", False, "No users found for restaurant")
            
            return True
        except Exception as e:
            self.log_test("Relationship Test", False, f"Relationship test failed: {e}")
            return False
    
    def test_product_management(self):
        """Test product creation and management"""
        try:
            # Get a restaurant for the product
            restaurant = self.db.query(Restaurant).first()
            if not restaurant:
                self.log_test("Product Test", False, "No restaurant found for product test")
                return False
            
            # Create a test category
            test_category = Category(
                restaurant_id=restaurant.id,
                name="Test Category",
                description="Test category for database testing",
                color="#FF5722",
                sort_order=1
            )
            self.db.add(test_category)
            self.db.commit()
            self.db.refresh(test_category)
            
            # Create a test product
            test_product = Product(
                restaurant_id=restaurant.id,
                category_id=test_category.id,
                name="Test Product",
                description="Test product for database testing",
                price=9.99,
                cost=5.00,
                prep_time=10,
                dietary_info=["vegetarian"],
                modifiers=[
                    {"name": "Size", "options": ["Small", "Medium", "Large"], "required": True},
                    {"name": "Extra Cheese", "price": 1.50, "required": False}
                ]
            )
            self.db.add(test_product)
            self.db.commit()
            self.db.refresh(test_product)
            
            self.log_test("Product Creation", True, 
                        f"Created product '{test_product.name}' in category '{test_category.name}'",
                        {"product_id": str(test_product.id), "price": test_product.price})
            
            # Test product query
            found_product = self.db.query(Product).filter(Product.id == test_product.id).first()
            if found_product and len(found_product.modifiers) == 2:
                self.log_test("Product Query with Modifiers", True, 
                            f"Product has {len(found_product.modifiers)} modifiers")
            else:
                self.log_test("Product Query with Modifiers", False, "Product modifiers not stored correctly")
            
            # Cleanup
            self.db.delete(test_product)
            self.db.delete(test_category)
            self.db.commit()
            
            return True
        except Exception as e:
            self.log_test("Product Management", False, f"Product test failed: {e}")
            return False
    
    def test_order_management(self):
        """Test order creation and management"""
        try:
            # Get required objects
            restaurant = self.db.query(Restaurant).first()
            user = self.db.query(User).filter(User.restaurant_id == restaurant.id).first()
            
            if not (restaurant and user):
                self.log_test("Order Test", False, "Missing restaurant or user for order test")
                return False
            
            # Create test order
            test_order = Order(
                restaurant_id=restaurant.id,
                order_number=f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                table_number="Test Table 1",
                order_type="dine_in",
                status="pending",
                items=[
                    {
                        "product_id": str(uuid.uuid4()),
                        "name": "Test Burger",
                        "quantity": 2,
                        "unit_price": 12.99,
                        "total_price": 25.98,
                        "modifiers": [{"name": "No Onions", "price": 0}]
                    },
                    {
                        "product_id": str(uuid.uuid4()),
                        "name": "Test Fries",
                        "quantity": 1,
                        "unit_price": 4.99,
                        "total_price": 4.99
                    }
                ],
                subtotal=30.97,
                tax_amount=6.19,
                service_charge=3.87,
                total_amount=40.03,
                payment_status="pending",
                special_instructions="Test order - please ignore",
                created_by=user.id
            )
            
            self.db.add(test_order)
            self.db.commit()
            self.db.refresh(test_order)
            
            self.log_test("Order Creation", True, 
                        f"Created order '{test_order.order_number}' with {len(test_order.items)} items",
                        {"order_id": str(test_order.id), "total": test_order.total_amount})
            
            # Test order status update
            test_order.status = "confirmed"
            test_order.updated_at = datetime.utcnow()
            self.db.commit()
            
            updated_order = self.db.query(Order).filter(Order.id == test_order.id).first()
            if updated_order.status == "confirmed":
                self.log_test("Order Status Update", True, f"Order status updated to '{updated_order.status}'")
            else:
                self.log_test("Order Status Update", False, "Order status update failed")
            
            # Cleanup
            self.db.delete(test_order)
            self.db.commit()
            
            return True
        except Exception as e:
            self.log_test("Order Management", False, f"Order test failed: {e}")
            return False
    
    def test_json_fields(self):
        """Test JSONB field storage and retrieval"""
        try:
            restaurant = self.db.query(Restaurant).first()
            if not restaurant:
                self.log_test("JSON Fields Test", False, "No restaurant found")
                return False
            
            # Test complex JSON data
            complex_settings = {
                "pos_settings": {
                    "auto_print_receipt": True,
                    "receipt_printer": "EPSON_TM_T88",
                    "kitchen_display": {
                        "enabled": True,
                        "auto_accept_orders": False,
                        "show_prep_time": True
                    }
                },
                "ui_customization": {
                    "theme": "dark",
                    "primary_color": "#00A651",
                    "button_size": "large"
                },
                "integrations": {
                    "accounting": "quickbooks",
                    "inventory": "custom",
                    "loyalty": "fynlo_rewards"
                }
            }
            
            # Update restaurant settings
            restaurant.settings = complex_settings
            self.db.commit()
            self.db.refresh(restaurant)
            
            # Verify JSON storage
            if (restaurant.settings and 
                restaurant.settings.get("pos_settings", {}).get("auto_print_receipt") is True and
                restaurant.settings.get("ui_customization", {}).get("theme") == "dark"):
                self.log_test("JSON Field Storage", True, "Complex JSON data stored and retrieved correctly")
            else:
                self.log_test("JSON Field Storage", False, "JSON data not stored correctly")
                return False
            
            return True
        except Exception as e:
            self.log_test("JSON Fields", False, f"JSON test failed: {e}")
            return False
    
    def run_all_tests(self):
        """Run all database tests"""
        print("🧪 Starting Database Functionality Tests")
        print("=" * 50)
        
        tests = [
            self.test_connection,
            self.test_user_operations,
            self.test_authentication_system,
            self.test_restaurant_platform_relationship,
            self.test_product_management,
            self.test_order_management,
            self.test_json_fields
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL: {test.__name__} - Exception: {e}")
                failed += 1
            print()  # Add space between tests
        
        # Summary
        total = passed + failed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("📊 Test Results Summary")
        print("=" * 30)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if failed == 0:
            print("\n🎉 All database tests passed! Database is fully functional.")
        else:
            print(f"\n⚠️ {failed} test(s) failed. Please review the issues above.")
        
        return failed == 0
    
    def __del__(self):
        """Clean up database connection"""
        if hasattr(self, 'db'):
            self.db.close()

def main():
    """Main test runner"""
    tester = DatabaseTester()
    success = tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)