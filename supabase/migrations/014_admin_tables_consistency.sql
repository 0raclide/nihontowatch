-- =============================================================================
-- ADMIN TABLES CONSISTENCY FIX
-- Migration: 014_admin_tables_consistency.sql
-- Description: Fixes inconsistencies between TypeScript types and actual schema.
--              Creates missing tables and columns needed by admin functionality.
--
-- AUDIT FINDINGS:
-- 1. Code expects both `role` AND `is_admin` on profiles - adding `is_admin`
-- 2. API routes query `alerts` but migration 009 created `user_alerts`
-- 3. Admin stats queries `favorites` but migration 009 created `user_favorites`
-- 4. user_activity column names differ from TypeScript expectations
-- =============================================================================

-- =============================================================================
-- 1. ADD is_admin COLUMN TO profiles TABLE
-- =============================================================================
-- Some admin routes use `role` (correct), others use `is_admin` (missing column).
-- Adding `is_admin` as a GENERATED column computed from `role` for compatibility.

-- First, check if is_admin column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'is_admin'
    ) THEN
        -- Add is_admin as a generated column computed from role
        ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN GENERATED ALWAYS AS (role = 'admin') STORED;

        -- Create index for admin lookups
        CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;
    END IF;
END $$;

COMMENT ON COLUMN profiles.is_admin IS 'Computed column: TRUE when role=admin. For backward compatibility with code using is_admin.';

-- =============================================================================
-- 2. CREATE ALERTS TABLE (separate from user_alerts)
-- =============================================================================
-- API routes query `alerts` but migration 009 created `user_alerts`.
-- Creating `alerts` as the canonical table (since all API code uses this name).
-- If user_alerts exists, we'll migrate data and keep it as a view.

-- Option A: Create alerts table if it doesn't exist
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'new_listing', 'back_in_stock')),
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    target_price NUMERIC,
    search_criteria JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for alerts table
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_alerts_listing_id ON alerts(listing_id);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);

-- Enable RLS on alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alerts table
DO $$
BEGIN
    -- Drop existing policies if they exist (for idempotency)
    DROP POLICY IF EXISTS alerts_select_own ON alerts;
    DROP POLICY IF EXISTS alerts_insert_own ON alerts;
    DROP POLICY IF EXISTS alerts_update_own ON alerts;
    DROP POLICY IF EXISTS alerts_delete_own ON alerts;
    DROP POLICY IF EXISTS alerts_select_admin ON alerts;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors if policies don't exist
END $$;

-- Users can read their own alerts
CREATE POLICY alerts_select_own ON alerts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own alerts
CREATE POLICY alerts_insert_own ON alerts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own alerts
CREATE POLICY alerts_update_own ON alerts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own alerts
CREATE POLICY alerts_delete_own ON alerts
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can read all alerts
CREATE POLICY alerts_select_admin ON alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMENT ON TABLE alerts IS 'User price and availability alerts. Primary table used by API routes.';

-- =============================================================================
-- 3. MIGRATE DATA FROM user_alerts TO alerts (if user_alerts exists)
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_alerts') THEN
        -- Migrate existing data from user_alerts to alerts
        INSERT INTO alerts (user_id, alert_type, listing_id, target_price, search_criteria, is_active, last_triggered_at, created_at)
        SELECT user_id, alert_type, listing_id, target_price, search_criteria, is_active, last_triggered_at, created_at
        FROM user_alerts
        ON CONFLICT DO NOTHING;

        RAISE NOTICE 'Migrated data from user_alerts to alerts table';
    END IF;
END $$;

-- =============================================================================
-- 4. CREATE favorites VIEW (alias to user_favorites)
-- =============================================================================
-- Admin stats queries `favorites` but the table is named `user_favorites`.
-- Creating a view for backward compatibility.

-- First drop view if it exists (might be a table)
DO $$
BEGIN
    -- Check if favorites is a view or table
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = 'favorites'
    ) THEN
        DROP VIEW favorites;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'favorites' AND table_type = 'BASE TABLE'
    ) THEN
        -- If favorites is already a table, don't drop it
        RAISE NOTICE 'favorites table already exists, skipping view creation';
    ELSE
        -- Create view if user_favorites exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'user_favorites'
        ) THEN
            CREATE VIEW favorites AS SELECT * FROM user_favorites;
            COMMENT ON VIEW favorites IS 'View alias for user_favorites table. For backward compatibility.';
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create favorites view: %', SQLERRM;
END $$;

