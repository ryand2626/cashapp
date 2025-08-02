"""
Stock Movement and Supplier Management Models
Track all inventory movements and supplier relationships
"""
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Date, DECIMAL, ForeignKey, Enum as SqlEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum
from app.core.database import Base, Restaurant, User, Order, InventoryItem


class MovementType(enum.Enum):
    """Types of stock movements"""
    PURCHASE = "purchase"          # Stock received from supplier
    SALE = "sale"                  # Stock used in orders
    ADJUSTMENT = "adjustment"      # Manual adjustment
    TRANSFER = "transfer"          # Transfer between locations
    WASTE = "waste"                # Spoilage/damage
    RETURN = "return"              # Return to supplier
    PRODUCTION = "production"      # Used in production/prep
    COUNT = "count"                # Physical count adjustment


class Supplier(Base):
    """Supplier management"""
    __tablename__ = "suppliers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    
    # Supplier Information
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True)
    contact_name = Column(String(100))
    email = Column(String(255))
    phone = Column(String(20))
    website = Column(String(255))
    
    # Address
    address = Column(JSONB, default={})  # {line1, line2, city, postcode, country}
    
    # Business Details
    tax_number = Column(String(50))
    payment_terms = Column(String(50), default="net30")  # net30, net60, cod, etc
    minimum_order = Column(DECIMAL(10, 2), default=0.0)
    delivery_days = Column(JSONB, default=[])  # ["monday", "thursday"]
    lead_time_days = Column(Integer, default=1)
    
    # Categories this supplier provides
    categories = Column(JSONB, default=[])  # ["produce", "meat", "dairy"]
    
    # Performance Metrics
    on_time_delivery_rate = Column(DECIMAL(5, 2), default=100.0)  # percentage
    quality_rating = Column(DECIMAL(3, 2), default=5.0)  # 0.00 to 5.00
    total_purchases = Column(DECIMAL(12, 2), default=0.0)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_preferred = Column(Boolean, default=False)
    notes = Column(JSONB, default=[])  # [{date, note, author_id}]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    stock_movements = relationship("StockMovement", back_populates="supplier")


class PurchaseOrder(Base):
    """Purchase orders to suppliers"""
    __tablename__ = "purchase_orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False)
    
    # Order Details
    order_number = Column(String(50), unique=True, nullable=False)
    order_date = Column(Date, nullable=False)
    expected_delivery = Column(Date, nullable=False)
    actual_delivery = Column(Date, nullable=True)
    
    # Financial
    subtotal = Column(DECIMAL(12, 2), default=0.0)
    tax_amount = Column(DECIMAL(10, 2), default=0.0)
    delivery_fee = Column(DECIMAL(10, 2), default=0.0)
    total_amount = Column(DECIMAL(12, 2), default=0.0)
    
    # Status
    status = Column(String(20), default="draft")  # draft, sent, confirmed, delivered, cancelled
    payment_status = Column(String(20), default="pending")  # pending, partial, paid
    
    # Delivery
    delivery_notes = Column(String(500))
    invoice_number = Column(String(50))
    
    # User tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    receiver = relationship("User", foreign_keys=[received_by])


class PurchaseOrderItem(Base):
    """Items in a purchase order"""
    __tablename__ = "purchase_order_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    inventory_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False)
    
    # Order Details
    quantity_ordered = Column(DECIMAL(10, 2), nullable=False)
    unit = Column(String(20), nullable=False)  # kg, g, l, ml, units
    unit_price = Column(DECIMAL(10, 2), nullable=False)
    total_price = Column(DECIMAL(10, 2), nullable=False)
    
    # Delivery
    quantity_received = Column(DECIMAL(10, 2), default=0.0)
    quantity_rejected = Column(DECIMAL(10, 2), default=0.0)
    rejection_reason = Column(String(255))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    inventory_item = relationship("InventoryItem")


