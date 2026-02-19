-- =============================================================================
-- MANUAL TRIGGER TEST
-- Run this in Supabase SQL Editor to see the REAL error message
-- =============================================================================

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test_manual_trigger_' || floor(random() * 10000)::text || '@example.com';
BEGIN
    RAISE NOTICE 'Attempting to insert test user: %', test_email;

    -- Insert into auth.users (simulate signup)
    INSERT INTO auth.users (
        id, 
        email, 
        encrypted_password, 
        email_confirmed_at, 
        raw_user_meta_data,
        aud,
        role
    )
    VALUES (
        new_user_id,
        test_email,
        '$2a$10$abcdefg...', -- dummy hash
        now(),
        jsonb_build_object(
            'business_name', 'Manual Test Restaurant',
            'role', 'restaurant_admin',
            'phone', '+15559998888',
            'status', 'active'
        ),
        'authenticated',
        'authenticated'
    );
    
    RAISE NOTICE 'User inserted successfully. Trigger should have fired.';
    
    -- Verify restaurant creation
    IF EXISTS (SELECT 1 FROM public.restaurants WHERE email = test_email) THEN
        RAISE NOTICE '✅ SUCCESS: Restaurant created!';
    ELSE
        RAISE EXCEPTION '❌ FAILURE: User created but Restaurant NOT found!';
    END IF;

    -- Cleanup (Rollback so we don't pollute DB)
    RAISE NOTICE 'Rolling back test transaction...';
    RAISE EXCEPTION 'Test Complete (Rollback caused by this exception)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Caught Error: %', SQLERRM;
    RAISE; -- Re-raise to see the stack trace
END $$;
