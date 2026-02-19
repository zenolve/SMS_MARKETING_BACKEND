
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import json

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- Checking User Profile & Metadata ---")
# Get user profile
profiles = supabase.table("user_profiles").select("*").execute()
target_profile = None
for p in profiles.data:
    if p['business_name'] == 'fastnucesstudent@gmail.com':
        target_profile = p
        break

if target_profile:
    print(f"User Profile Found:")
    print(f" - ID: {target_profile['id']}")
    print(f" - Role: {target_profile['role']}")
    print(f" - Business Name: {target_profile['business_name']}")
    
    # Now check auth.users metadata (WE CAN'T DO THIS DIRECTLY VIA SUPABASE CLIENT USUALLY)
    # But we can infer it from the profile if the trigger worked, or just rely on the profile for now.
    # The RLS uses auth.jwt() -> app_metadata -> role.
    # If the user logged out and back in, the JWT should be updated based on auth.users metadata.
    # We can't easily check auth.users via the client without admin API which might be restricted or tricky.
    # BUT, we can check if the profile role is 'agency_admin'.
    
    if target_profile['role'] != 'agency_admin':
        print("\nCRITICAL: User role is NOT 'agency_admin'. The promotion script didn't work or wasn't run.")
    else:
        print("\nSUCCESS: User profile role is 'agency_admin'.")
        print("If creation still fails, it might be due to:")
        print("1. User didn't log out/in (JWT still has old role).")
        print("2. auth.users metadata wasn't updated (trigger/script issue).")
        print("3. Frontend is sending wrong Agency ID.")
else:
    print("User profile not found.")

print("\n--- Checking Agencies ---")
agencies = supabase.table("agencies").select("*").execute()
if agencies.data:
    print(f"Agencies available: {len(agencies.data)}")
    for a in agencies.data:
        print(f" - ID: {a['id']} | Name: {a['name']}")
else:
    print("No agencies found. This might be why creation fails (FK constraint).")