class StockMovement(Base):
    """Track all inventory movements"""
    __tablename__ = "stock_movements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    inventory_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False)
    
    # Movement Details
    movement_type = Column(SqlEnum(MovementType), nullable=False)
    quantity = Column(DECIMAL(10, 2), nullable=False)  # Positive for IN, Negative for OUT
    unit = Column(String(20), nullable=False)
    
    # Stock Levels (snapshot at time of movement)
    stock_before = Column(DECIMAL(10, 2), nullable=False)
    stock_after = Column(DECIMAL(10, 2), nullable=False)
    
    # Cost Information
    unit_cost = Column(DECIMAL(10, 2), default=0.0)
    total_cost = Column(DECIMAL(10, 2), default=0.0)
    
    # Reference Information
    reference_type = Column(String(50))  # order, purchase_order, adjustment, etc
    reference_id = Column(String(255))  # ID of the related record
    
    # Additional Details based on movement type
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id"), nullable=True)
    
    # Reason/Notes
    reason = Column(String(255))
    notes = Column(String(500))
    
    # User tracking
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    movement_date = Column(DateTime(timezone=True), nullable=False, default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    inventory_item = relationship("InventoryItem")
    supplier = relationship("Supplier", back_populates="stock_movements")
    order = relationship("Order")
    performer = relationship("User", foreign_keys=[performed_by])
    approver = relationship("User", foreign_keys=[approved_by])


class StockAlert(Base):
    """Inventory alerts and notifications"""
    __tablename__ = "stock_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    inventory_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False)
    
    # Alert Details
    alert_type = Column(String(50), nullable=False)  # low_stock, out_of_stock, expiring_soon
    threshold_value = Column(DECIMAL(10, 2))  # The value that triggered the alert
    current_value = Column(DECIMAL(10, 2))  # Current stock level or days to expiry
    
    # Status
    is_active = Column(Boolean, default=True)
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    
    # Resolution
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(String(255))
    
    # Notification
    notification_sent = Column(Boolean, default=False)
    notification_channels = Column(JSONB, default=[])  # ["email", "sms", "app"]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    inventory_item = relationship("InventoryItem")
    acknowledger = relationship("User")


class InventoryCount(Base):
    """Physical inventory counts"""
    __tablename__ = "inventory_counts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False)
    
    # Count Details
    count_date = Column(Date, nullable=False)
    count_type = Column(String(50), default="full")  # full, cycle, spot
    
    # Status
    status = Column(String(20), default="in_progress")  # in_progress, completed, approved
    
    # Summary
    items_counted = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    variance_value = Column(DECIMAL(10, 2), default=0.0)  # Total $ variance
    
    # User tracking
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    notes = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    restaurant = relationship("Restaurant")
    items = relationship("InventoryCountItem", back_populates="count", cascade="all, delete-orphan")
    initiator = relationship("User", foreign_keys=[initiated_by])
    completer = relationship("User", foreign_keys=[completed_by])
    approver = relationship("User", foreign_keys=[approved_by])


class InventoryCountItem(Base):
    """Individual items in an inventory count"""
    __tablename__ = "inventory_count_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    count_id = Column(UUID(as_uuid=True), ForeignKey("inventory_counts.id"), nullable=False)
    inventory_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False)
    
    # Count Details
    system_quantity = Column(DECIMAL(10, 2), nullable=False)  # What system shows
    counted_quantity = Column(DECIMAL(10, 2), nullable=False)  # What was physically counted
    variance_quantity = Column(DECIMAL(10, 2), nullable=False)  # Difference
    
    # Financial Impact
    unit_cost = Column(DECIMAL(10, 2), nullable=False)
    variance_value = Column(DECIMAL(10, 2), nullable=False)  # variance_quantity * unit_cost
    
    # Status
    is_verified = Column(Boolean, default=False)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    notes = Column(String(255))
    counted_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    count = relationship("InventoryCount", back_populates="items")
    inventory_item = relationship("InventoryItem")
    verifier = relationship("User")