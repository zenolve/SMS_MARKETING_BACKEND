-- =============================================================================
-- SMS MARKETING PLATFORM - COMPLETE DATABASE SETUP
-- Run this ENTIRE script in Supabase SQL Editor (IN ORDER)
-- =============================================================================
-- Version: 1.1 (Fixed index creation order)
-- Last Updated: 2026-02-04
-- =============================================================================

-- =============================================================================
-- STEP 0: CLEANUP (Drop existing tables if fresh install)
-- Uncomment these lines ONLY if you want to start completely fresh
-- =============================================================================
-- DROP TABLE IF EXISTS public.usage_records CASCADE;
-- DROP TABLE IF EXISTS public.sms_messages CASCADE;
-- DROP TABLE IF EXISTS public.campaigns CASCADE;
-- DROP TABLE IF EXISTS public.customers CASCADE;
-- DROP TABLE IF EXISTS public.user_profiles CASCADE;
-- DROP TABLE IF EXISTS public.restaurants CASCADE;
-- DROP TABLE IF EXISTS public.agencies CASCADE;

-- =============================================================================
-- PART 1: CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 AGENCIES TABLE (Multi-tenant support)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default agency (required for restaurant signup)
INSERT INTO public.agencies (id, name, email, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Agency', 'admin@smsplatform.com', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 1.2 RESTAURANTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'suspended', 'pending')),
    twilio_phone_number TEXT,
    twilio_messaging_service_sid TEXT,
    monthly_sms_limit INTEGER DEFAULT 10000,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1.3 USER PROFILES TABLE (Authentication & Authorization)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'agency_admin', 'restaurant_admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    business_name TEXT,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1.4 CUSTOMERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    opt_in_status TEXT DEFAULT 'pending' CHECK (opt_in_status IN ('opted_in', 'opted_out', 'pending')),
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    last_visit TIMESTAMPTZ,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_restaurant_phone'
    ) THEN
        ALTER TABLE public.customers ADD CONSTRAINT unique_restaurant_phone UNIQUE (restaurant_id, phone);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1.5 CAMPAIGNS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    message_template TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed')),
    
    -- Scheduling
    schedule_type TEXT DEFAULT 'one_time' CHECK (schedule_type IN ('one_time', 'recurring')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',
    
    -- Targeting
    segment_criteria JSONB DEFAULT '{}',
    
    -- Statistics
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    
    -- Twilio tracking
    twilio_message_sids TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1.6 SMS MESSAGES TABLE (Individual message tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Message details
    to_phone TEXT NOT NULL,
    from_phone TEXT,
    message_body TEXT NOT NULL,
    
    -- Twilio tracking
    twilio_sid TEXT,
    twilio_status TEXT,
    twilio_error_code TEXT,
    twilio_error_message TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'cancelled')),
    cost DECIMAL(10, 4) DEFAULT 0,
    segments INTEGER DEFAULT 1,
    
    -- Timestamps
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 1.7 USAGE RECORDS TABLE (Monthly billing tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Usage metrics
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    total_cost DECIMAL(10, 4) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_restaurant_period'
    ) THEN
        ALTER TABLE public.usage_records ADD CONSTRAINT unique_restaurant_period UNIQUE (restaurant_id, period_start);
    END IF;
END $$;


