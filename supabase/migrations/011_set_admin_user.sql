-- =============================================================================
-- Set Admin User
-- =============================================================================
-- Migration: 011_set_admin_user.sql
-- Description: Sets christoph.hill@gmail.com as admin
-- =============================================================================

-- Update existing profile if it exists
UPDATE profiles
SET role = 'admin'
WHERE email = 'christoph.hill@gmail.com';

-- Also update is_admin flag if the column exists (for compatibility)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'is_admin'
    ) THEN
        UPDATE profiles SET is_admin = true WHERE email = 'christoph.hill@gmail.com';
    END IF;
END $$;

-- Create a function to auto-set admin for this email on new signups
CREATE OR REPLACE FUNCTION set_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email = 'christoph.hill@gmail.com' THEN
        NEW.role := 'admin';
        -- Also set is_admin if the column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'profiles' AND column_name = 'is_admin'
        ) THEN
            NEW.is_admin := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS check_admin_email ON profiles;
CREATE TRIGGER check_admin_email
    BEFORE INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_admin_on_signup();
