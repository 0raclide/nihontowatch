-- =============================================================================
-- Fix Admin User Email
-- =============================================================================
-- Migration: 013_fix_admin_email.sql
-- Description: Sets christoph.hill0@gmail.com (with 0) as admin
-- =============================================================================

-- First, ensure the profile exists for this user (in case it wasn't auto-created)
INSERT INTO profiles (id, email, role, created_at, updated_at)
SELECT
    id,
    email,
    'admin',
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'christoph.hill0@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = NOW();

-- Also update by email in case the profile was created differently
UPDATE profiles
SET role = 'admin', updated_at = NOW()
WHERE email = 'christoph.hill0@gmail.com';

-- Update the trigger function to also check for the correct email
CREATE OR REPLACE FUNCTION set_admin_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for admin emails (both with and without 0)
    IF NEW.email IN ('christoph.hill@gmail.com', 'christoph.hill0@gmail.com') THEN
        NEW.role := 'admin';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
