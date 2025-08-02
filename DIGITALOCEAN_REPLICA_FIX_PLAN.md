# DigitalOcean Replica Count Issue Resolution Plan

## Issue Summary
- **Issue #356**: Backend service showing incorrect replica count
- **Current State**: Dashboard shows 6 ready replicas, but only 2 are configured/desired
- **Impact**: Visual confusion, potential resource waste (3x configured resources)
- **Priority**: Initially LOW, but escalated due to worsening (4→6 replicas)

## Root Cause Analysis

### Possible Causes
1. **Orphaned Pods**: Previous deployment pods not properly terminated
2. **Metrics Cache**: Stale metrics from old instances still reporting
3. **Rolling Update Artifacts**: Incomplete cleanup during deployments
4. **DigitalOcean Platform Bug**: Known issue with replica count display
5. **Health Check Misconfiguration**: Pods marked as ready but not actually serving

## Resolution Strategy

### Phase 1: Immediate Actions (Today)

#### 1.1 Verify Actual State
```bash
# Check actual running instances
doctl apps list-deployments $APP_ID --format ID,Phase,Progress,Created

# Get component details
doctl apps get $APP_ID --format Spec.Services

# Check current deployment
doctl apps get-deployment $APP_ID $DEPLOYMENT_ID
```

#### 1.2 Force Scale Reset
```bash
# Scale down to 0 then back to 2
doctl apps update $APP_ID --spec - <<EOF
services:
  - name: backend
    instance_count: 0
EOF

# Wait 30 seconds
sleep 30

# Scale back up
doctl apps update $APP_ID --spec - <<EOF
services:
  - name: backend
    instance_count: 2
EOF
```

### Phase 2: Add Monitoring & Visibility

#### 2.1 Enhanced Health Check Endpoint
```python
# backend/app/api/v1/endpoints/health.py
from fastapi import APIRouter, Request
from datetime import datetime
import os
import psutil
import platform

router = APIRouter()

@router.get("/health/detailed")
async def health_detailed(request: Request):
    """Detailed health check with instance information"""
    start_time = datetime.fromtimestamp(psutil.boot_time())
    current_time = datetime.now()
    uptime_seconds = (current_time - start_time).total_seconds()
    
    return {
        "status": "healthy",
        "timestamp": current_time.isoformat(),
        "instance": {
            "id": os.environ.get("HOSTNAME", "unknown"),
            "pod_name": os.environ.get("POD_NAME", "unknown"),
            "node_name": os.environ.get("NODE_NAME", "unknown"),
            "namespace": os.environ.get("POD_NAMESPACE", "default")
        },
        "environment": {
            "app_version": os.environ.get("APP_VERSION", "unknown"),
            "deployment_id": os.environ.get("DEPLOYMENT_ID", "unknown"),
            "region": os.environ.get("DO_REGION", "unknown")
        },
        "system": {
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "uptime_seconds": int(uptime_seconds),
            "cpu_count": psutil.cpu_count(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent
        },
        "connections": {
            "active_connections": len(request.app.state.connections) if hasattr(request.app.state, 'connections') else 0,
            "database_pool_size": request.app.state.db_pool.size() if hasattr(request.app.state, 'db_pool') else 0
        }
    }

@router.get("/health/instances")
async def health_instances():
    """List all known instances"""
    # This will be populated by instance registration
    return {
        "desired_replicas": int(os.environ.get("DESIRED_REPLICAS", 2)),
        "registered_instances": [],  # Will be populated by instance tracking
        "last_check": datetime.now().isoformat()
    }
```

