
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import time
import random

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

random_int = random.randint(10000, 99999)
test_email = f"test.user.{random_int}@example.com"
test_password = "Password123!"
test_business = "Auto Created Restaurant"

print(f"--- Testing User Registration: {test_email} ---")

try:
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
        # Print error details if available? Auth doesn't usually return error in success object
        # but supabase-py raises exception on error usually.
    else:
        user_id = auth_response.user.id
        print(f"User Created: {user_id}")
        
        print("Waiting for trigger execution...")
        time.sleep(3)
        
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
                    print("SUCCESS: Full registration flow confirmed.")
                else:
                    print("FAILED: Restaurant record missing.")
            else:
                 print("FAILED: No restaurant_id in profile.")
        else:
            print("FAILED: Trigger did not create user_profile.")

except Exception as e:
    print(f"ERROR: {e}")
