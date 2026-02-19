-- =============================================================================
-- FIX USER MANAGEMENT & DATA POPULATION
-- =============================================================================

-- 1. UPDATE handle_new_user FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_entity_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    user_email_prefix TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
    
    -- Extract name from email as fallback (e.g. "john" from "john@example.com")
    user_email_prefix := split_part(NEW.email, '@', 1);
    
    -- Get business name with robust fallbacks
    user_business_name := COALESCE(
        NEW.raw_user_meta_data->>'business_name', 
        NEW.raw_user_meta_data->>'businessName', 
        user_email_prefix || '''s Business'
    );

    -- CASE 1: RESTAURANT ADMIN
    IF user_role = 'restaurant_admin' THEN
        -- Create the restaurant first
        INSERT INTO restaurants (name, email, agency_id, status)
        VALUES (
            user_business_name,
            NEW.email,
            '00000000-0000-0000-0000-000000000001', -- Default agency
            'pending'
        )
        RETURNING id INTO new_entity_id;
        
        -- Create user profile linked to restaurant
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            'restaurant_admin',
            FALSE,
            user_business_name,
            new_entity_id
        );

        -- Update auth metadata
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'restaurant_id', new_entity_id, 
                'role', 'restaurant_admin'
            )
        WHERE id = NEW.id;

    -- CASE 2: AGENCY ADMIN (NEW LOGIC)
    ELSIF user_role = 'agency_admin' THEN
        -- Create the agency first
        INSERT INTO agencies (name, email, status)
        VALUES (
            user_business_name,
            NEW.email,
            'active' 
        )
        RETURNING id INTO new_entity_id;

        -- Create user profile
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            'agency_admin',
            FALSE,
            user_business_name,
            NULL
        );

        -- Update auth metadata with agency_id
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'agency_id', new_entity_id,
                'role', 'agency_admin'
            )
        WHERE id = NEW.id;

    -- CASE 3: OTHERS
    ELSE
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            user_role,
            FALSE,
            user_business_name,
            NULL
        );

        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', user_role)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. BACKFILL DATA FOR EXISTING USERS
-- =============================================================================

-- Fix NULL business_names in user_profiles
UPDATE public.user_profiles 
SET business_name = 'Unnamed Business' 
WHERE business_name IS NULL OR business_name = '';

-- Backfill missing agencies for existing agency_admins
-- This anonymous block checks if an agency exists for each agency_admin email
-- If not, it creates one.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT up.id, u.email, up.business_name 
        FROM public.user_profiles up
        JOIN auth.users u ON up.id = u.id
        WHERE up.role = 'agency_admin'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE email = r.email) THEN
            INSERT INTO public.agencies (name, email, status)
            VALUES (COALESCE(r.business_name, 'My Agency'), r.email, 'active');
        END IF;
    END LOOP;
END $$;