#### 2.2 Instance Tracking Service
```python
# backend/app/services/instance_tracker.py
import asyncio
import aioredis
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

class InstanceTracker:
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.instance_id = os.environ.get("HOSTNAME", "unknown")
        self.instance_key_prefix = "fynlo:instances:"
        self.ttl = 30  # 30 seconds TTL
        
    async def connect(self):
        self.redis = await aioredis.from_url(self.redis_url)
        
    async def register_instance(self):
        """Register this instance as active"""
        key = f"{self.instance_key_prefix}{self.instance_id}"
        data = {
            "instance_id": self.instance_id,
            "registered_at": datetime.now().isoformat(),
            "pod_name": os.environ.get("POD_NAME", "unknown"),
            "deployment_id": os.environ.get("DEPLOYMENT_ID", "unknown"),
            "version": os.environ.get("APP_VERSION", "unknown")
        }
        await self.redis.hset(key, mapping=data)
        await self.redis.expire(key, self.ttl)
        
    async def heartbeat_loop(self):
        """Continuously update instance heartbeat"""
        while True:
            try:
                await self.register_instance()
                await asyncio.sleep(10)  # Update every 10 seconds
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                await asyncio.sleep(5)
                
    async def get_active_instances(self):
        """Get all active instances"""
        pattern = f"{self.instance_key_prefix}*"
        instances = []
        
        async for key in self.redis.scan_iter(match=pattern):
            data = await self.redis.hgetall(key)
            if data:
                instances.append({
                    k.decode(): v.decode() for k, v in data.items()
                })
                
        return instances
        
    async def cleanup_stale_instances(self):
        """Remove instances that haven't updated recently"""
        # Redis TTL handles this automatically
        pass
```

### Phase 3: DigitalOcean API Integration

#### 3.1 DO API Service
```python
# backend/app/services/digitalocean_monitor.py
import httpx
from typing import Dict, List
import os
import logging

logger = logging.getLogger(__name__)

class DigitalOceanMonitor:
    def __init__(self):
        self.api_token = os.environ.get("DO_API_TOKEN")
        self.app_id = os.environ.get("DO_APP_ID")
        self.base_url = "https://api.digitalocean.com/v2"
        
    async def get_app_info(self) -> Dict:
        """Get current app configuration"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/apps/{self.app_id}",
                headers={"Authorization": f"Bearer {self.api_token}"}
            )
            return response.json()
            
    async def get_deployments(self) -> List[Dict]:
        """Get deployment history"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/apps/{self.app_id}/deployments",
                headers={"Authorization": f"Bearer {self.api_token}"}
            )
            return response.json().get("deployments", [])
            
    async def get_actual_replicas(self) -> Dict:
        """Get actual replica count from DO API"""
        app_info = await self.get_app_info()
        app = app_info.get("app", {})
        
        # Find backend service
        for service in app.get("services", []):
            if service.get("name") == "backend":
                return {
                    "service_name": "backend",
                    "desired_replicas": service.get("instance_count", 0),
                    "instance_size": service.get("instance_size_slug", "unknown"),
                    "status": service.get("status", "unknown")
                }
                
        return {"error": "Backend service not found"}
        
    async def force_refresh(self):
        """Trigger a deployment to refresh metrics"""
        # Note: This should be used sparingly
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/apps/{self.app_id}/deployments",
                headers={"Authorization": f"Bearer {self.api_token}"},
                json={"force_rebuild": False}
            )
            return response.json()
```

### Phase 4: Monitoring Dashboard

#### 4.1 Monitoring Endpoint
```python
# backend/app/api/v1/endpoints/monitoring.py
from fastapi import APIRouter, Depends
from app.services.instance_tracker import InstanceTracker
from app.services.digitalocean_monitor import DigitalOceanMonitor

router = APIRouter()

@router.get("/monitoring/replicas")
async def get_replica_status(
    tracker: InstanceTracker = Depends(get_instance_tracker),
    do_monitor: DigitalOceanMonitor = Depends(get_do_monitor)
):
    """Get comprehensive replica status"""
    
    # Get active instances from Redis
    active_instances = await tracker.get_active_instances()
    
    # Get DO API data
    do_status = await do_monitor.get_actual_replicas()
    
    # Compare and analyze
    return {
        "summary": {
            "configured_replicas": do_status.get("desired_replicas", 2),
            "active_instances": len(active_instances),
            "do_api_status": do_status.get("status", "unknown"),
            "discrepancy": len(active_instances) != do_status.get("desired_replicas", 2)
        },
        "instances": active_instances,
        "digitalocean": do_status,
        "recommendations": generate_recommendations(active_instances, do_status)
    }

def generate_recommendations(instances: List[Dict], do_status: Dict) -> List[str]:
    """Generate actionable recommendations"""
    recommendations = []
    
    active_count = len(instances)
    desired_count = do_status.get("desired_replicas", 2)
    
    if active_count > desired_count:
        recommendations.append(f"WARNING: {active_count - desired_count} extra instances detected")
        recommendations.append("ACTION: Run 'doctl apps update' to force scale reset")
        
    if active_count < desired_count:
        recommendations.append(f"WARNING: {desired_count - active_count} instances missing")
        recommendations.append("ACTION: Check deployment logs for failures")
        
    # Check for stale instances
    for instance in instances:
        # Add timestamp checking logic
        pass
        
    return recommendations
```

