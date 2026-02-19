
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import time
from uuid import uuid4

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

# Unique email for testing
test_email = f"test_reg_{int(time.time())}@example.com"
test_password = "Password123!"
test_business = "Auto Created Restaurant"

print(f"--- Testing User Registration: {test_email} ---")

try:
    # 1. Sign up user (simulating frontend)
    # Metadata is crucial for the trigger
    auth_response = supabase.auth.sign_up({
        "email": test_email,
        "password": test_password,
        "options": {
            "data": {
                "business_name": test_business,
                "role": "restaurant_admin"
            }
        }
    })
    
    if not auth_response.user:
        print("FAILED: Signup returned no user.")
        exit(1)
        
    user_id = auth_response.user.id
    print(f"User Created: {user_id}")
    
    # 2. Check Database for side effects (Trigger execution)
    print("Waiting for trigger execution...")
    time.sleep(2)
    
    # Check Profile
    profile = supabase.table("user_profiles").select("*").eq("id", user_id).execute()
    if profile.data:
        p = profile.data[0]
        print(f"✓ Profile Created. Role: {p['role']}")
        
        restaurant_id = p.get('restaurant_id')
        if restaurant_id:
            print(f"✓ Restaurant ID linked: {restaurant_id}")
            
            # Check Restaurant
            rest = supabase.table("restaurants").select("*").eq("id", restaurant_id).execute()
            if rest.data:
                r = rest.data[0]
                print(f"✓ Restaurant Found: {r['name']}")
                print(f"  Agency ID: {r['agency_id']}")
                if r['name'] == test_business:
                    print("SUCCESS: Full registration flow working.")
                else:
                    print(f"WARNING: Restaurant name mismatch. Expected '{test_business}', got '{r['name']}'")
            else:
                print("FAILED: Restaurant ID is in profile, but restaurant record missing.")
        else:
             print("FAILED: No restaurant_id in profile (Trigger might have failed to create restaurant).")
    else:
        print("FAILED: No user_profile found (Trigger failed completely).")

    # Cleanup
    # print("Cleaning up...")
    # supabase.auth.admin.delete_user(user_id) # Requires service role key to be admin capable for this func usually

except Exception as e:
    print(f"ERROR: {e}")
