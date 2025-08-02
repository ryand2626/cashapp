"""
Bidirectional Sync Service
Handles data synchronization between platform dashboard and restaurant mobile apps
"""
from typing import Dict, List, Optional, Any, TYPE_CHECKING
from datetime import datetime, timedelta
import asyncio
import json
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from redis import Redis

from app.core.database import get_db
from app.core.redis_client import redis_client as global_redis_client
from app.models import Restaurant, Product, Category, Order, User
from app.core.exceptions import FynloException
import logging

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.api.v1.endpoints.websocket_enhanced import EnhancedWebSocketManager

class SyncService:
    """
    Manages bidirectional data synchronization between platform and restaurants
    """
    
    def __init__(self):
        self.redis_client: Optional[Redis] = None
        self.ws_manager: Optional['EnhancedWebSocketManager'] = None
        self._sync_queue: asyncio.Queue = asyncio.Queue()
        self._processing = False
        
    async def initialize(self, ws_manager: 'EnhancedWebSocketManager'):
        """Initialize sync service with dependencies"""
        self.redis_client = global_redis_client
        self.ws_manager = ws_manager
        self._processing = True
        
        # Start background sync processor
        asyncio.create_task(self._process_sync_queue())
        
    async def shutdown(self):
        """Gracefully shutdown sync service"""
        self._processing = False
        
    async def sync_restaurant_update(
        self, 
        restaurant_id: str, 
        update_type: str,
        data: Dict[str, Any],
        source: str,  # 'platform' or 'mobile'
        db: Session
    ):
        """
        Sync restaurant updates between platform and mobile
        """
        try:
            # Add to sync queue
            sync_event = {
                'id': f"sync_{datetime.utcnow().timestamp()}",
                'restaurant_id': restaurant_id,
                'type': update_type,
                'data': data,
                'source': source,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            await self._sync_queue.put(sync_event)
            
            # Cache the update for conflict resolution
            cache_key = f"sync:restaurant:{restaurant_id}:{update_type}"
            await self.redis_client.set(
                cache_key,
                json.dumps(sync_event),
                expire=300  # 5 minute TTL
            )
            
            logger.info(f"Queued sync event: {update_type} for restaurant {restaurant_id}")
            
        except Exception as e:
            logger.error(f"Error queuing sync event: {str(e)}")
            raise FynloException(f"Sync failed: {str(e)}", status_error_code=500)
    
    async def _process_sync_queue(self):
        """Background task to process sync events"""
        while self._processing:
            try:
                # Get sync event from queue
                sync_event = await asyncio.wait_for(
                    self._sync_queue.get(), 
                    timeout=1.0
                )
                
                await self._handle_sync_event(sync_event)
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing sync queue: {str(e)}")
                
    async def _handle_sync_event(self, event: Dict[str, Any]):
        """Process individual sync event"""
        try:
            restaurant_id = event['restaurant_id']
            event_type = event['type']
            source = event['source']
            
            # Determine targets based on source
            if source == 'platform':
                # Sync to mobile apps
                await self._sync_to_mobile(restaurant_id, event)
            elif source == 'mobile':
                # Sync to platform dashboard  
                await self._sync_to_platform(restaurant_id, event)
            else:
                # Sync to both
                await self._sync_to_mobile(restaurant_id, event)
                await self._sync_to_platform(restaurant_id, event)
                
            logger.info(f"Processed sync event: {event_type} for restaurant {restaurant_id}")
            
        except Exception as e:
            logger.error(f"Error handling sync event: {str(e)}")
            
    async def _sync_to_mobile(self, restaurant_id: str, event: Dict[str, Any]):
        """Send sync event to mobile apps"""
        if not self.ws_manager:
            return
            
        # Get connected mobile clients for restaurant
        connections = self.ws_manager.get_restaurant_connections(restaurant_id)
        mobile_connections = [
            conn for conn in connections 
            if conn.client_type == 'mobile_pos'
        ]
        
        if mobile_connections:
            message = {
                'type': f"sync.{event['type']}",
                'data': event['data'],
                'source': 'platform',
                'timestamp': event['timestamp']
            }
            
            # Broadcast to all mobile clients
            for connection in mobile_connections:
                await self.ws_manager.send_to_connection(
                    connection.id,
                    message
                )
                
    async def _sync_to_platform(self, restaurant_id: str, event: Dict[str, Any]):
        """Send sync event to platform dashboard"""
        if not self.ws_manager:
            return
            
        # Get platform connections
        platform_connections = self.ws_manager.get_platform_connections()
        
        if platform_connections:
            message = {
                'type': f"sync.{event['type']}",
                'data': event['data'],
                'restaurant_id': restaurant_id,
                'source': 'mobile',
                'timestamp': event['timestamp']
            }
            
            # Broadcast to all platform dashboards
            for connection in platform_connections:
                await self.ws_manager.send_to_connection(
                    connection.id,
                    message
                )
    
    async def sync_menu_changes(
        self,
        restaurant_id: str,
        products: List[Dict[str, Any]],
        categories: List[Dict[str, Any]],
        source: str,
        db: Session
    ):
        """Sync menu changes between platform and mobile"""
        sync_data = {
            'products': products,
            'categories': categories,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        await self.sync_restaurant_update(
            restaurant_id=restaurant_id,
            update_type='menu_update',
            data=sync_data,
            source=source,
            db=db
        )
        
    async def sync_order_update(
        self,
        restaurant_id: str,
        order: Dict[str, Any],
        source: str,
        db: Session
    ):
        """Sync order updates in real-time"""
        await self.sync_restaurant_update(
            restaurant_id=restaurant_id,
            update_type='order_update', 
            data=order,
            source=source,
            db=db
        )
        
    async def sync_settings_change(
        self,
        restaurant_id: str,
        settings: Dict[str, Any],
        source: str,
        db: Session
    ):
        """Sync restaurant settings changes"""
        # Filter out platform-controlled settings
        allowed_settings = {
            k: v for k, v in settings.items()
            if k not in ['service_charge', 'payment_methods', 'commission_rate']
        }
        
        if allowed_settings:
            await self.sync_restaurant_update(
                restaurant_id=restaurant_id,
                update_type='settings_update',
                data=allowed_settings,
                source=source,
                db=db
            )
    
    async def handle_sync_conflict(
        self,
        restaurant_id: str,
        conflict_type: str,
        platform_data: Dict[str, Any],
        mobile_data: Dict[str, Any],
        db: Session
    ) -> Dict[str, Any]:
        """
        Handle sync conflicts between platform and mobile
        Default strategy: Last write wins with notification
        """
        platform_timestamp = platform_data.get('updated_at', '')
        mobile_timestamp = mobile_data.get('updated_at', '')
        
        # Compare timestamps
        if platform_timestamp > mobile_timestamp:
            winner = 'platform'
            resolved_data = platform_data
        else:
            winner = 'mobile' 
            resolved_data = mobile_data
            
        # Log conflict resolution
        logger.warning(
            f"Sync conflict resolved for restaurant {restaurant_id}: "
            f"{conflict_type} - {winner} data wins"
        )
        
        # Notify both sides of conflict resolution
        conflict_message = {
            'type': 'sync.conflict_resolved',
            'data': {
                'conflict_type': conflict_type,
                'winner': winner,
                'resolved_data': resolved_data
            },
            'restaurant_id': restaurant_id,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Send to both platform and mobile
        await self._sync_to_mobile(restaurant_id, conflict_message)
        await self._sync_to_platform(restaurant_id, conflict_message)
        
        return resolved_data
    
    async def get_sync_status(
        self, 
        restaurant_id: str
    ) -> Dict[str, Any]:
        """Get current sync status for a restaurant"""
        try:
            # Check pending sync events
            pending_count = self._sync_queue.qsize()
            
            # Check last sync times from cache
            menu_sync_key = f"sync:restaurant:{restaurant_id}:menu_update"
            order_sync_key = f"sync:restaurant:{restaurant_id}:order_update" 
            settings_sync_key = f"sync:restaurant:{restaurant_id}:settings_update"
            
            last_menu_sync = await self.redis_client.get(menu_sync_key)
            last_order_sync = await self.redis_client.get(order_sync_key)
            last_settings_sync = await self.redis_client.get(settings_sync_key)
            
            return {
                'restaurant_id': restaurant_id,
                'pending_syncs': pending_count,
                'last_sync_times': {
                    'menu': last_menu_sync.get('timestamp') if last_menu_sync else None,
                    'orders': last_order_sync.get('timestamp') if last_order_sync else None,
                    'settings': last_settings_sync.get('timestamp') if last_settings_sync else None
                },
                'sync_healthy': pending_count < 100  # Threshold for healthy sync
            }
            
        except Exception as e:
            logger.error(f"Error getting sync status: {str(e)}")
            return {
                'restaurant_id': restaurant_id,
                'error': str(e),
                'sync_healthy': False
            }

# Global sync service instance
sync_service = SyncService()

async def get_sync_service() -> SyncService:
    """Get sync service instance"""
    return sync_service