### Phase 5: Automated Remediation

#### 5.1 Auto-Scaling Validator
```python
# backend/app/tasks/replica_validator.py
import asyncio
from app.services.digitalocean_monitor import DigitalOceanMonitor
from app.services.instance_tracker import InstanceTracker
import logging

logger = logging.getLogger(__name__)

class ReplicaValidator:
    def __init__(self, tracker: InstanceTracker, monitor: DigitalOceanMonitor):
        self.tracker = tracker
        self.monitor = monitor
        self.check_interval = 300  # 5 minutes
        
    async def validate_loop(self):
        """Continuously validate replica count"""
        while True:
            try:
                await self.validate_replicas()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Validation error: {e}")
                await asyncio.sleep(60)
                
    async def validate_replicas(self):
        """Check and report replica discrepancies"""
        active_instances = await self.tracker.get_active_instances()
        do_status = await self.monitor.get_actual_replicas()
        
        active_count = len(active_instances)
        desired_count = do_status.get("desired_replicas", 2)
        
        if active_count != desired_count:
            logger.warning(
                f"Replica count mismatch: Active={active_count}, Desired={desired_count}"
            )
            
            # Send alert (webhook, email, etc.)
            await self.send_alert({
                "type": "replica_mismatch",
                "active": active_count,
                "desired": desired_count,
                "instances": active_instances
            })
            
    async def send_alert(self, alert_data: Dict):
        """Send alert to monitoring system"""
        # Implement webhook/notification logic
        pass
```

### Phase 6: Documentation & Deployment

#### 6.1 Update Deployment Documentation
```markdown
# backend/deploy/replica_monitoring.md

## Replica Count Monitoring

### Known Issue
DigitalOcean App Platform may display incorrect replica counts in the dashboard.

### Verification Steps
1. Check actual instances: `curl https://api.fynlo.com/api/v1/monitoring/replicas`
2. Verify with DO CLI: `doctl apps get $APP_ID`
3. Monitor health endpoint: `curl https://api.fynlo.com/api/v1/health/instances`

### Troubleshooting
If replica count is incorrect:
1. Force scale reset (see Phase 1.2)
2. Check instance tracker logs
3. Verify Redis connectivity
4. Review deployment history

### Monitoring Endpoints
- `/api/v1/health/detailed` - Instance details
- `/api/v1/health/instances` - All active instances
- `/api/v1/monitoring/replicas` - Comprehensive status
```

## Implementation Timeline

1. **Day 1**: Implement health endpoints and instance tracking
2. **Day 2**: Add DigitalOcean API integration
3. **Day 3**: Create monitoring dashboard and alerts
4. **Day 4**: Test and deploy to staging
5. **Day 5**: Monitor and validate in production

## Success Metrics

1. Accurate replica count in monitoring endpoint
2. Automated alerts for discrepancies
3. Clear documentation for operators
4. No false positive alerts
5. Dashboard shows correct count (or we have accurate alternative)

## Risk Mitigation

1. **Performance Impact**: Minimal - heartbeat every 10s, checks every 5m
2. **Redis Dependency**: Fallback to local tracking if Redis unavailable
3. **API Rate Limits**: Cache DO API responses for 60 seconds
4. **False Alerts**: 2-check confirmation before alerting

## Testing Strategy

1. Unit tests for all new services
2. Integration tests with mock DO API
3. Load test with multiple instances
4. Chaos testing (kill instances, network issues)
5. Staging environment validation

## Rollback Plan

1. Feature flag for new monitoring endpoints
2. Keep existing health checks unchanged
3. Gradual rollout (10% → 50% → 100%)
4. One-click disable via environment variable