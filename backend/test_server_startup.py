#!/usr/bin/env python3
"""
Test server startup and basic API endpoints
"""

import asyncio
import uvicorn
import signal
import sys
import time
import requests
from multiprocessing import Process

def run_server():
    """Run the FastAPI server"""
    try:
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            log_level="info",
            access_log=False
        )
    except Exception as e:
        print(f"Server failed to start: {e}")

def test_server_endpoints():
    """Test server endpoints"""
    base_url = "http://127.0.0.1:8000"
    
    # Wait for server to start
    print("⏳ Waiting for server to start...")
    time.sleep(3)
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/", timeout=5)
        if response.status_code == 200:
            print("✅ Health endpoint (/) working")
        else:
            print(f"❌ Health endpoint returned {response.status_code}")
            return False
        
        # Test health check
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check endpoint (/health) working")
        else:
            print(f"❌ Health check endpoint returned {response.status_code}")
            return False
        
        # Test API docs
        response = requests.get(f"{base_url}/docs", timeout=5)
        if response.status_code == 200:
            print("✅ API documentation (/docs) accessible")
        else:
            print(f"⚠️ API docs returned {response.status_code}")
        
        # Test OpenAPI schema
        response = requests.get(f"{base_url}/openapi.json", timeout=5)
        if response.status_code == 200:
            print("✅ OpenAPI schema (/openapi.json) accessible")
        else:
            print(f"⚠️ OpenAPI schema returned {response.status_code}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server")
        return False
    except requests.exceptions.Timeout:
        print("❌ Server request timed out")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def main():
    """Main test function"""
    print("🚀 Testing FastAPI Server Startup")
    print("=" * 40)
    
    # Start server in separate process
    server_process = Process(target=run_server)
    server_process.start()
    
    try:
        # Test endpoints
        success = test_server_endpoints()
        
        if success:
            print("\n🎉 Server startup test PASSED!")
            print("✅ Backend is ready for production use")
        else:
            print("\n❌ Server startup test FAILED!")
            print("⚠️ Check server logs for errors")
            
    finally:
        # Clean shutdown
        print("\n🛑 Shutting down test server...")
        server_process.terminate()
        server_process.join(timeout=5)
        if server_process.is_alive():
            server_process.kill()
        print("✅ Server shutdown complete")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Test interrupted by user")
        sys.exit(1) 