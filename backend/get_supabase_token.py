"""
Helper script to get a Supabase access token for testing
This simulates what the mobile app will do
"""

import asyncio
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")


async def sign_up_user(email: str, password: str):
    """Sign up a new user with Supabase"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    try:
        # Sign up
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "first_name": "Test",
                    "last_name": "User"
                }
            }
        })
        
        if response.user:
            print(f"✅ User signed up successfully: {response.user.email}")
            if response.session:
                print(f"✅ Access token: {response.session.access_token}")
                return response.session.access_token
            else:
                print("⚠️  No session returned - check if email confirmation is required")
        else:
            print("❌ Sign up failed")
            
    except Exception as e:
        print(f"❌ Error during sign up: {str(e)}")
        if "User already registered" in str(e):
            print("ℹ️  User already exists, trying to sign in...")
            return await sign_in_user(email, password)
    
    return None


async def sign_in_user(email: str, password: str):
    """Sign in an existing user with Supabase"""
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    try:
        # Sign in
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        
        if response.user:
            print(f"✅ User signed in successfully: {response.user.email}")
            if response.session:
                print(f"✅ Access token: {response.session.access_token}")
                return response.session.access_token
        else:
            print("❌ Sign in failed")
            
    except Exception as e:
        print(f"❌ Error during sign in: {str(e)}")
    
    return None


async def main():
    """Main function"""
    print("🚀 Supabase Token Helper\n")
    
    # Check configuration
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
        return
    
    print(f"✅ Using Supabase URL: {SUPABASE_URL}\n")
    
    # Get user credentials
    print("Enter test user credentials:")
    email = input("Email: ").strip()
    password = input("Password: ").strip()
    
    if not email or not password:
        print("❌ Email and password are required")
        return
    
    print("\nWhat would you like to do?")
    print("1. Sign up new user")
    print("2. Sign in existing user")
    choice = input("Choice (1 or 2): ").strip()
    
    if choice == "1":
        token = await sign_up_user(email, password)
    elif choice == "2":
        token = await sign_in_user(email, password)
    else:
        print("❌ Invalid choice")
        return
    
    if token:
        print("\n" + "="*50)
        print("🎉 SUCCESS! Use this token in test_supabase_auth.py:")
        print("="*50)
        print(f"\nTEST_TOKEN = \"{token}\"\n")
        print("="*50)
    else:
        print("\n❌ Failed to get access token")


if __name__ == "__main__":
    asyncio.run(main())