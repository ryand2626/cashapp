#!/usr/bin/env python3
"""
Test Authentication Flow for Fynlo POS
This script tests the complete authentication flow to identify issues
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_URL = "http://localhost:8000/api/v1"
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://eweggzpvuqczrrrwszyy.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Test credentials
TEST_EMAIL = "test@example.com"  # Replace with your test email
TEST_PASSWORD = "testpassword123"  # Replace with your test password


async def test_supabase_direct():
    """Test direct Supabase authentication"""
    print("\n🔍 Testing Direct Supabase Authentication...")
    
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, headers=headers, json=data) as response:
                result = await response.json()
                
                if response.status == 200:
                    print("✅ Supabase authentication successful!")
                    print(f"   Access Token: {result.get('access_token', '')[:50]}...")
                    return result.get('access_token')
                else:
                    print(f"❌ Supabase authentication failed: {response.status}")
                    print(f"   Error: {result}")
                    return None
                    
        except Exception as e:
            print(f"❌ Supabase connection error: {str(e)}")
            return None


async def test_backend_verify(access_token):
    """Test backend verification endpoint"""
    print("\n🔍 Testing Backend Verification...")
    
    if not access_token:
        print("⚠️  No access token available")
        return None
    
    url = f"{API_URL}/auth/verify"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, headers=headers) as response:
                result = await response.json()
                
                if response.status == 200:
                    print("✅ Backend verification successful!")
                    print(f"   User: {json.dumps(result.get('user', {}), indent=2)}")
                    return result
                else:
                    print(f"❌ Backend verification failed: {response.status}")
                    print(f"   Error: {result}")
                    return None
                    
        except Exception as e:
            print(f"❌ Backend connection error: {str(e)}")
            return None


async def test_websocket_connection(access_token, user_id, restaurant_id):
    """Test WebSocket connection"""
    print("\n🔍 Testing WebSocket Connection...")
    
    if not access_token or not user_id:
        print("⚠️  Missing credentials for WebSocket test")
        return
    
    ws_url = f"ws://localhost:8000/api/v1/ws/{restaurant_id}?user_id={user_id}&token={access_token}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(ws_url) as ws:
                print("✅ WebSocket connected successfully!")
                
                # Send ping
                await ws.send_json({"type": "ping"})
                
                # Wait for pong
                msg = await ws.receive()
                if msg.type == aiohttp.WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    if data.get("type") == "pong":
                        print("✅ WebSocket ping/pong successful!")
                    else:
                        print(f"⚠️  Unexpected response: {data}")
                
                await ws.close()
                
    except Exception as e:
        print(f"❌ WebSocket connection error: {str(e)}")


async def test_full_flow():
    """Test the complete authentication flow"""
    print("=" * 60)
    print("🚀 Fynlo POS Authentication Flow Test")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"API URL: {API_URL}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Test Email: {TEST_EMAIL}")
    
    # Step 1: Test Supabase authentication
    access_token = await test_supabase_direct()
    
    if not access_token:
        print("\n❌ Authentication flow failed at Supabase login")
        print("\nPossible issues:")
        print("1. Invalid credentials")
        print("2. User doesn't exist in Supabase")
        print("3. Supabase service is down")
        print("4. Network connectivity issues")
        return
    
    # Step 2: Test backend verification
    user_data = await test_backend_verify(access_token)
    
    if not user_data:
        print("\n❌ Authentication flow failed at backend verification")
        print("\nPossible issues:")
        print("1. Backend is not running")
        print("2. Supabase admin client not initialized")
        print("3. User not created in backend database")
        print("4. Backend configuration issues")
        return
    
    # Step 3: Test WebSocket connection
    user = user_data.get("user", {})
    user_id = user.get("id")
    restaurant_id = user.get("restaurant_id", "test-restaurant")
    
    if user_id and restaurant_id:
        await test_websocket_connection(access_token, user_id, restaurant_id)
    
    print("\n✅ Authentication flow completed successfully!")
    print("\nSummary:")
    print(f"- User ID: {user_id}")
    print(f"- Email: {user.get('email')}")
    print(f"- Role: {user.get('role')}")
    print(f"- Restaurant ID: {restaurant_id}")
    print(f"- Subscription: {user.get('subscription_plan', 'N/A')}")


async def test_backend_health():
    """Test if backend is running"""
    print("\n🔍 Testing Backend Health...")
    
    url = f"{API_URL}/health"
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    print("✅ Backend is healthy!")
                else:
                    print(f"⚠️  Backend returned status: {response.status}")
                    
        except aiohttp.ClientConnectorError:
            print("❌ Cannot connect to backend - is it running?")
            print("   Run: cd backend && uvicorn app.main:app --reload")
            return False
        except Exception as e:
            print(f"❌ Backend health check error: {str(e)}")
            return False
    
    return True


async def main():
    """Main test runner"""
    global TEST_EMAIL, TEST_PASSWORD
    
    # First check if backend is running
    if not await test_backend_health():
        print("\n⚠️  Please start the backend first!")
        sys.exit(1)
    
    # Get test credentials from user
    print("\n📝 Enter test credentials (or press Enter to use defaults)")
    email = input(f"Email [{TEST_EMAIL}]: ").strip() or TEST_EMAIL
    password = input(f"Password: ").strip() or TEST_PASSWORD
    
    # Update globals
    TEST_EMAIL = email
    TEST_PASSWORD = password
    
    # Run the full test flow
    await test_full_flow()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()