#!/usr/bin/env python3
"""
Setup default subscription plans for Fynlo POS

This script creates the default subscription plans that will be available
to restaurants when they sign up for the platform.

Run this script after running the database migration:
python backend/scripts/setup_subscription_plans.py
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.models.subscription import SubscriptionPlan
from sqlalchemy.orm import Session


# Default subscription plans for Fynlo POS
SUBSCRIPTION_PLANS = [
    {
        'name': 'alpha',
        'display_name': 'Alpha (Free)',
        'price_monthly': 0.00,
        'price_yearly': 0.00,
        'transaction_fee_percentage': 1.0,  # 1% transaction fee
        'max_orders_per_month': None,  # Unlimited
        'max_staff_accounts': None,    # Unlimited
        'max_menu_items': None,        # Unlimited
        'features': {
            'pos_system': True,
            'payment_processing': True,
            'order_history': True,
            'basic_reports': True,
            'customer_support': 'email'
        }
    },
    {
        'name': 'beta',
        'display_name': 'Beta',
        'price_monthly': 49.00,
        'price_yearly': 588.00,
        'transaction_fee_percentage': 1.0,  # 1% transaction fee
        'max_orders_per_month': None,  # Unlimited
        'max_staff_accounts': None,    # Unlimited
        'max_menu_items': None,        # Unlimited
        'features': {
            'pos_system': True,
            'payment_processing': True,
            'order_history': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'staff_management': True,
            'customer_support': 'priority'
        }
    },
    {
        'name': 'gamma',
        'display_name': 'Gamma',
        'price_monthly': 119.00,
        'price_yearly': 1428.00,
        'transaction_fee_percentage': 1.0,  # 1% transaction fee
        'max_orders_per_month': None,  # Unlimited
        'max_staff_accounts': None,    # Unlimited
        'max_menu_items': None,        # Unlimited
        'features': {
            'pos_system': True,
            'payment_processing': True,
            'order_history': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'staff_management': True,
            'multi_location': True,
            'api_access': True,
            'custom_branding': True,
            'priority_support': True,
            'customer_support': 'phone',
            'export_data': True
        }
    }
]


def create_subscription_plans():
    """Create the default subscription plans in the database"""
    
    # Get database session synchronously
    from app.core.database import SessionLocal
    db = SessionLocal()
    
    try:
        for plan_data in SUBSCRIPTION_PLANS:
            # Check if plan already exists
            existing_plan = db.query(SubscriptionPlan).filter(
                SubscriptionPlan.name == plan_data['name']
            ).first()
            
            if existing_plan:
                print(f"✅ Plan '{plan_data['name']}' already exists, skipping...")
                continue
            
            # Create new plan
            plan = SubscriptionPlan(
                name=plan_data['name'],
                display_name=plan_data['display_name'],
                price_monthly=plan_data['price_monthly'],
                price_yearly=plan_data['price_yearly'],
                transaction_fee_percentage=plan_data['transaction_fee_percentage'],
                max_orders_per_month=plan_data['max_orders_per_month'],
                max_staff_accounts=plan_data['max_staff_accounts'],
                max_menu_items=plan_data['max_menu_items'],
                features=plan_data['features'],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(plan)
            print(f"✅ Created subscription plan: {plan_data['display_name']}")
        
        # Commit all changes
        db.commit()
        print(f"\n🎉 Successfully created {len(SUBSCRIPTION_PLANS)} subscription plans!")
        
        # Display summary
        print("\n📋 Subscription Plans Summary:")
        for plan_data in SUBSCRIPTION_PLANS:
            fee_info = f" (+ {plan_data['transaction_fee_percentage']}% transaction fee)"
            if plan_data['price_monthly'] == 0:
                print(f"  • {plan_data['display_name']}: Free{fee_info}")
            else:
                print(f"  • {plan_data['display_name']}: £{plan_data['price_monthly']}/month{fee_info}")
        
    except Exception as e:
        print(f"❌ Error creating subscription plans: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Main function to run the setup script"""
    print("🚀 Setting up default subscription plans for Fynlo POS...")
    print("=" * 60)
    
    try:
        create_subscription_plans()
        print("\n✅ Subscription plans setup completed successfully!")
        print("\nNext steps:")
        print("1. Run the application to test subscription functionality")
        print("2. Configure Stripe integration for payment processing")
        print("3. Test subscription flows in the mobile app")
        
    except Exception as e:
        print(f"\n❌ Failed to setup subscription plans: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()