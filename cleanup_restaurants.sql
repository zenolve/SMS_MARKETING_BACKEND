-- =============================================================================
-- CLEANUP SCRIPT
-- Deletes ALL restaurants (and their data) EXCEPT 'fastnucesstudent@gmail.com'
-- =============================================================================

-- 1. Delete all restaurants except the one with ID: 3523b572...
-- NOTE: Due to ON DELETE CASCADE settings in the schema, this will automatically
-- delete linked customers, campaigns, messages, and usage records.
-- User profiles linked to deleted restaurants will have restaurant_id set to NULL.

DELETE FROM public.restaurants
WHERE id != '3523b572-6b73-4ad6-973e-d1f3daa94bd1';

-- 2. Optional: Clean up orphan user_profiles (users with no restaurant) if needed?
-- The user request was only to delete "restaurant data", so we leave users alone
-- to avoid accidentally deleting valid accounts.
