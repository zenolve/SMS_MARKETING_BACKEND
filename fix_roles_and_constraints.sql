-- =============================================================================
-- MASTER FIX SCRIPT: ROLES & CONSTRAINTS
-- 1. Fixes the "user_profiles_role_check" constraint to allow 'restaurant_admin'.
-- 2. Sets the requested roles for your 3 users.
-- 3. Syncs permissions so you can login without errors.
-- =============================================================================

-- PART 1: FIX THE CONSTRAINT (The root cause of your error)
-- We drop the old strict check and add a new one that includes 'restaurant_admin'.
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_role_check') THEN
        ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
    END IF;

    -- Add corrected constraint
    ALTER TABLE public.user_profiles
    ADD CONSTRAINT user_profiles_role_check
    CHECK (role IN ('superadmin', 'agency_admin', 'restaurant_admin'));
END $$;

-- PART 2: UPDATE USER ROLES (As specifically requested)

-- 2.1 Set l243071@lhr.nu.edu.pk -> AGENCY ADMIN
UPDATE public.user_profiles
SET role = 'agency_admin'
WHERE business_name ILIKE '%l243071@lhr.nu.edu.pk%';

-- 2.2 Set malikabdullah1786@gmail.com -> SUPERADMIN
UPDATE public.user_profiles
SET role = 'superadmin', is_verified = TRUE
WHERE business_name ILIKE '%malikabdullah1786@gmail.com%';

-- 2.3 Set fastnucesstudent@gmail.com -> RESTAURANT ADMIN
UPDATE public.user_profiles
SET role = 'restaurant_admin'
WHERE business_name ILIKE '%fastnucesstudent@gmail.com%';


-- PART 3: SYNC METADATA (Required for login permissions)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, role FROM public.user_profiles WHERE business_name ILIKE '%@%'
    LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', r.role)
        WHERE id = r.id;
    END LOOP;
END $$;
