"""
Database configuration and models for Fynlo POS
PostgreSQL implementation matching frontend data requirements
"""

from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey, DECIMAL, UniqueConstraint, event
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from sqlalchemy.sql.elements import quoted_name # For GIN index
import uuid
from typing import Generator, Optional
from contextlib import contextmanager

from app.core.config import settings

# Database engine with connection pooling for production performance
# Critical fix for menu API timeout issues
from sqlalchemy.pool import QueuePool

# Configure engine with proper connection pooling
import os
import logging

logger = logging.getLogger(__name__)

# Parse DATABASE_URL to handle SSL requirements
database_url = settings.DATABASE_URL

# For DigitalOcean managed databases, ensure SSL mode is set
if "postgresql" in database_url and (":25060" in database_url or ":25061" in database_url):
    if "sslmode" not in database_url:
        # Add sslmode=require to the connection string if not present
        separator = "&" if "?" in database_url else "?"
        database_url = f"{database_url}{separator}sslmode=require"
        logger.info("Added sslmode=require to DigitalOcean database connection")

connect_args = {}
if "postgresql" in database_url:
    connect_args = {
        "connect_timeout": 10  # PostgreSQL connection timeout
    }
    
    # For DigitalOcean managed databases
    if ":25060" in database_url or ":25061" in database_url:
        # PgBouncer (port 25061) doesn't support statement_timeout in connection options
        # Only add it for direct connections (port 25060)
        if ":25060" in database_url:
            connect_args["options"] = "-c statement_timeout=30000"  # 30 second statement timeout
            
        # Provide the CA certificate
        cert_path = os.path.join(os.path.dirname(__file__), "..", "..", "certs", "ca-certificate.crt")
        if os.path.exists(cert_path):
            # Provide the CA certificate path for SSL verification
            connect_args["sslrootcert"] = cert_path
            logger.info(f"Using CA certificate for SSL: {cert_path}")
        else:
            logger.warning(f"CA certificate not found at {cert_path}")
    else:
        # For non-DigitalOcean databases, add statement timeout
        connect_args["options"] = "-c statement_timeout=30000"  # 30 second statement timeout

# Import security config
from app.core.database_security import DatabaseSecurityConfig

# Merge security settings with existing connect_args
secure_engine_args = DatabaseSecurityConfig.get_secure_engine_args()
secure_connect_args = secure_engine_args.pop('connect_args', {})
# Merge with existing connect_args
for key, value in connect_args.items():
    if key not in secure_connect_args:
        secure_connect_args[key] = value

engine = create_engine(
    database_url,
    echo=settings.DEBUG and settings.ENVIRONMENT != "production",  # Never echo in production
    poolclass=QueuePool,
    pool_size=secure_engine_args.get('pool_size', 20),
    max_overflow=secure_engine_args.get('max_overflow', 10),
    pool_recycle=secure_engine_args.get('pool_recycle', 3600),
    pool_pre_ping=secure_engine_args.get('pool_pre_ping', True),
    pool_timeout=30,
    pool_reset_on_return='rollback',
    connect_args=secure_connect_args,
    future=secure_engine_args.get('future', True)
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
    # Subscription fields for Supabase integration
    subscription_plan = Column(String(50), default='alpha')  # alpha, beta, omega
    subscription_status = Column(String(50), default='trial')  # trial, active, cancelled, expired
    subscription_started_at = Column(DateTime(timezone=True), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="restaurant")

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
    restaurant_id = Column(UUID(as_uuid=True), nullable=True)  # Legacy single restaurant
    platform_id = Column(UUID(as_uuid=True), nullable=True)
    permissions = Column(JSONB, default={})
    pin_code = Column(String(6))  # For employee time clock
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime(timezone=True))
    current_restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id'), nullable=True)
    last_restaurant_switch = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    restaurants = relationship("UserRestaurant", foreign_keys="[UserRestaurant.user_id]", back_populates="user")
    current_restaurant = relationship("Restaurant", foreign_keys=[current_restaurant_id])

class UserRestaurant(Base):
    """Many-to-many relationship between users and restaurants for multi-restaurant support"""
    __tablename__ = "user_restaurants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(50), nullable=False, default='owner')  # owner, manager, employee
    is_primary = Column(Boolean, default=False)
    permissions = Column(JSONB, default={})
    assigned_by = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="restaurants")
    restaurant = relationship("Restaurant")
    assigned_by_user = relationship("User", foreign_keys=[assigned_by])
    
    __table_args__ = (
        UniqueConstraint('user_id', 'restaurant_id', name='unique_user_restaurant'),
    )

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
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    qty_g = Column(Integer, nullable=False, default=0) # Current quantity in grams (or ml or units)
    par_level_g = Column(Integer, nullable=True, default=0) # Desired stock level
    unit = Column(String(50), default="grams") # e.g., grams, ml, units
    cost_per_unit = Column(DECIMAL(10, 2), nullable=True) # Cost per unit (e.g., cost per gram)
    supplier = Column(String(255), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    restaurant = relationship("Restaurant", back_populates="inventory_items")
    recipe_ingredients = relationship("Recipe", back_populates="ingredient")
    # Relationship to ledger entries
    ledger_entries = relationship("InventoryLedgerEntry", back_populates="inventory_item")


class Recipe(Base):
    """Recipes linking products to inventory items"""
    __tablename__ = "recipe"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False)
    item_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False) # FK to Product.id
    ingredient_sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False) # FK to InventoryItem.sku
    qty_g = Column(Integer, nullable=False) # Quantity of ingredient in grams (or ml or units)

    # Relationships
    restaurant = relationship("Restaurant")
    product_item = relationship("Product", back_populates="recipes")
    ingredient = relationship("InventoryItem", back_populates="recipe_ingredients")

    __table_args__ = (UniqueConstraint('restaurant_id', 'item_id', 'ingredient_sku', name='uq_recipe_restaurant_item_ingredient'),)


