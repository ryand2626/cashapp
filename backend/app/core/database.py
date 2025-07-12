"""
Database configuration and models for Fynlo POS
PostgreSQL implementation matching frontend data requirements
"""

from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey, DECIMAL, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.elements import quoted_name # For GIN index
import uuid
from typing import Generator

from app.core.config import settings

# Database engine with connection pooling for production performance
# Critical fix for menu API timeout issues
from sqlalchemy.pool import QueuePool

# Configure engine with proper connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=QueuePool,
    pool_size=20,          # Number of persistent connections
    max_overflow=10,       # Maximum overflow connections above pool_size
    pool_recycle=3600,     # Recycle connections after 1 hour (avoid stale connections)
    pool_pre_ping=True,    # Test connections before using (handles network issues)
    pool_timeout=30,       # Timeout for getting connection from pool
    connect_args={
        "connect_timeout": 10,  # PostgreSQL connection timeout
        "options": "-c statement_timeout=30000"  # 30 second statement timeout
    } if "postgresql" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Database Models matching frontend expectations

class Platform(Base):
    """Multi-tenant platform for restaurant owners"""
    __tablename__ = "platforms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_email = Column(String(255), unique=True, nullable=False)
    subscription_tier = Column(String(50), default="basic")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Restaurant(Base):
    """Individual restaurant configuration"""
    __tablename__ = "restaurants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_id = Column(UUID(as_uuid=True), nullable=True)  # Multi-tenant support
    name = Column(String(255), nullable=False)
    address = Column(JSONB, nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    timezone = Column(String(50), default="UTC")
    business_hours = Column(JSONB, default={})
    settings = Column(JSONB, default={})
    tax_configuration = Column(JSONB, default={
        "vatEnabled": True,
        "vatRate": 20,
        "serviceTaxEnabled": True,
        "serviceTaxRate": 12.5
    })
    payment_methods = Column(JSONB, default={
        "qrCode": {"enabled": True, "feePercentage": 1.2},
        "cash": {"enabled": True, "requiresAuth": False},
        "card": {"enabled": True, "feePercentage": 2.9},
        "applePay": {"enabled": True, "feePercentage": 2.9},
        "giftCard": {"enabled": True, "requiresAuth": True}
    })
    floor_plan_layout = Column(JSONB)  # New field for layout storage
    # Subscription fields for Supabase integration
    subscription_plan = Column(String(50), default='alpha')  # alpha, beta, omega
    subscription_status = Column(String(50), default='trial')  # trial, active, cancelled, expired
    subscription_started_at = Column(DateTime(timezone=True), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class User(Base):
    """Users with role-based access"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=True)  # Optional username field
    password_hash = Column(String(255), nullable=True)  # Now nullable for Supabase auth
    supabase_id = Column(UUID(as_uuid=True), unique=True, nullable=True)  # Supabase user ID
    auth_provider = Column(String(50), default='supabase')  # Track auth method
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)  # platform_owner, restaurant_owner, manager, employee
    restaurant_id = Column(UUID(as_uuid=True), nullable=True)
    platform_id = Column(UUID(as_uuid=True), nullable=True)
    permissions = Column(JSONB, default={})
    pin_code = Column(String(6))  # For employee time clock
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Customer(Base):
    """Customer management with loyalty tracking"""
    __tablename__ = "customers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    first_name = Column(String(100))
    last_name = Column(String(100))
    loyalty_points = Column(Integer, default=0)
    total_spent = Column(DECIMAL(10, 2), default=0.0)
    visit_count = Column(Integer, default=0)
    preferences = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Category(Base):
    """Menu categories"""
    __tablename__ = "categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    color = Column(String(7), default="#00A651")  # Hex color
    icon = Column(String(50))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Product(Base):
    """Menu items/products"""
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    category_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(DECIMAL(10, 2), nullable=False)
    cost = Column(DECIMAL(10, 2), default=0.0)
    image_url = Column(String(500))
    barcode = Column(String(100))
    sku = Column(String(100))
    prep_time = Column(Integer, default=0)  # minutes
    dietary_info = Column(JSONB, default=[])  # ["vegetarian", "gluten-free", etc.]
    modifiers = Column(JSONB, default=[])
    is_active = Column(Boolean, default=True)
    stock_tracking = Column(Boolean, default=False)
    stock_quantity = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship to recipes
    recipes = relationship("Recipe", back_populates="product_item")

class Order(Base):
    """Customer orders"""
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), nullable=True)
    order_number = Column(String(50), nullable=False)
    table_number = Column(String(20))  # Legacy field - kept for backward compatibility
    table_id = Column(UUID(as_uuid=True), ForeignKey('tables.id'), nullable=True)  # New FK to tables
    order_type = Column(String(20), default="dine_in")  # dine_in, takeaway, delivery
    status = Column(String(20), default="pending")  # pending, confirmed, preparing, ready, completed, cancelled
    items = Column(JSONB, nullable=False)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    tax_amount = Column(DECIMAL(10, 2), default=0.0)
    service_charge = Column(DECIMAL(10, 2), default=0.0)
    discount_amount = Column(DECIMAL(10, 2), default=0.0)
    total_amount = Column(DECIMAL(10, 2), nullable=False)
    payment_status = Column(String(20), default="pending")
    special_instructions = Column(Text)
    created_by = Column(UUID(as_uuid=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship
    table = relationship("Table", back_populates="orders")

class Payment(Base):
    """Payment transactions"""
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), nullable=False)
    payment_method = Column(String(50), nullable=False)  # qr_code, cash, card, apple_pay
    amount = Column(DECIMAL(10, 2), nullable=False)
    fee_amount = Column(DECIMAL(10, 2), default=0.0)
    net_amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(20), default="pending")  # pending, processing, completed, failed, refunded
    external_id = Column(String(255))  # Stripe payment ID, etc.
    payment_metadata = Column(JSONB, default={})
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class QRPayment(Base):
    """QR code payment tracking"""
    __tablename__ = "qr_payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id = Column(UUID(as_uuid=True), nullable=False)
    qr_code_data = Column(Text, nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(50), default="pending")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    fee_amount = Column(DECIMAL(10, 2), default=0.0)
    net_amount = Column(DECIMAL(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Section(Base):
    """Restaurant floor plan sections"""
    __tablename__ = "sections"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    capacity = Column(Integer, default=50)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class InventoryItem(Base):
    """Inventory items (raw ingredients/supplies)"""
    __tablename__ = "inventory"

    sku = Column(String(100), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    qty_g = Column(Integer, nullable=False, default=0) # Current quantity in grams (or ml or units)
    par_level_g = Column(Integer, nullable=True, default=0) # Desired stock level
    unit = Column(String(50), default="grams") # e.g., grams, ml, units
    cost_per_unit = Column(DECIMAL(10, 2), nullable=True) # Cost per unit (e.g., cost per gram)
    supplier = Column(String(255), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationship to recipes where this item is an ingredient
    recipe_ingredients = relationship("Recipe", back_populates="ingredient")
    # Relationship to ledger entries
    ledger_entries = relationship("InventoryLedgerEntry", back_populates="inventory_item")


class Recipe(Base):
    """Recipes linking products to inventory items"""
    __tablename__ = "recipe"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    item_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False) # FK to Product.id
    ingredient_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False) # FK to InventoryItem.sku
    qty_g = Column(Integer, nullable=False) # Quantity of ingredient in grams (or ml or units)

    # Relationships
    product_item = relationship("Product", back_populates="recipes")
    ingredient = relationship("InventoryItem", back_populates="recipe_ingredients")

    __table_args__ = (UniqueConstraint('item_id', 'ingredient_sku', name='uq_recipe_item_ingredient'),)


class InventoryLedgerEntry(Base):
    """Audit trail for inventory changes"""
    __tablename__ = "inventory_ledger"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False, index=True)
    delta_g = Column(Integer, nullable=False) # Change in quantity (positive for additions, negative for deductions)
    source = Column(String(50), nullable=False) # E.g., "order_fulfillment", "manual_stock_add", "initial_import", "spoilage"
    source_id = Column(String(255), nullable=True) # E.g., order_id, user_id (for manual entry), import_batch_id
    ts = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationship
    inventory_item = relationship("InventoryItem", back_populates="ledger_entries")


class Table(Base):
    """Restaurant tables"""
    __tablename__ = "tables"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey('sections.id'), nullable=False)
    name = Column(String(100), nullable=False)
    seats = Column(Integer, nullable=False, default=4)
    status = Column(String(20), default="available")  # available, occupied, reserved, cleaning
    server_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to User
    x_position = Column(Integer, default=0)
    y_position = Column(Integer, default=0)
    width = Column(Integer, default=60)  # Table width for layout
    height = Column(Integer, default=60)  # Table height for layout
    rotation = Column(Integer, default=0)  # Rotation angle in degrees
    shape = Column(String(20), default="round")  # round, square, rectangle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    section = relationship("Section")
    orders = relationship("Order", back_populates="table")

class PosSession(Base):
    """POS Session management"""
    __tablename__ = "pos_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    restaurant_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    state = Column(String(50), default="opening_control")  # opening_control, opened, closing_control, closed
    config_id = Column(Integer, nullable=False)
    config_name = Column(String(255), nullable=False)
    start_at = Column(DateTime(timezone=True), server_default=func.now())
    stop_at = Column(DateTime(timezone=True), nullable=True)
    session_data = Column(JSONB, default={})  # Additional session configuration
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Database dependency
def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()

async def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)