-- =============================================================================
-- DATABASE SCHEMA UPDATE SCRIPT (v2)
-- Run this script in the Supabase SQL Editor to fix missing columns
-- =============================================================================

-- 1. Add 'twilio_account_sid' to 'agencies' table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agencies' AND column_name = 'twilio_account_sid'
    ) THEN
        ALTER TABLE public.agencies ADD COLUMN twilio_account_sid TEXT;
        RAISE NOTICE 'Added twilio_account_sid to agencies table';
    ELSE
        RAISE NOTICE 'twilio_account_sid already exists in agencies table';
    END IF;
END $$;

-- 2. Add 'spending_limit_monthly' to 'restaurants' table if it doesn't exist
-- Note: There was a 'monthly_sms_limit' (integer), but code uses 'spending_limit_monthly' (decimal/float)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurants' AND column_name = 'spending_limit_monthly'
    ) THEN
        ALTER TABLE public.restaurants ADD COLUMN spending_limit_monthly DECIMAL(10, 2);
        RAISE NOTICE 'Added spending_limit_monthly to restaurants table';
    ELSE
        RAISE NOTICE 'spending_limit_monthly already exists in restaurants table';
    END IF;
END $$;

-- 3. Verify changes
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE (table_name = 'agencies' AND column_name = 'twilio_account_sid')
   OR (table_name = 'restaurants' AND column_name = 'spending_limit_monthly');
