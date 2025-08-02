#!/usr/bin/env python3
"""
Master Database Seeding Script for Fynlo POS
Creates comprehensive production-like data for testing and development
"""

import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from seed_production_data import ProductionSeeder
from app.core.database import engine, SessionLocal, Base
from app.models import Restaurant, User, Product, Order, Customer
from sqlalchemy import select, text
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_existing_data():
    """Check if database already has data"""
    session = SessionLocal()
    try:
        # Check for existing restaurants
        restaurant_count = session.execute(
            select(Restaurant).limit(1)
        ).scalar_one_or_none()
        
        if restaurant_count:
            # Get data counts
            stats = {
                'restaurants': session.query(Restaurant).count(),
                'users': session.query(User).count(),
                'products': session.query(Product).count(),
                'orders': session.query(Order).count(),
                'customers': session.query(Customer).count()
            }
            return True, stats
        return False, None
    finally:
        session.close()


def clear_database():
    """Clear all data from database"""
    session = SessionLocal()
    try:
        # Disable foreign key checks for PostgreSQL
        session.execute(text("SET session_replication_role = 'replica';"))
        
        # Get all table names - whitelist for security
        ALLOWED_TABLES = {
            'payments', 'order_items', 'orders', 'customers',
            'stock_movements', 'inventory_items', 'suppliers',
            'schedules', 'employee_profiles', 'products', 'categories',
            'sections', 'restaurant_tables', 'restaurants',
            'platforms', 'users', 'daily_reports'
        }
        
        tables = [
            'payments', 'order_items', 'orders', 'customers',
            'stock_movements', 'inventory_items', 'suppliers',
            'schedules', 'employee_profiles', 'products', 'categories',
            'sections', 'restaurant_tables', 'restaurants',
            'platforms', 'users', 'daily_reports'
        ]
        
        # Clear tables in order
        for table in tables:
            # Validate table name against whitelist
            if table not in ALLOWED_TABLES:
                raise ValueError(f"Table '{table}' is not in the allowed tables list")
            try:
                # Table name validated against whitelist, safe to use
                session.execute(text(f"TRUNCATE TABLE {table} CASCADE;"))
                logger.info(f"Cleared table: {table}")
            except Exception as e:
                logger.warning(f"Could not clear {table}: {e}")
        
        # Re-enable foreign key checks
        session.execute(text("SET session_replication_role = 'origin';"))
        session.commit()
        logger.info("Database cleared successfully")
    except Exception as e:
        session.rollback()
        logger.error(f"Error clearing database: {e}")
        raise
    finally:
        session.close()


async def run_seeding(force=False):
    """Run the database seeding process"""
    logger.info("🌱 Fynlo POS Database Seeding Starting...")
    
    # Check existing data
    has_data, stats = check_existing_data()
    
    if has_data and not force:
        logger.info("⚠️  Database already contains data:")
        for table, count in stats.items():
            logger.info(f"   - {table}: {count} records")
        
        response = input("\nDo you want to clear existing data and reseed? (y/N): ")
        if response.lower() != 'y':
            logger.info("Seeding cancelled.")
            return
        
        logger.info("Clearing existing data...")
        clear_database()
    
    # Run the production seeder
    logger.info("Starting production data seeding...")
    try:
        seeder = ProductionSeeder()
        await seeder.run()
        
        # Verify seeding success
        session = SessionLocal()
        try:
            final_stats = {
                'restaurants': session.query(Restaurant).count(),
                'users': session.query(User).count(),
                'products': session.query(Product).count(),
                'orders': session.query(Order).count(),
                'customers': session.query(Customer).count()
            }
            
            logger.info("\n✅ Seeding completed successfully!")
            logger.info("📊 Final database statistics:")
            for table, count in final_stats.items():
                logger.info(f"   - {table}: {count} records")
            
            # Get restaurant details
            restaurant = session.query(Restaurant).first()
            if restaurant:
                logger.info(f"\n🏪 Restaurant: {restaurant.name}")
                logger.info(f"📧 Email: {restaurant.email}")
                logger.info(f"📱 Phone: {restaurant.phone}")
            
            logger.info("\n🔑 Login Credentials:")
            logger.info("   Platform Admin: admin@fynlo.com / FynloPlatform2025!")
            logger.info("   Restaurant Owner: carlos@casaestrella.co.uk / CasaEstrella2025!")
            logger.info("   Manager: maria@casaestrella.co.uk / Manager2025!")
            logger.info("   Staff: [firstname]@casaestrella.co.uk / [Firstname]2025!")
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"❌ Seeding failed: {e}")
        raise


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Seed Fynlo POS database with production-like data')
    parser.add_argument('--force', action='store_true', help='Force reseed even if data exists')
    parser.add_argument('--clear-only', action='store_true', help='Only clear the database')
    
    args = parser.parse_args()
    
    if args.clear_only:
        logger.info("Clearing database only...")
        clear_database()
        logger.info("✅ Database cleared successfully")
        return
    
    # Run the async seeding function
    asyncio.run(run_seeding(force=args.force))


if __name__ == "__main__":
    main()