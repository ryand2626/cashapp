#!/usr/bin/env python3
"""
Quick test script to verify backend setup and dependencies
"""

import sys
import subprocess

def check_python_version():
    """Check Python version"""
    print(f"Python version: {sys.version}")
    if sys.version_info < (3, 11):
        print("⚠️  Warning: Python 3.11+ recommended")
    else:
        print("✅ Python version OK")

def install_dependencies():
    """Install required dependencies"""
    print("\n📦 Installing dependencies...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                      check=True, capture_output=True, text=True)
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        print(f"Error output: {e.stderr}")
        return False

def test_imports():
    """Test critical imports"""
    print("\n🔍 Testing imports...")
    
    try:
        from app.core.config import settings
        print("✅ Config loaded")
    except Exception as e:
        print(f"❌ Config failed: {e}")
        return False
    
    try:
        from app.core.database import Base
        print("✅ Database models loaded")
    except Exception as e:
        print(f"❌ Database models failed: {e}")
        return False
    
    try:
        from app.main import app
        print("✅ FastAPI app loaded")
    except Exception as e:
        print(f"❌ FastAPI app failed: {e}")
        return False
    
    return True

def test_database_connection():
    """Test database connection"""
    print("\n🗄️ Testing database connection...")
    
    try:
        import psycopg2
        from app.core.config import settings
        
        conn = psycopg2.connect(settings.DATABASE_URL)
        conn.close()
        print("✅ Database connection successful")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print("💡 Make sure PostgreSQL is running and database is created")
        return False

def test_redis_connection():
    """Test Redis connection"""
    print("\n🚀 Testing Redis connection...")
    
    try:
        import redis
        from app.core.config import settings
        
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        print("✅ Redis connection successful")
        return True
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        print("💡 Make sure Redis is running")
        return False

if __name__ == "__main__":
    print("🚀 Fynlo POS Backend Setup Test")
    print("=" * 40)
    
    check_python_version()
    
    if not install_dependencies():
        sys.exit(1)
    
    if not test_imports():
        sys.exit(1)
    
    if not test_database_connection():
        print("⚠️  Database connection failed - you may need to run setup script")
    
    if not test_redis_connection():
        print("⚠️  Redis connection failed - you may need to start Redis")
    
    print("\n🎉 Backend setup test completed!")
    print("\n📋 Next steps:")
    print("1. Ensure PostgreSQL and Redis are running")
    print("2. Run: alembic revision --autogenerate -m 'Initial migration'")
    print("3. Run: alembic upgrade head")
    print("4. Start server: uvicorn app.main:app --reload")