-- =============================================================================
-- PART 1.5: CREATE INDEXES (After all tables exist)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_restaurants_agency ON public.restaurants(agency_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_restaurant_id ON public.user_profiles(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant ON public.customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customers_opt_in ON public.customers(opt_in_status);
CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant ON public.campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sms_messages_campaign ON public.sms_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_restaurant ON public.sms_messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid ON public.sms_messages(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_usage_records_restaurant ON public.usage_records(restaurant_id);

-- GIN index for tags array
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_tags'
    ) THEN
        CREATE INDEX idx_customers_tags ON public.customers USING GIN(tags);
    END IF;
END $$;


-- =============================================================================
-- PART 2: ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2.1 Helper function to check superadmin (avoids recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.user_profiles WHERE id = auth.uid();
    RETURN user_role = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 2.2 USER PROFILES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Superadmin can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Superadmin can delete profiles" ON public.user_profiles;

CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Superadmin can view all profiles" ON public.user_profiles
    FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmin can update profiles" ON public.user_profiles
    FOR UPDATE USING (public.is_superadmin());

CREATE POLICY "Superadmin can delete profiles" ON public.user_profiles
    FOR DELETE USING (public.is_superadmin());

-- -----------------------------------------------------------------------------
-- 2.3 RESTAURANTS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Superadmin can view all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Admin/Agency can view all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can update own restaurant" ON public.restaurants;

CREATE POLICY "Users can view own restaurant" ON public.restaurants
    FOR SELECT USING (
        id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
        OR
        id IN (SELECT restaurant_id FROM public.user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Users can insert restaurants" ON public.restaurants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own restaurant" ON public.restaurants
    FOR UPDATE USING (
        id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- -----------------------------------------------------------------------------
-- 2.4 CUSTOMERS POLICIES  
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own customers" ON public.customers;

CREATE POLICY "Users can manage own customers" ON public.customers
    FOR ALL USING (
        restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- -----------------------------------------------------------------------------
-- 2.5 CAMPAIGNS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;

CREATE POLICY "Users can manage own campaigns" ON public.campaigns
    FOR ALL USING (
        restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- -----------------------------------------------------------------------------
-- 2.6 SMS MESSAGES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own messages" ON public.sms_messages;

CREATE POLICY "Users can view own messages" ON public.sms_messages
    FOR ALL USING (
        restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- -----------------------------------------------------------------------------
-- 2.7 USAGE RECORDS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own usage" ON public.usage_records;

CREATE POLICY "Users can view own usage" ON public.usage_records
    FOR SELECT USING (
        restaurant_id = (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'agency_admin')
    );

-- -----------------------------------------------------------------------------
-- 2.8 AGENCIES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view agencies" ON public.agencies;

CREATE POLICY "Users can view agencies" ON public.agencies
    FOR SELECT USING (true);


-- =============================================================================
-- PART 3: FUNCTIONS & TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 AUTO-CREATE USER PROFILE ON SIGNUP
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_restaurant_id UUID;
    user_role TEXT;
    user_business_name TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'restaurant_admin');
    user_business_name := COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.raw_user_meta_data->>'businessName', 'My Restaurant');

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

        -- KEY CHANGE: Update auth.users metadata with restaurant_id for JWT claims
        -- This allows RLS policies to use (auth.jwt() -> 'app_metadata' ->> 'restaurant_id')
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object(
                'restaurant_id', new_restaurant_id, 
                'role', 'restaurant_admin'
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

        -- Update auth.users metadata for role only
        UPDATE auth.users
        SET raw_app_meta_data = 
            COALESCE(raw_app_meta_data, '{}'::jsonb) || 
            jsonb_build_object('role', user_role)
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3.2 HELPER FUNCTIONS FOR FRONTEND
-- -----------------------------------------------------------------------------

-- Get current user's profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
    id UUID, 
    role TEXT, 
    is_verified BOOLEAN, 
    business_name TEXT,
    restaurant_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT up.id, up.role, up.is_verified, up.business_name, up.restaurant_id
    FROM public.user_profiles up WHERE up.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current user's restaurant ID
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT restaurant_id FROM public.user_profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 3.3 CAMPAIGN STATISTICS FUNCTIONS
-- -----------------------------------------------------------------------------

-- Increment sent count
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns 
    SET total_sent = total_sent + 1 
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Increment delivered count
CREATE OR REPLACE FUNCTION increment_campaign_delivered(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns 
    SET total_delivered = total_delivered + 1 
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Increment failed count
CREATE OR REPLACE FUNCTION increment_campaign_failed(campaign_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE campaigns 
    SET total_failed = total_failed + 1 
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Add to campaign cost
CREATE OR REPLACE FUNCTION add_campaign_cost(campaign_id UUID, cost_to_add DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE campaigns 
    SET total_cost = total_cost + cost_to_add 
    WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 3.4 UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER update_restaurants_updated_at
    BEFORE UPDATE ON public.restaurants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- PART 4: VERIFICATION
-- =============================================================================

-- Check all tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('agencies', 'restaurants', 'user_profiles', 'customers', 'campaigns', 'sms_messages', 'usage_records');
    
    RAISE NOTICE '✓ Created % tables successfully', table_count;
END $$;


-- =============================================================================
-- NEXT STEPS AFTER RUNNING THIS SCRIPT:
-- =============================================================================
-- 1. Create a superadmin user in Authentication > Users
-- 2. Run this to make them superadmin:
--    UPDATE public.user_profiles 
--    SET role = 'superadmin', is_verified = true 
--    WHERE id = '<USER_ID>';
--
-- 3. Disable email confirmation:
--    Authentication > Providers > Email > Turn OFF "Confirm email"
-- =============================================================================
