"""
Instance tracking service for monitoring active backend instances.
Tracks instances using Redis with heartbeat mechanism.
"""

import asyncio
from datetime import datetime, timezone, timedelta
import os
import socket
import secrets
import logging
from typing import Dict, List, Optional, Any
import json

from app.core.redis_client import RedisClient
from app.core.config import settings

logger = logging.getLogger(__name__)


class InstanceTracker:
    """
    Tracks active instances of the backend service.
    
    Each instance registers itself with Redis and maintains a heartbeat.
    Stale instances are automatically cleaned up based on TTL.
    """
    
    def __init__(self, redis_client: RedisClient):
        self.redis = redis_client
        self.instance_id = self._generate_instance_id()
        self.instance_key_prefix = "fynlo:instances:"
        self.instance_key = f"{self.instance_key_prefix}{self.instance_id}"
        self.heartbeat_interval = 10  # seconds
        self.ttl = 30  # seconds - instance considered dead after this
        self.heartbeat_task: Optional[asyncio.Task] = None
        self._running = False
        
    def _generate_instance_id(self) -> str:
        """Generate a unique instance ID with random suffix for security."""
        hostname = socket.gethostname()
        pod_name = os.environ.get("POD_NAME", "")
        do_app_id = os.environ.get("DO_APP_ID", "")
        
        # Generate 8-character random suffix for security
        random_suffix = secrets.token_hex(4)
        
        # Use pod name if available (Kubernetes/DigitalOcean)
        if pod_name:
            return f"{pod_name}-{random_suffix}"
        # Otherwise use app ID + hostname
        elif do_app_id and hostname:
            return f"{do_app_id}-{hostname}-{random_suffix}"
        # Fallback to just hostname
        else:
            return f"{hostname}-{random_suffix}"
    
    async def start(self):
        """Start instance tracking - register and begin heartbeat."""
        if self._running:
            logger.warning(f"Instance tracker already running for {self.instance_id}")
            return
            
        self._running = True
        logger.info(f"Starting instance tracker for {self.instance_id}")
        
        # Register instance
        await self._register_instance()
        
        # Start heartbeat loop
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
    async def stop(self):
        """Stop instance tracking and unregister."""
        if not self._running:
            return
            
        self._running = False
        logger.info(f"Stopping instance tracker for {self.instance_id}")
        
        # Cancel heartbeat task
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass
        
        # Unregister instance
        await self._unregister_instance()
    
    async def _register_instance(self):
        """Register this instance in Redis."""
        try:
            instance_data = {
                "instance_id": self.instance_id,
                "hostname": socket.gethostname(),
                "registered_at": datetime.now(timezone.utc).isoformat(),
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "pod_name": os.environ.get("POD_NAME", "not_set"),
                "node_name": os.environ.get("NODE_NAME", "not_set"),
                "deployment_id": os.environ.get("DO_DEPLOYMENT_ID", "not_set"),
                "app_version": os.environ.get("APP_VERSION", "unknown"),
                "environment": settings.ENVIRONMENT,
                "digitalocean": json.dumps({
                    "app_id": os.environ.get("DO_APP_ID", "not_set"),
                    "app_name": os.environ.get("DO_APP_NAME", "not_set"),
                    "region": os.environ.get("DO_REGION", "not_set"),
                    "component_name": os.environ.get("DO_COMPONENT_NAME", "backend")
                })
            }
            
            # Store instance data as hash
            if self.redis.redis:  # Real Redis
                await self.redis.redis.hset(self.instance_key, mapping=instance_data)
                await self.redis.redis.expire(self.instance_key, self.ttl)
            else:
                # Mock Redis fallback
                await self.redis.set(self.instance_key, instance_data, expire=self.ttl)
                
            logger.info(f"Instance {self.instance_id} registered successfully")
            
        except Exception as e:
            logger.error(f"Failed to register instance {self.instance_id}: {e}")
    
    async def _unregister_instance(self):
        """Remove this instance from Redis."""
        try:
            await self.redis.delete(self.instance_key)
            logger.info(f"Instance {self.instance_id} unregistered")
        except Exception as e:
            logger.error(f"Failed to unregister instance {self.instance_id}: {e}")
    
    async def _heartbeat_loop(self):
        """Continuously update instance heartbeat."""
        while self._running:
            try:
                # Update heartbeat timestamp
                heartbeat_data = {
                    "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                    "status": "healthy"
                }
                
                if self.redis.redis:  # Real Redis
                    await self.redis.redis.hset(self.instance_key, mapping=heartbeat_data)
                    await self.redis.redis.expire(self.instance_key, self.ttl)
                else:
                    # Mock Redis - update the stored data
                    existing = await self.redis.get(self.instance_key)
                    if existing and isinstance(existing, dict):
                        existing.update(heartbeat_data)
                        await self.redis.set(self.instance_key, existing, expire=self.ttl)
                
                logger.debug(f"Heartbeat updated for instance {self.instance_id}")
                
            except Exception as e:
                logger.error(f"Heartbeat error for instance {self.instance_id}: {e}")
            
            # Wait for next heartbeat
            await asyncio.sleep(self.heartbeat_interval)
    
    async def get_active_instances(self) -> List[Dict[str, Any]]:
        """Get all active instances from Redis."""
        instances = []
        pattern = f"{self.instance_key_prefix}*"
        
        try:
            if self.redis.redis:  # Real Redis
                # Scan for all instance keys
                async for key in self.redis.redis.scan_iter(match=pattern):
                    instance_data = await self.redis.redis.hgetall(key)
                    if instance_data:
                        # Convert bytes to strings and parse JSON fields
                        instance_info = {}
                        for k, v in instance_data.items():
                            key_str = k.decode() if isinstance(k, bytes) else k
                            val_str = v.decode() if isinstance(v, bytes) else v
                            
                            # Parse JSON fields
                            if key_str == "digitalocean":
                                try:
                                    instance_info[key_str] = json.loads(val_str)
                                except json.JSONDecodeError:
                                    instance_info[key_str] = val_str
                            else:
                                instance_info[key_str] = val_str
                        
                        instances.append(instance_info)
            else:
                # Mock Redis fallback
                logger.warning("Using mock Redis for instance tracking")
                
        except Exception as e:
            logger.error(f"Error fetching active instances: {e}")
        
        return instances
    
    async def cleanup_stale_instances(self, max_age_seconds: int = 60):
        """
        Clean up instances that haven't sent a heartbeat recently.
        
        This is a safety mechanism in case TTL doesn't work properly.
        """
        try:
            instances = await self.get_active_instances()
            current_time = datetime.now(timezone.utc)
            
            for instance in instances:
                last_heartbeat_str = instance.get('last_heartbeat')
                if last_heartbeat_str:
                    last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
                    age_seconds = (current_time - last_heartbeat).total_seconds()
                    
                    if age_seconds > max_age_seconds:
                        instance_id = instance.get('instance_id', 'unknown')
                        stale_key = f"{self.instance_key_prefix}{instance_id}"
                        await self.redis.delete(stale_key)
                        logger.warning(f"Cleaned up stale instance: {instance_id} (age: {age_seconds}s)")
                        
        except Exception as e:
            logger.error(f"Error cleaning up stale instances: {e}")
    
    async def get_instance_count(self) -> Dict[str, int]:
        """Get count of active and total instances."""
        instances = await self.get_active_instances()
        current_time = datetime.now(timezone.utc)
        
        active_count = 0
        stale_count = 0
        
        for instance in instances:
            last_heartbeat_str = instance.get('last_heartbeat')
            if last_heartbeat_str:
                last_heartbeat = datetime.fromisoformat(last_heartbeat_str)
                age_seconds = (current_time - last_heartbeat).total_seconds()
                
                if age_seconds <= 60:  # Consider active if heartbeat within 60s
                    active_count += 1
                else:
                    stale_count += 1
        
        return {
            "active": active_count,
            "stale": stale_count,
            "total": len(instances)
        }


# Global instance tracker (will be initialized in app startup)
instance_tracker: Optional[InstanceTracker] = None


async def init_instance_tracker(redis_client: RedisClient):
    """Initialize the global instance tracker."""
    global instance_tracker
    instance_tracker = InstanceTracker(redis_client)
    await instance_tracker.start()
    logger.info("Instance tracker initialized and started")


async def stop_instance_tracker():
    """Stop the global instance tracker."""
    global instance_tracker
    if instance_tracker:
        await instance_tracker.stop()
        logger.info("Instance tracker stopped")