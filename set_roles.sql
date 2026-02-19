-- =============================================================================
-- ENFORCE USER ROLES SCRIPT
-- Sets the specific roles requested by the user.
-- =============================================================================

-- IMPORTANT: This script assumes 'business_name' matches the email or was set to it.
-- If business_name is different, these updates might not find the user.
-- We use a "best effort" match using ILIKE for email addresses in business_name.

-- 1. Set l243071@lhr.nu.edu.pk to AGENCY ADMIN
UPDATE public.user_profiles
SET role = 'agency_admin'
WHERE business_name ILIKE '%l243071@lhr.nu.edu.pk%';

-- 2. Set malikabdullah1786@gmail.com to SUPERADMIN
UPDATE public.user_profiles
SET role = 'superadmin', is_verified = TRUE
WHERE business_name ILIKE '%malikabdullah1786@gmail.com%';

-- 3. Set fastnucesstudent@gmail.com to RESTAURANT ADMIN
-- (This user was previously promoted to agency_admin, now we downgrade as requested)
UPDATE public.user_profiles
SET role = 'restaurant_admin'
WHERE business_name ILIKE '%fastnucesstudent@gmail.com%';


-- =============================================================================
-- SYNC TO AUTH.USERS METADATA (REQUIRED FOR RLS)
-- =============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, role FROM public.user_profiles WHERE business_name ILIKE '%@%'
    LOOP
        -- Update the auth metadata for each user found
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', r.role)
        WHERE id = r.id;
        
        RAISE NOTICE 'Synced role % for user %', r.role, r.id;
    END LOOP;
END $$;
