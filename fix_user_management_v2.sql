-- =============================================================================
-- FIX USER MANAGEMENT V2 (Safe Version)
-- =============================================================================

-- Drop existing trigger and function first to ensure clean state
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_entity_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    user_email_prefix TEXT;
    default_agency_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Safe metadata extraction
    BEGIN
        user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
        user_email_prefix := split_part(NEW.email, '@', 1);
        user_business_name := COALESCE(
            NEW.raw_user_meta_data->>'business_name', 
            NEW.raw_user_meta_data->>'businessName', 
            user_email_prefix || '''s Business'
        );
    EXCEPTION WHEN OTHERS THEN
        user_role := 'restaurant_admin';
        user_business_name := 'My Business';
    END;

    -- Ensure default agency exists for restaurants
    IF user_role = 'restaurant_admin' THEN
        IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE id = default_agency_id) THEN
             INSERT INTO public.agencies (id, name, email, status)
             VALUES (default_agency_id, 'Default Agency', 'admin@smsplatform.com', 'active')
             ON CONFLICT (id) DO NOTHING;
        END IF;

        INSERT INTO public.restaurants (name, email, agency_id, status)
        VALUES (user_business_name, NEW.email, default_agency_id, 'pending')
        RETURNING id INTO new_entity_id;

        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, 'restaurant_admin', FALSE, user_business_name, new_entity_id);

        -- Try to update auth metadata, but don't fail signup if it fails
        BEGIN
            UPDATE auth.users
            SET raw_app_meta_data = 
                COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                jsonb_build_object('restaurant_id', new_entity_id, 'role', 'restaurant_admin')
            WHERE id = NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to update auth metadata for user %', NEW.id;
        END;

    ELSIF user_role = 'agency_admin' THEN
        INSERT INTO public.agencies (name, email, status)
        VALUES (user_business_name, NEW.email, 'active')
        RETURNING id INTO new_entity_id;

        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, 'agency_admin', FALSE, user_business_name, NULL);

        BEGIN
            UPDATE auth.users
            SET raw_app_meta_data = 
                COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                jsonb_build_object('agency_id', new_entity_id, 'role', 'agency_admin')
            WHERE id = NEW.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to update auth metadata for user %', NEW.id;
        END;

    ELSE
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, user_role, FALSE, user_business_name, NULL);
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but try to allow user creation if possible? 
    -- No, if profile creation fails, we should fail the signup to avoid inconsistencies.
    RAISE EXCEPTION 'Database error in handle_new_user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
