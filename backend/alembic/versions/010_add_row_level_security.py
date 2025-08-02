"""Add row level security for multi-tenant isolation

Revision ID: add_row_level_security
Revises: performance_indexes_20250117
Create Date: 2025-07-29

Platform owners (users with role 'platform_owner' AND specific emails) have full access.
All other users can only access their own restaurant's data.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'add_row_level_security'
down_revision = 'performance_indexes_20250117'
branch_labels = None
depends_on = None


def upgrade():
    """
    Enable Row Level Security on all tenant-specific tables
    Platform owners (Ryan and Arnaud) bypass all RLS policies
    """
    
    # Tables that need RLS
    tables_needing_rls = [
        'orders',
        'order_items',
        'products',
        'categories',
        'customers',
        'employees',
        'tables',
        'pos_sessions',
        'inventory_items',
        'stock_movements',
        'payments',
        'payment_configurations',
        'refunds',
        'financial_records',
        'reports',
        'activity_logs',
        'audit_logs'
    ]
    
    # Enable RLS on each table
    for table in tables_needing_rls:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    
    # Create a function to check if user is platform owner
    op.execute("""
        CREATE OR REPLACE FUNCTION is_platform_owner(user_email TEXT, user_role TEXT)
        RETURNS BOOLEAN AS $$
        BEGIN
            -- Platform owners must have BOTH the role AND be in the allowed email list
            RETURN user_role = 'platform_owner' AND 
                   user_email = ANY(ARRAY[
                       'ryan@fynlo.com',
                       'arnaud@fynlo.com',
                       'ryand2626@gmail.com',
                       'arno@fynlo.com'
                   ]::TEXT[]);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """)
    
    # Create RLS policies for each table
    for table in tables_needing_rls:
        # Drop existing policies if any
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};
            DROP POLICY IF EXISTS {table}_platform_owner ON {table};
        """)
        
        # Policy 1: Platform owners can see everything
        op.execute(f"""
            CREATE POLICY {table}_platform_owner ON {table}
            FOR ALL
            TO PUBLIC
            USING (
                is_platform_owner(current_setting('app.user_email', true), current_setting('app.user_role', true))
            );
        """)
        
        # Policy 2: Regular users can only see their restaurant's data
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            FOR ALL
            TO PUBLIC
            USING (
                -- If not a platform owner, must match restaurant_id
                NOT is_platform_owner(current_setting('app.user_email', true), current_setting('app.user_role', true))
                AND restaurant_id::TEXT = current_setting('app.restaurant_id', true)
            );
        """)
    
    # Special handling for users table (no restaurant_id field)
    op.execute("""
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE users FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS users_self_access ON users;
        DROP POLICY IF EXISTS users_restaurant_access ON users;
        DROP POLICY IF EXISTS users_platform_owner ON users;
        
        -- Platform owners can see all users
        CREATE POLICY users_platform_owner ON users
        FOR ALL
        TO PUBLIC
        USING (
            is_platform_owner(current_setting('app.user_email', true), current_setting('app.user_role', true))
        );
        
        -- Users can see themselves
        CREATE POLICY users_self_access ON users
        FOR ALL
        TO PUBLIC
        USING (
            id::TEXT = current_setting('app.user_id', true)
        );
        
        -- Users can see other users in their restaurant
        CREATE POLICY users_restaurant_access ON users
        FOR SELECT
        TO PUBLIC
        USING (
            restaurant_id::TEXT = current_setting('app.restaurant_id', true)
        );
    """)
    
    # Special handling for restaurants table
    op.execute("""
        ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
        ALTER TABLE restaurants FORCE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS restaurants_own_access ON restaurants;
        DROP POLICY IF EXISTS restaurants_platform_owner ON restaurants;
        
        -- Platform owners can see all restaurants
        CREATE POLICY restaurants_platform_owner ON restaurants
        FOR ALL
        TO PUBLIC
        USING (
            is_platform_owner(current_setting('app.user_email', true), current_setting('app.user_role', true))
        );
        
        -- Users can only see their own restaurant
        CREATE POLICY restaurants_own_access ON restaurants
        FOR ALL
        TO PUBLIC
        USING (
            id::TEXT = current_setting('app.restaurant_id', true)
        );
    """)


def downgrade():
    """
    Disable Row Level Security
    """
    
    tables_with_rls = [
        'orders', 'order_items', 'products', 'categories', 'customers',
        'employees', 'tables', 'pos_sessions', 'inventory_items',
        'stock_movements', 'payments', 'payment_configurations',
        'refunds', 'financial_records', 'reports', 'activity_logs',
        'audit_logs', 'users', 'restaurants'
    ]
    
    # Disable RLS on all tables
    for table in tables_with_rls:
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};
            DROP POLICY IF EXISTS {table}_platform_owner ON {table};
            DROP POLICY IF EXISTS {table}_self_access ON {table};
            DROP POLICY IF EXISTS {table}_restaurant_access ON {table};
            DROP POLICY IF EXISTS {table}_own_access ON {table};
            ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
        """)
    
    # Drop the platform owner function
    op.execute("DROP FUNCTION IF EXISTS is_platform_owner(TEXT, TEXT);")