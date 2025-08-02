"""
Mobile ID Mapping System for Fynlo POS
Provides collision-resistant UUID to integer conversion for mobile compatibility
"""

import hashlib
import uuid
from typing import Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import Table, Column, String, Integer, DateTime, func, create_engine, PrimaryKeyConstraint
from sqlalchemy.ext.declarative import declarative_base
from app.core.database import Base, engine
from app.core.redis_client import RedisClient
import logging

logger = logging.getLogger(__name__)

class MobileIDMapping(Base):
    """
    Database table to store UUID to mobile integer ID mappings
    Ensures consistent ID conversion without collisions
    """
    __tablename__ = "mobile_id_mappings"
    
    uuid_id = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)  # 'product', 'category', 'order', etc.
    mobile_id = Column(Integer, unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Composite primary key allows same UUID for different entity types
    __table_args__ = (
        PrimaryKeyConstraint('uuid_id', 'entity_type'),
    )

class MobileIDService:
    """
    Service for converting UUIDs to mobile-friendly integer IDs
    Uses hash-based approach with collision detection and database persistence
    """
    
    # Maximum mobile ID value (9 digits for mobile compatibility)
    MAX_MOBILE_ID = 999999999
    MIN_MOBILE_ID = 100000000
    
    def __init__(self, db: Session, redis: Optional[RedisClient] = None):
        self.db = db
        self.redis = redis
        self._cache = {}  # In-memory cache for frequently accessed mappings
    
    def uuid_to_mobile_id(self, uuid_str: str, entity_type: str = "product") -> int:
        """
        Convert UUID to collision-resistant mobile integer ID
        
        Args:
            uuid_str: UUID string to convert
            entity_type: Type of entity (product, category, order, etc.)
            
        Returns:
            Integer ID safe for mobile use
            
        Raises:
            ValueError: If unable to generate non-colliding ID
        """
        try:
            # Check cache first
            cache_key = f"{entity_type}:{uuid_str}"
            if cache_key in self._cache:
                return self._cache[cache_key]
            
            # Check Redis cache
            if self.redis:
                cached_id = self.redis.get(f"mobile_id:{cache_key}")
                if cached_id:
                    mobile_id = int(cached_id)
                    self._cache[cache_key] = mobile_id
                    return mobile_id
            
            # Check database
            existing_mapping = self.db.query(MobileIDMapping).filter(
                MobileIDMapping.uuid_id == uuid_str,
                MobileIDMapping.entity_type == entity_type
            ).first()
            
            if existing_mapping:
                mobile_id = existing_mapping.mobile_id
                self._cache[cache_key] = mobile_id
                if self.redis:
                    self.redis.set(f"mobile_id:{cache_key}", str(mobile_id), expire=3600)
                return mobile_id
            
            # Generate new mobile ID
            mobile_id = self._generate_mobile_id(uuid_str, entity_type)
            
            # Store in database
            new_mapping = MobileIDMapping(
                uuid_id=uuid_str,
                mobile_id=mobile_id,
                entity_type=entity_type
            )
            self.db.add(new_mapping)
            self.db.commit()
            
            # Cache the result
            self._cache[cache_key] = mobile_id
            if self.redis:
                self.redis.set(f"mobile_id:{cache_key}", str(mobile_id), expire=3600)
            
            logger.info(f"Generated mobile ID {mobile_id} for UUID {uuid_str} ({entity_type})")
            return mobile_id
            
        except Exception as e:
            logger.error(f"Failed to convert UUID {uuid_str} to mobile ID: {str(e)}")
            raise ValueError(f"Unable to generate mobile ID: {str(e)}")
    
    def mobile_id_to_uuid(self, mobile_id: int, entity_type: str = "product") -> Optional[str]:
        """
        Convert mobile integer ID back to UUID
        
        Args:
            mobile_id: Mobile integer ID
            entity_type: Type of entity
            
        Returns:
            UUID string or None if not found
        """
        try:
            # Check cache first
            cache_key = f"reverse:{entity_type}:{mobile_id}"
            if cache_key in self._cache:
                return self._cache[cache_key]
            
            # Check Redis cache
            if self.redis:
                cached_uuid = self.redis.get(f"uuid_id:{cache_key}")
                if cached_uuid:
                    self._cache[cache_key] = cached_uuid
                    return cached_uuid
            
            # Check database
            mapping = self.db.query(MobileIDMapping).filter(
                MobileIDMapping.mobile_id == mobile_id,
                MobileIDMapping.entity_type == entity_type
            ).first()
            
            if mapping:
                uuid_str = mapping.uuid_id
                self._cache[cache_key] = uuid_str
                if self.redis:
                    self.redis.set(f"uuid_id:{cache_key}", uuid_str, expire=3600)
                return uuid_str
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to convert mobile ID {mobile_id} to UUID: {str(e)}")
            return None
    
    def _generate_mobile_id(self, uuid_str: str, entity_type: str) -> int:
        """
        Generate collision-resistant mobile ID using hash-based approach
        
        Args:
            uuid_str: UUID string
            entity_type: Entity type for additional entropy
            
        Returns:
            Collision-resistant integer ID
            
        Raises:
            ValueError: If unable to generate non-colliding ID after max attempts
        """
        MAX_ATTEMPTS = 1000
        
        for attempt in range(MAX_ATTEMPTS):
            # Create hash input with entity type and attempt number for uniqueness
            hash_input = f"{entity_type}:{uuid_str}:{attempt}".encode('utf-8')
            
            # Use SHA-256 for good distribution
            hash_digest = hashlib.sha256(hash_input).hexdigest()
            
            # Take first 8 hex characters and convert to int
            hex_segment = hash_digest[:8]
            hash_int = int(hex_segment, 16)
            
            # Ensure it's within our mobile ID range
            mobile_id = (hash_int % (self.MAX_MOBILE_ID - self.MIN_MOBILE_ID)) + self.MIN_MOBILE_ID
            
            # Check for collision in database
            existing = self.db.query(MobileIDMapping).filter(
                MobileIDMapping.mobile_id == mobile_id,
                MobileIDMapping.entity_type == entity_type
            ).first()
            
            if not existing:
                return mobile_id
        
        raise ValueError(f"Unable to generate non-colliding mobile ID after {MAX_ATTEMPTS} attempts")
    
    def get_batch_mappings(self, uuid_list: list, entity_type: str = "product") -> Dict[str, int]:
        """
        Get mobile IDs for a batch of UUIDs (optimized for bulk operations)
        
        Args:
            uuid_list: List of UUID strings
            entity_type: Entity type
            
        Returns:
            Dictionary mapping UUID to mobile ID
        """
        try:
            result = {}
            uncached_uuids = []
            
            # Check cache for existing mappings
            for uuid_str in uuid_list:
                cache_key = f"{entity_type}:{uuid_str}"
                if cache_key in self._cache:
                    result[uuid_str] = self._cache[cache_key]
                else:
                    uncached_uuids.append(uuid_str)
            
            if not uncached_uuids:
                return result
            
            # Batch fetch from database
            existing_mappings = self.db.query(MobileIDMapping).filter(
                MobileIDMapping.uuid_id.in_(uncached_uuids),
                MobileIDMapping.entity_type == entity_type
            ).all()
            
            # Process existing mappings
            found_uuids = set()
            for mapping in existing_mappings:
                result[mapping.uuid_id] = mapping.mobile_id
                cache_key = f"{entity_type}:{mapping.uuid_id}"
                self._cache[cache_key] = mapping.mobile_id
                found_uuids.add(mapping.uuid_id)
            
            # Generate new mappings for missing UUIDs
            missing_uuids = [u for u in uncached_uuids if u not in found_uuids]
            
            if missing_uuids:
                new_mappings = []
                for uuid_str in missing_uuids:
                    mobile_id = self._generate_mobile_id(uuid_str, entity_type)
                    result[uuid_str] = mobile_id
                    
                    new_mappings.append(MobileIDMapping(
                        uuid_id=uuid_str,
                        mobile_id=mobile_id,
                        entity_type=entity_type
                    ))
                    
                    cache_key = f"{entity_type}:{uuid_str}"
                    self._cache[cache_key] = mobile_id
                
                # Batch insert new mappings
                if new_mappings:
                    self.db.add_all(new_mappings)
                    self.db.commit()
                    logger.info(f"Generated {len(new_mappings)} new mobile ID mappings")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get batch mobile ID mappings: {str(e)}")
            raise ValueError(f"Batch mapping failed: {str(e)}")
    
    def clear_cache(self):
        """Clear in-memory cache"""
        self._cache.clear()
        logger.info("Mobile ID mapping cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about mobile ID mappings"""
        try:
            total_mappings = self.db.query(MobileIDMapping).count()
            
            entity_counts = {}
            entity_results = self.db.query(
                MobileIDMapping.entity_type,
                func.count(MobileIDMapping.entity_type)
            ).group_by(MobileIDMapping.entity_type).all()
            
            for entity_type, count in entity_results:
                entity_counts[entity_type] = count
            
            return {
                "total_mappings": total_mappings,
                "entity_counts": entity_counts,
                "cache_size": len(self._cache),
                "id_range": {
                    "min": self.MIN_MOBILE_ID,
                    "max": self.MAX_MOBILE_ID
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get mobile ID mapping stats: {str(e)}")
            return {"error": str(e)}

# Create tables
def create_mobile_id_tables():
    """Create mobile ID mapping tables"""
    try:
        MobileIDMapping.__table__.create(engine, checkfirst=True)
        logger.info("Mobile ID mapping tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create mobile ID mapping tables: {str(e)}")
        raise

# Global service instance
_mobile_id_service = None

def get_mobile_id_service(db: Session, redis: Optional[RedisClient] = None) -> MobileIDService:
    """Get mobile ID service instance"""
    return MobileIDService(db, redis)