-- =============================================================================
-- 5. UPDATE alert_history TO REFERENCE alerts TABLE
-- =============================================================================
-- alert_history.alert_id references user_alerts.id, but we need it to reference alerts.id

-- First, let's check if the FK constraint exists and update it
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- Check if the constraint exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'alert_history'
        AND constraint_name LIKE '%alert_id%'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        -- We can't easily change FK target, so we just note this for manual review
        RAISE NOTICE 'alert_history has existing FK constraint - may need manual migration if pointing to user_alerts';
    END IF;
END $$;

-- =============================================================================
-- 6. ADD MISSING COLUMNS TO user_activity FOR TypeScript COMPATIBILITY
-- =============================================================================
-- TypeScript expects: search_query, but migration has metadata JSONB
-- TypeScript expects: duration_seconds, but migration has duration_ms
-- Adding compatibility columns

DO $$
BEGIN
    -- Add search_query column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_activity'
        AND column_name = 'search_query'
    ) THEN
        ALTER TABLE user_activity ADD COLUMN search_query TEXT;
    END IF;

    -- Add duration_seconds as computed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_activity'
        AND column_name = 'duration_seconds'
    ) THEN
        -- Cannot use GENERATED column for nullable source, so add regular column
        ALTER TABLE user_activity ADD COLUMN duration_seconds INTEGER;
    END IF;
END $$;

-- Update duration_seconds from duration_ms where applicable
UPDATE user_activity
SET duration_seconds = duration_ms / 1000
WHERE duration_ms IS NOT NULL AND duration_seconds IS NULL;

-- Create trigger to auto-populate duration_seconds from duration_ms
CREATE OR REPLACE FUNCTION sync_duration_seconds()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.duration_ms IS NOT NULL THEN
        NEW.duration_seconds := NEW.duration_ms / 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_duration_on_insert ON user_activity;
CREATE TRIGGER sync_duration_on_insert
    BEFORE INSERT OR UPDATE ON user_activity
    FOR EACH ROW
    EXECUTE FUNCTION sync_duration_seconds();

-- =============================================================================
-- 7. ENSURE user_sessions HAS COMPATIBLE COLUMNS
-- =============================================================================
-- TypeScript expects certain columns that may be named differently

DO $$
BEGIN
    -- Add user_agent column if it doesn't exist (TypeScript expects this)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN user_agent TEXT;
    END IF;

    -- Add screen_width column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'screen_width'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN screen_width INTEGER;
    END IF;

    -- Add screen_height column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'screen_height'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN screen_height INTEGER;
    END IF;

    -- Add timezone column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'timezone'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN timezone TEXT;
    END IF;

    -- Add language column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'language'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN language TEXT;
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'user_sessions'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE user_sessions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- =============================================================================
-- 8. CREATE HELPER FUNCTION FOR ADMIN CHECKS
-- =============================================================================
-- Standardize admin checking across the codebase

CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = p_user_id AND (role = 'admin' OR is_admin = TRUE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin_user IS 'Check if a user is an admin. Works with both role and is_admin columns.';

-- =============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- =============================================================================
-- Run these after migration to verify everything is set up correctly:
--
-- -- Check profiles has both role and is_admin:
-- SELECT id, email, role, is_admin FROM profiles LIMIT 5;
--
-- -- Check alerts table exists and has data:
-- SELECT COUNT(*) FROM alerts;
--
-- -- Check favorites view works:
-- SELECT COUNT(*) FROM favorites;
--
-- -- Check user_activity has compatibility columns:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_activity';
--
-- -- Check user_sessions has compatibility columns:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_sessions';
-- =============================================================================

-- =============================================================================
-- SUMMARY OF CHANGES
-- =============================================================================
-- 1. Added is_admin GENERATED column to profiles (computed from role='admin')
-- 2. Created alerts table (canonical name used by API routes)
-- 3. Created favorites view pointing to user_favorites
-- 4. Added search_query and duration_seconds to user_activity
-- 5. Added device info columns to user_sessions
-- 6. Created is_admin_user() helper function
-- =============================================================================
