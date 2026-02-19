-- =============================================================================
-- DEBUG TRIGGER WITH LOGGING
-- Run this to get detailed error messages from the trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_restaurant_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    user_phone TEXT;
    user_status TEXT;
BEGIN
    BEGIN
        -- Extract metadata with defaults
        user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
        user_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.raw_user_meta_data->>'businessName', 'My Restaurant');
        
        -- NEW: Extract phone and status
        user_phone := NEW.raw_user_meta_data->>'phone';
        user_status := COALESCE(NEW.raw_user_meta_data->>'status', 'pending');

        -- For restaurant_admin role, create a restaurant automatically
        IF user_role = 'restaurant_admin' THEN
            -- Create the restaurant first
            INSERT INTO restaurants (name, email, phone, agency_id, status)
            VALUES (
                user_business_name,
                NEW.email,
                user_phone, 
                '00000000-0000-0000-0000-000000000001', 
                user_status 
            )
            RETURNING id INTO new_restaurant_id;
            
            -- Create user profile with restaurant link
            INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
            VALUES (
                NEW.id,
                'restaurant_admin',
                FALSE, 
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

            UPDATE auth.users
            SET raw_app_meta_data = 
                COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                jsonb_build_object('role', user_role)
            WHERE id = NEW.id;
        END IF;
        
        RETURN NEW;
    
    EXCEPTION WHEN OTHERS THEN
        -- Re-raise the error with detail!
        RAISE EXCEPTION 'TRIGGER_ERROR_DEBUG: % (State: %)', SQLERRM, SQLSTATE;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
