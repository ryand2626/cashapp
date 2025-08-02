"""Add username field to users table

Revision ID: 001_add_username
Revises: 
Create Date: 2025-01-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_add_username'
down_revision = '000_initial_schema'
branch_labels = None
depends_on = None

def upgrade():
    """Add username field to users table"""
    # Add username column to users table
    op.add_column('users', sa.Column('username', sa.String(length=100), nullable=True))
    
    # Add unique constraint for username
    op.create_unique_constraint('uq_users_username', 'users', ['username'])

def downgrade():
    """Remove username field from users table"""
    # Drop unique constraint
    op.drop_constraint('uq_users_username', 'users', type_='unique')
    
    # Drop username column
    op.drop_column('users', 'username')