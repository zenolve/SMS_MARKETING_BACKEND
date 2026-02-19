-- =============================================================================
-- DEBUGGING SETUP: LOG TABLE + FAIL-SAFE TRIGGER
-- =============================================================================

-- 1. Create a logs table
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update Trigger to LOG errors instead of failing
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
        -- Extract metadata
        user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
        user_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.raw_user_meta_data->>'businessName', 'My Restaurant');
        user_phone := NEW.raw_user_meta_data->>'phone';
        user_status := COALESCE(NEW.raw_user_meta_data->>'status', 'pending');

        -- Log start
        INSERT INTO public.debug_logs (message, details) 
        VALUES ('Trigger Started', 'Email: ' || NEW.email || ', Role: ' || user_role);

        IF user_role = 'restaurant_admin' THEN
            -- Create the restaurant
            INSERT INTO public.restaurants (name, email, phone, agency_id, status)
            VALUES (
                user_business_name,
                NEW.email,
                user_phone, 
                '00000000-0000-0000-0000-000000000001', 
                user_status 
            )
            RETURNING id INTO new_restaurant_id;
            
            -- Create user profile
            INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
            VALUES (
                NEW.id,
                'restaurant_admin',
                FALSE, 
                user_business_name,
                new_restaurant_id
            );

            -- Update identity metadata
            UPDATE auth.users
            SET raw_app_meta_data = 
                COALESCE(raw_app_meta_data, '{}'::jsonb) || 
                jsonb_build_object(
                    'restaurant_id', new_restaurant_id, 
                    'role', 'restaurant_admin'
                )
            WHERE id = NEW.id;

        ELSE
            -- Other roles
            INSERT INTO public.user_profiles (id, role, is_verified, business_name, restaurant_id)
            VALUES (NEW.id, user_role, FALSE, user_business_name, NULL);
            
            UPDATE auth.users
            SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', user_role)
            WHERE id = NEW.id;
        END IF;

        INSERT INTO public.debug_logs (message, details) VALUES ('Trigger Success', 'User ID: ' || NEW.id);
        
    EXCEPTION WHEN OTHERS THEN
        -- LOG THE ERROR and CONTINUE (Do not abort transaction)
        INSERT INTO public.debug_logs (message, details) 
        VALUES ('TRIGGER ERROR', 'SQLERRM: ' || SQLERRM || ' | XT: ' || SQLSTATE);
        
        -- We must return NEW so the user is still created provided the error wasn't in the initial INSERT
        -- (Wait, this is AFTER INSERT trigger, so user is already inserted. We just prevent rollback.)
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
