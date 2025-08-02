"""Convert monetary fields from FLOAT to DECIMAL

Revision ID: 1d25e080d454
Revises: 370119f53344
Create Date: 2025-06-21 09:08:23.308571

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import DECIMAL


# revision identifiers, used by Alembic.
revision = '1d25e080d454'
down_revision = '370119f53344'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert all monetary FLOAT fields to DECIMAL(10,2) for precise calculations"""
    
    # Customer monetary fields
    op.alter_column('customers', 'total_spent',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    # Product monetary fields
    op.alter_column('products', 'price',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    op.alter_column('products', 'cost',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    # Order monetary fields
    op.alter_column('orders', 'subtotal',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    op.alter_column('orders', 'tax_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'service_charge',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'discount_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'total_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    # Payment monetary fields
    op.alter_column('payments', 'amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    op.alter_column('payments', 'fee_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('payments', 'net_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    # QR Payment monetary fields
    op.alter_column('qr_payments', 'amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)
    
    op.alter_column('qr_payments', 'fee_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('qr_payments', 'net_amount',
                   existing_type=sa.FLOAT(),
                   type_=DECIMAL(precision=10, scale=2),
                   existing_nullable=False)


def downgrade() -> None:
    """Revert DECIMAL fields back to FLOAT (not recommended for production)"""
    
    # QR Payment fields
    op.alter_column('qr_payments', 'net_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    op.alter_column('qr_payments', 'fee_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('qr_payments', 'amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    # Payment fields
    op.alter_column('payments', 'net_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    op.alter_column('payments', 'fee_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('payments', 'amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    # Order fields
    op.alter_column('orders', 'total_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    op.alter_column('orders', 'discount_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'service_charge',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'tax_amount',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('orders', 'subtotal',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    # Product fields
    op.alter_column('products', 'cost',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))
    
    op.alter_column('products', 'price',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=False)
    
    # Customer fields
    op.alter_column('customers', 'total_spent',
                   existing_type=DECIMAL(precision=10, scale=2),
                   type_=sa.FLOAT(),
                   existing_nullable=True,
                   existing_server_default=sa.text('0.0'))