class InventoryLedgerEntry(Base):
    """Audit trail for inventory changes"""
    __tablename__ = "inventory_ledger"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sku = Column(String(100), ForeignKey("inventory.sku"), nullable=False, index=True)
    restaurant_id = Column(UUID(as_uuid=True), ForeignKey('restaurants.id', ondelete='CASCADE'), nullable=False)
    delta_g = Column(Integer, nullable=False) # Change in quantity (positive for additions, negative for deductions)
    source = Column(String(50), nullable=False) # E.g., "order_fulfillment", "manual_stock_add", "initial_import", "spoilage"
    source_id = Column(String(255), nullable=True) # E.g., order_id, user_id (for manual entry), import_batch_id
    ts = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    restaurant = relationship("Restaurant")
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

# RLS context for session variables
import contextvars
from typing import Optional, Dict, Any

# Use contextvars for proper async context management
_rls_context_var: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    'rls_context',
    default=None
)

class RLSContext:
    """Context-aware storage for RLS context using contextvars"""
    
    @classmethod
    def set(cls, user_id: Optional[str] = None, restaurant_id: Optional[str] = None, role: Optional[str] = None):
        """Set RLS context for current async context"""
        context = {
            'user_id': user_id,
            'restaurant_id': restaurant_id,
            'role': role
        }
        _rls_context_var.set(context)
    
    @classmethod
    def get(cls) -> dict:
        """Get RLS context for current async context"""
        context = _rls_context_var.get()
        return context if context is not None else {}
    
    @classmethod
    def clear(cls):
        """Clear RLS context for current async context"""
        _rls_context_var.set(None)


# Event listener to set session variables on connection checkout
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Ensure fresh connection state"""
    # This runs when a physical connection is first created
    logger.debug("New database connection established")


@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    """Set session variables when connection is checked out from pool"""
    # Get RLS context if available
    context = RLSContext.get()
    
    if context:
        cursor = dbapi_connection.cursor()
        try:
            # Reset only RLS-specific session variables (not ALL)
            cursor.execute("RESET app.current_user_id")
            cursor.execute("RESET app.current_user_email")
            cursor.execute("RESET app.current_user_role")
            cursor.execute("RESET app.current_restaurant_id")
            cursor.execute("RESET app.is_platform_owner")
            
            # Set session variables for RLS with correct names
            if context.get('user_id'):
                cursor.execute("SET LOCAL app.current_user_id = %s", (context['user_id'],))
                logger.debug(f"Set RLS current_user_id: {context['user_id']}")
                
                # Also set user email if available
                if hasattr(context, 'email'):
                    cursor.execute("SET LOCAL app.current_user_email = %s", (context.get('email', ''),))
            
            if context.get('restaurant_id'):
                cursor.execute("SET LOCAL app.current_restaurant_id = %s", (context['restaurant_id'],))
                logger.debug(f"Set RLS current_restaurant_id: {context['restaurant_id']}")
            
            if context.get('role'):
                cursor.execute("SET LOCAL app.current_user_role = %s", (context['role'],))
                logger.debug(f"Set RLS current_user_role: {context['role']}")
                
                # Set platform owner flag
                is_platform_owner = context.get('role') == 'platform_owner'
                cursor.execute("SET LOCAL app.is_platform_owner = %s", (str(is_platform_owner).lower(),))
            
            dbapi_connection.commit()
        except Exception as e:
            logger.error(f"Error setting RLS session variables: {e}")
            dbapi_connection.rollback()
        finally:
            cursor.close()


@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    """Reset session when connection is returned to pool"""
    cursor = dbapi_connection.cursor()
    try:
        # Reset only RLS session variables to ensure clean state
        cursor.execute("RESET app.current_user_id")
        cursor.execute("RESET app.current_user_email")
        cursor.execute("RESET app.current_user_role")
        cursor.execute("RESET app.current_restaurant_id")
        cursor.execute("RESET app.is_platform_owner")
        dbapi_connection.commit()
        logger.debug("Reset session variables on connection checkin")
    except Exception as e:
        logger.error(f"Error resetting session variables: {e}")
        dbapi_connection.rollback()
    finally:
        cursor.close()


# Database dependency with RLS support
def get_db() -> Generator[Session, None, None]:
    """Get database session with RLS context"""
    db = SessionLocal()
    try:
        yield db
    finally:
        # Clear RLS context when request completes
        RLSContext.clear()
        db.close()


@contextmanager
def get_db_with_rls(user_id: Optional[str] = None, restaurant_id: Optional[str] = None, role: Optional[str] = None):
    """Get database session with specific RLS context"""
    # Set RLS context
    RLSContext.set(user_id=user_id, restaurant_id=restaurant_id, role=role)
    
    db = SessionLocal()
    try:
        yield db
    finally:
        # Clear RLS context
        RLSContext.clear()
        db.close()

async def init_db():
    """Initialize database tables and apply security measures"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Apply database security hardening
    try:
        from app.core.database_security import apply_all_security_measures
        apply_all_security_measures(engine)
        logger.info("Database security measures applied")
    except Exception as e:
        logger.warning(f"Could not apply all security measures: {e}")
        # Continue without failing startup