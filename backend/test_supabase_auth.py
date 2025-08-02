"""
Test script for Supabase authentication integration
Run this after setting up your .env file with Supabase credentials
"""

import asyncio
import httpx
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Test data
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"


async def test_supabase_connection():
    """Test if Supabase is properly configured"""
    print("🔍 Testing Supabase configuration...")
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file")
        return False
    
    print(f"✅ Supabase URL: {SUPABASE_URL}")
    print(f"✅ Anon key found: {SUPABASE_ANON_KEY[:20]}...")
    return True


async def test_auth_verify_endpoint(access_token: str):
    """Test the /auth/verify endpoint"""
    print("\n🔍 Testing /auth/verify endpoint...")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            response = await client.post(
                f"{API_BASE_URL}/api/v1/auth/verify",
                headers=headers
            )
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"✅ Verify successful: {user_data}")
                return user_data
            else:
                print(f"❌ Verify failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error calling verify endpoint: {str(e)}")
            return None


async def test_restaurant_registration(access_token: str):
    """Test the /auth/register-restaurant endpoint"""
    print("\n🔍 Testing /auth/register-restaurant endpoint...")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        data = {
            "restaurant_name": "Test Restaurant",
            "phone": "+44 20 7946 0958",
            "address": "123 Test Street, London"
        }
        
        try:
            response = await client.post(
                f"{API_BASE_URL}/api/v1/auth/register-restaurant",
                headers=headers,
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Restaurant registration successful: {result}")
                return result
            else:
                print(f"❌ Registration failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error calling register-restaurant endpoint: {str(e)}")
            return None


async def test_protected_endpoint(access_token: str):
    """Test a protected endpoint to verify authentication works"""
    print("\n🔍 Testing protected endpoint access...")
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}"}
        
        try:
            # Try to access the restaurants endpoint
            response = await client.get(
                f"{API_BASE_URL}/api/v1/restaurants",
                headers=headers
            )
            
            if response.status_code == 200:
                print(f"✅ Protected endpoint access successful")
                return True
            else:
                print(f"❌ Protected endpoint access failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error accessing protected endpoint: {str(e)}")
            return False


async def main():
    """Run all tests"""
    print("🚀 Starting Supabase Authentication Tests\n")
    
    # Test 1: Check configuration
    if not await test_supabase_connection():
        print("\n❌ Configuration test failed. Please check your .env file.")
        return
    
    print("\n" + "="*50)
    print("⚠️  MANUAL STEPS REQUIRED:")
    print("="*50)
    print("\n1. Sign up a test user on your Supabase dashboard or via the website")
    print("2. Get the access token from Supabase Auth")
    print("3. Replace the TEST_TOKEN below with your actual token\n")
    
    # For testing, you'll need to manually get a token from Supabase
    # This would normally come from the sign-in process
    TEST_TOKEN = "YOUR_SUPABASE_ACCESS_TOKEN_HERE"
    
    if TEST_TOKEN == "YOUR_SUPABASE_ACCESS_TOKEN_HERE":
        print("❌ Please set TEST_TOKEN with a valid Supabase access token")
        return
    
    # Test 2: Verify endpoint
    user_data = await test_auth_verify_endpoint(TEST_TOKEN)
    if not user_data:
        print("\n❌ Verify endpoint test failed")
        return
    
    # Test 3: Register restaurant (only if user doesn't have one)
    if not user_data.get("user", {}).get("restaurant_id"):
        await test_restaurant_registration(TEST_TOKEN)
    else:
        print("\n✅ User already has a restaurant")
    
    # Test 4: Access protected endpoint
    await test_protected_endpoint(TEST_TOKEN)
    
    print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())