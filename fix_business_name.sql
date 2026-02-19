-- =============================================================================
-- FIX BUSINESS NAME POPULATION & BACKFILL DATA
-- Run this script in the Supabase SQL Editor
-- =============================================================================

-- 1. Redefine the function with verbose logging and robust checks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_restaurant_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    meta_business_name TEXT;
    meta_business_name_camel TEXT;
BEGIN
    -- Extract values with explicit logging (visible in Supabase logs)
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
    
    meta_business_name := NEW.raw_user_meta_data->>'business_name';
    meta_business_name_camel := NEW.raw_user_meta_data->>'businessName';
    
    -- Robust selection logic
    IF meta_business_name IS NOT NULL AND meta_business_name <> '' THEN
        user_business_name := meta_business_name;
    ELSIF meta_business_name_camel IS NOT NULL AND meta_business_name_camel <> '' THEN
        user_business_name := meta_business_name_camel;
    ELSE
        user_business_name := 'My Restaurant';
    END IF;

    -- For restaurant_admin role, create a restaurant automatically
    IF user_role = 'restaurant_admin' THEN
        -- Create the restaurant first
        INSERT INTO restaurants (name, email, agency_id, status)
        VALUES (
            user_business_name,
            NEW.email,
            '00000000-0000-0000-0000-000000000001', -- Default agency ID
            'pending'
        )
        RETURNING id INTO new_restaurant_id;
        
        -- Create user profile with restaurant link
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            'restaurant_admin',
            FALSE, -- Admin approval required
            user_business_name,
            new_restaurant_id
        );

        -- Update auth.users metadata with restaurant_id for JWT claims
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'restaurant_id', new_restaurant_id, 
                'role', 'restaurant_admin'
            )
        WHERE id = NEW.id;

    ELSE
        -- For other roles (agency_admin, superadmin)
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            user_role,
            FALSE,
            user_business_name,
            NULL
        );

        -- Update auth.users metadata for role
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', user_role)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Backfill missing business names from Restaurants table
-- If we have a link to a restaurant, use its name
UPDATE public.user_profiles up
SET business_name = r.name
FROM public.restaurants r
WHERE up.restaurant_id = r.id
  AND (up.business_name IS NULL OR up.business_name = 'My Restaurant');

-- 3. Fix any remaining NULLs with a default (e.g. for agency admins without restaurant)
UPDATE public.user_profiles
SET business_name = 'Agency Admin'
WHERE business_name IS NULL AND role = 'agency_admin';

UPDATE public.user_profiles
SET business_name = 'Pending Setup'
WHERE business_name IS NULL;
