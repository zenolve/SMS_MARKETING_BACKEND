
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import json
from uuid import uuid4

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- 1. Checking Agencies ---")
agencies = supabase.table("agencies").select("*").execute()
print(f"Agencies found: {len(agencies.data)}")
agency_id = None
if agencies.data:
    print(f"First Agency: {agencies.data[0]['id']} - {agencies.data[0]['name']}")
    agency_id = agencies.data[0]['id']
else:
    print("CRITICAL: No agencies found!")

print("\n--- 2. Checking User Profile (fastnucesstudent@gmail.com) ---")
# We need to find the user ID first. We can search in user_profiles by business_name if it matches email, or just list all.
# Since we don't have the ID handy, let's list all profiles.
profiles = supabase.table("user_profiles").select("*").execute()
target_user = None
for p in profiles.data:
    # We can't easily see email here (it's in auth.users), but let's check business_name or assume the one we kept is it.
    # The user kept '3523b572-6b73-4ad6-973e-d1f3daa94bd1' linked restaurant.
    if p.get('business_name') == 'fastnucesstudent@gmail.com':
         print(f"Found User Profile: {p['id']} | Role: {p['role']}")
         target_user = p
         break

if not target_user:
    print("User profile for 'fastnucesstudent@gmail.com' not found in public.user_profiles (by business_name match).")
    # Let's print all to be sure
    for p in profiles.data:
        print(f" - {p['id']}: {p['business_name']} ({p['role']})")

print("\n--- 3. Simulating Restaurant Creation (Service Role) ---")
if agency_id:
    test_restaurant = {
        "name": "Debug Test Restaurant",
        "agency_id": agency_id,
        "email": "debug@test.com",
        "phone": "+1234567890",
        "address": "123 Debug Lane",
        "timezone": "UTC",
        "spending_limit_monthly": 1000,
        "status": "active"
    }
    
    try:
        print(f"Attempting to create restaurant linked to Agency {agency_id}...")
        result = supabase.table("restaurants").insert(test_restaurant).execute()
        print("SUCCESS: Restaurant created via Service Role.")
        print(result.data)
        
        # Cleanup
        print("Cleaning up test restaurant...")
        supabase.table("restaurants").delete().eq("id", result.data[0]['id']).execute()
        print("Cleanup done.")
        
    except Exception as e:
        print(f"FAILED to create restaurant: {e}")
else:
    print("Skipping creation test due to missing Agency ID.")
