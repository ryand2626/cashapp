#!/usr/bin/env python3
"""
Test settings loading order
"""

import os
import sys

# Set APP_ENV before importing anything
print("=== Settings Loading Test ===")
print(f"Initial APP_ENV: {os.getenv('APP_ENV')}")
print(f"Initial ENVIRONMENT: {os.getenv('ENVIRONMENT')}")

# Force development environment
os.environ["APP_ENV"] = "development"
print(f"\nSet APP_ENV to: {os.getenv('APP_ENV')}")

# Load the appropriate .env file
from dotenv import load_dotenv
env_file = f".env.{os.getenv('APP_ENV', 'development')}"
print(f"Loading env file: {env_file}")
load_dotenv(dotenv_path=env_file, override=True)

# If .env.development doesn't exist, fall back to .env
if not os.path.exists(env_file):
    print(f"{env_file} not found, loading .env")
    load_dotenv(dotenv_path=".env", override=True)

# Check what got loaded
print("\nLoaded environment variables:")
for key in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENVIRONMENT", "DATABASE_URL"]:
    value = os.getenv(key)
    if value and "KEY" not in key:
        print(f"{key}: {value[:30]}...")
    elif value:
        print(f"{key}: SET (hidden)")
    else:
        print(f"{key}: NOT SET")

# Now import settings
print("\nImporting settings...")
try:
    from app.core.config import settings
    print("✅ Settings imported successfully")
    print(f"settings.ENVIRONMENT: {settings.ENVIRONMENT}")
    print(f"settings.SUPABASE_URL: {'SET' if settings.SUPABASE_URL else 'NOT SET'}")
    print(f"settings.SUPABASE_SERVICE_ROLE_KEY: {'SET' if settings.SUPABASE_SERVICE_ROLE_KEY else 'NOT SET'}")
except Exception as e:
    print(f"❌ Failed to import settings: {e}")