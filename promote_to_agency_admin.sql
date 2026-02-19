-- =============================================================================
-- PROMOTE USER TO AGENCY ADMIN
-- This enables "Add Restaurant" functionality by bypassing RLS restrictions.
-- =============================================================================

-- 1. Update the public profile
UPDATE public.user_profiles
SET role = 'agency_admin'
WHERE business_name = 'fastnucesstudent@gmail.com';  -- Using business_name as identifier

-- 2. Update the auth.users metadata logic (CRITICAL for RLS)
-- We need to find the user ID first to update auth.users
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id
    FROM public.user_profiles
    WHERE business_name = 'fastnucesstudent@gmail.com'
    LIMIT 1;

    IF target_user_id IS NOT NULL THEN
        -- Update the auth metadata so the JWT gets the new role on next login
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', 'agency_admin')
        WHERE id = target_user_id;
        
        RAISE NOTICE 'User % promoted to agency_admin successfully.', target_user_id;
    ELSE
        RAISE EXCEPTION 'User not found!';
    END IF;
END $$;
