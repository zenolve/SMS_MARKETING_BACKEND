-- =============================================================================
-- FIX USER MANAGEMENT V3 (Ultra-Safe Version)
-- =============================================================================

-- Drop everything to restart clean
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_entity_id UUID;
    user_role TEXT;
    user_business_name TEXT;
    default_agency_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- 1. Safe Variable Assignment
    BEGIN
        user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
        -- Use simple string concatenation instead of split_part to be safer
        user_business_name := COALESCE(
            NEW.raw_user_meta_data->>'business_name', 
            NEW.raw_user_meta_data->>'businessName', 
            'My Business'
        );
    EXCEPTION WHEN OTHERS THEN
        user_role := 'restaurant_admin';
        user_business_name := 'My Business';
    END;

    -- 2. Logic Branch
    IF user_role = 'restaurant_admin' THEN
        
        -- Ensure Default Agency Exists (Handling potential race conditions)
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM public.agencies WHERE id = default_agency_id) THEN
                INSERT INTO public.agencies (id, name, email, status)
                VALUES (default_agency_id, 'Default Agency', 'admin@smsplatform.com', 'active')
                ON CONFLICT (id) DO NOTHING;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If this fails, we can't create restaurant. Log and raise.
            RAISE EXCEPTION 'Failed to ensure default agency: %', SQLERRM;
        END;

        -- Create Restaurant
        BEGIN
            INSERT INTO public.restaurants (name, email, agency_id, status)
            VALUES (user_business_name, NEW.email, default_agency_id, 'pending')
            RETURNING id INTO new_entity_id;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to create restaurant record: %', SQLERRM;
        END;

        -- Create User Profile
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, 'restaurant_admin', FALSE, user_business_name, new_entity_id);

    ELSIF user_role = 'agency_admin' THEN
        
        -- Create Agency
        INSERT INTO public.agencies (name, email, status)
        VALUES (user_business_name, NEW.email, 'active')
        RETURNING id INTO new_entity_id;

        -- Create User Profile
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, 'agency_admin', FALSE, user_business_name, NULL);

    ELSE
        -- Create User Profile (Superadmin/Other)
        INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
        VALUES (NEW.id, user_role, FALSE, user_business_name, NULL);
    END IF;

    -- NOTE: Removed UPDATE auth.users to prevent potential recursion/locking issues.
    -- The application should rely on user_profiles lookup or a separate periodic sync.
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Critical error in handle_new_user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
