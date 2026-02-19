-- =============================================================================
-- FIX USER REGISTRATION TRIGGER
-- Improves handle_new_user() to dynamically find the Agency ID.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_restaurant_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    target_agency_id UUID;
BEGIN
    -- Extract metadata with defaults
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
    user_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.raw_user_meta_data->>'businessName', 'My Restaurant');

    -- 1. DYNAMICALLY FIND AGENCY ID
    -- First try to find "Default Agency"
    SELECT id INTO target_agency_id FROM public.agencies WHERE name = 'Default Agency' LIMIT 1;
    
    -- If not found, pick the first active agency
    IF target_agency_id IS NULL THEN
        SELECT id INTO target_agency_id FROM public.agencies ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- If still null, we have a critical data issue (no agencies). 
    -- We can't insert a restaurant without an agency.
    IF target_agency_id IS NULL THEN
        RAISE EXCEPTION 'No Agency found in database. Cannot create restaurant for user.';
    END IF;

    -- 2. CREATE RESTAURANT (for restaurant_admin only)
    IF user_role = 'restaurant_admin' THEN
        
        INSERT INTO public.restaurants (name, email, agency_id, status)
        VALUES (
            user_business_name,
            NEW.email,
            target_agency_id, -- Used dynamic ID
            'pending'
        )
        RETURNING id INTO new_restaurant_id;
        
        -- Create user profile linked to restaurant
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (
            NEW.id,
            'restaurant_admin',
            FALSE, 
            user_business_name,
            new_restaurant_id
        );

        -- Update auth.users metadata for RLS
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'restaurant_id', new_restaurant_id, 
                'role', 'restaurant_admin',
                'agency_id', target_agency_id -- Useful to have
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

        -- Update auth.users metadata
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', user_role)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
