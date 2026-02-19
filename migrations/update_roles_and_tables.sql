-- Rename campaigns to scheduled_campaigns as per PRD
ALTER TABLE IF EXISTS public.campaigns RENAME TO scheduled_campaigns;

-- 1. Update existing roles from restaurant_admin to restaurant_manager FIRST
UPDATE public.user_profiles SET role = 'restaurant_manager' WHERE role = 'restaurant_admin';

-- 2. Drop old constraint and add new one
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('superadmin', 'agency_admin', 'restaurant_manager'));

-- Update handle_new_user trigger function for the new role name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_restaurant_id UUID;
    user_role TEXT;
    user_business_name TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_manager');
    user_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.raw_user_meta_data->>'businessName', 'My Restaurant');

    -- For restaurant_manager role, create a restaurant automatically
    IF user_role = 'restaurant_manager' THEN
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
            'restaurant_manager',
            FALSE, -- Admin approval required
            user_business_name,
            new_restaurant_id
        );

        -- Update auth.users metadata with restaurant_id and new role
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'restaurant_id', new_restaurant_id, 
                'role', 'restaurant_manager'
            )
        WHERE id = NEW.id;

    ELSE
        -- For other roles (agency_admin, superadmin), no restaurant needed immediately
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

-- Update RLS policies for scheduled_campaigns
ALTER TABLE public.scheduled_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Restaurant Managers can only see their own campaigns" ON public.scheduled_campaigns;
DROP POLICY IF EXISTS "Agency Admins can see and manage everything" ON public.scheduled_campaigns;

-- 2. Policy for Restaurant Managers (Restricted Access)
CREATE POLICY "Restaurant Managers can only see their own campaigns"
ON public.scheduled_campaigns
FOR ALL
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role' = 'restaurant_manager' 
  AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid)
);

-- 3. Policy for Agency Admins (Unrestricted Access)
CREATE POLICY "Agency Admins can see and manage everything"
ON public.scheduled_campaigns
FOR ALL
USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('agency_admin', 'superadmin')
);

-- Update other tables to ensure agency_admin access
-- Customers
DROP POLICY IF EXISTS "Users can manage own customers" ON public.customers;
CREATE POLICY "Users can manage own customers" ON public.customers
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'restaurant_manager' AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid)
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- SMS Messages
DROP POLICY IF EXISTS "Users can view own messages" ON public.sms_messages;
CREATE POLICY "Users can view own messages" ON public.sms_messages
    FOR ALL USING (
        (auth.jwt() -> 'app_metadata' ->> 'role' = 'restaurant_manager' AND restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid)
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );
