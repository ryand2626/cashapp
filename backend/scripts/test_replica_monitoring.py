#!/usr/bin/env python3
"""
Test script for replica monitoring system.
Verifies that instance tracking and monitoring endpoints are working correctly.
"""

import asyncio
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.redis_client import redis_client
from app.services.instance_tracker import InstanceTracker
from app.services.digitalocean_monitor import DigitalOceanMonitor


async def test_instance_tracking():
    """Test instance tracking functionality."""
    print("\n=== Testing Instance Tracking ===")
    
    # Initialize Redis
    await redis_client.connect()
    
    # Create instance tracker
    tracker = InstanceTracker(redis_client)
    
    print(f"Instance ID: {tracker.instance_id}")
    print(f"Starting instance tracker...")
    
    # Start tracking
    await tracker.start()
    
    # Wait a bit for registration
    await asyncio.sleep(2)
    
    # Get active instances
    instances = await tracker.get_active_instances()
    print(f"\nActive instances: {len(instances)}")
    
    for inst in instances:
        print(f"  - {inst.get('instance_id')} (last heartbeat: {inst.get('last_heartbeat')})")
    
    # Get instance count
    counts = await tracker.get_instance_count()
    print(f"\nInstance counts:")
    print(f"  Active: {counts['active']}")
    print(f"  Stale: {counts['stale']}")
    print(f"  Total: {counts['total']}")
    
    # Stop tracking
    await tracker.stop()
    
    # Close Redis
    await redis_client.disconnect()
    
    print("\n✅ Instance tracking test completed")


async def test_digitalocean_monitor():
    """Test DigitalOcean monitoring functionality."""
    print("\n=== Testing DigitalOcean Monitor ===")
    
    monitor = DigitalOceanMonitor()
    
    # Check if configured
    if not (os.environ.get("DO_API_TOKEN") and os.environ.get("DO_APP_ID")):
        print("⚠️  DO_API_TOKEN and DO_APP_ID not configured")
        print("   Set these environment variables to test DO monitoring")
        return
    
    print("Testing DigitalOcean API connection...")
    
    # Get app info
    app_info = await monitor.get_app_info()
    if "error" in app_info:
        print(f"❌ Error: {app_info['error']}")
        return
    
    print("✅ Connected to DigitalOcean API")
    
    # Get replica info
    replica_info = await monitor.get_actual_replicas()
    if "error" not in replica_info:
        print(f"\nReplica Information:")
        print(f"  Service: {replica_info['service_name']}")
        print(f"  Desired replicas: {replica_info['desired_replicas']}")
        print(f"  Instance size: {replica_info['instance_size']}")
        print(f"  Region: {replica_info['region']}")
        print(f"  Deployment phase: {replica_info['deployment']['phase']}")
    
    # Get metrics summary
    metrics = await monitor.get_metrics_summary()
    if metrics.get("configured"):
        print(f"\nApp Summary:")
        print(f"  App ID: {metrics['app']['id']}")
        print(f"  App Name: {metrics['app']['name']}")
        print(f"  Region: {metrics['app']['region']}")
        print(f"  Recent deployments: {len(metrics['recent_deployments'])}")
    
    print("\n✅ DigitalOcean monitoring test completed")


async def test_health_endpoints():
    """Test health check endpoints (requires running server)."""
    print("\n=== Testing Health Endpoints ===")
    print("Note: This test requires the backend server to be running")
    print("Start the server with: uvicorn app.main:app --reload")
    
    try:
        import httpx
        
        base_url = "http://localhost:8000"
        
        async with httpx.AsyncClient() as client:
            # Test basic health
            print("\nTesting /health endpoint...")
            response = await client.get(f"{base_url}/health")
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.json()}")
            
            # Test detailed health
            print("\nTesting /api/v1/health/detailed endpoint...")
            response = await client.get(f"{base_url}/api/v1/health/detailed")
            if response.status_code == 200:
                data = response.json()
                print(f"  Status: {data['data']['status']}")
                print(f"  Instance ID: {data['data']['instance']['id']}")
                print(f"  Uptime: {data['data']['system']['uptime_human']}")
            else:
                print(f"  Status: {response.status_code} (auth may be required)")
            
            # Test instances endpoint
            print("\nTesting /api/v1/health/instances endpoint...")
            response = await client.get(f"{base_url}/api/v1/health/instances")
            if response.status_code == 200:
                data = response.json()
                print(f"  Desired replicas: {data['data']['desired_replicas']}")
                print(f"  Active instances: {data['data']['active_instances']}")
            else:
                print(f"  Status: {response.status_code} (auth may be required)")
                
    except Exception as e:
        print(f"❌ Error testing endpoints: {e}")
        print("   Make sure the backend server is running")
        return
    
    print("\n✅ Health endpoint test completed")


async def main():
    """Run all tests."""
    print("Fynlo Replica Monitoring Test Suite")
    print("=" * 40)
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Redis URL: {settings.REDIS_URL}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test instance tracking
    await test_instance_tracking()
    
    # Test DO monitoring
    await test_digitalocean_monitor()
    
    # Test health endpoints
    await test_health_endpoints()
    
    print("\n" + "=" * 40)
    print("All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())