import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: Missing env vars")
    exit(1)

supabase: Client = create_client(url, key)

print("--- Checking Default Agency ---")
try:
    res = supabase.table("agencies").select("*").eq("id", "00000000-0000-0000-0000-000000000001").execute()
    if res.data:
        print("✅ Default Agency found:", res.data[0])
    else:
        print("❌ Default Agency NOT found! This will cause the trigger to fail.")
        
        # Attempt to fix
        print("Attempting to create Default Agency...")
        agency_data = {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Default Agency",
            "email": "admin@smsplatform.com",
            "status": "active"
        }
        res_ins = supabase.table("agencies").insert(agency_data).execute()
        print("Created Default Agency:", res_ins.data)

except Exception as e:
    print(f"Error checking agency: {e}")

print("\n--- Checking Restaurants ---")
try:
    res = supabase.table("restaurants").select("*").limit(5).execute()
    print(f"Found {len(res.data)} restaurants.")
except Exception as e:
    print(f"Error checking restaurants: {e}")

except Exception as e:
    print(f"Error checking restaurants: {e}")

except Exception as e:
    print(f"Error checking restaurants: {e}")

import random
print("\n--- Testing Trigger ---")
rand_int = random.randint(1000, 9999)
test_email = f"test_trigger_debug_{rand_int}@example.com"
test_pass = "password123"

try:
    # Try creating user
    attr = {
        "email": test_email,
        "password": test_pass,
        "email_confirm": True,
        "user_metadata": {
            "business_name": "Test Restaurant Debug",
            "role": "restaurant_admin",
            "phone": "+15550000000",
            "status": "active"
        }
    }
    print(f"Creating user {test_email}...")
    user = supabase.auth.admin.create_user(attr)
    print("✅ User created successfully:", user.user.id)
    
    # Check restaurant
    res = supabase.table("restaurants").select("*").eq("email", test_email).execute()
    if res.data:
        print("✅ Restaurant created via trigger: ID=", res.data[0]['id'])
        # Cleanup
        print("Cleaning up user...")
        supabase.auth.admin.delete_user(user.user.id)
        # Manually delete restaurant just in case
        print("Cleaning up restaurant...")
        supabase.table("restaurants").delete().eq("id", res.data[0]['id']).execute()
        print("Cleanup done.")
    else:
        print("❌ User created but Restaurant NOT found!")
        # Attempt cleanup of user
        supabase.auth.admin.delete_user(user.user.id)

except Exception as e:
    with open("error.log", "w") as f:
        f.write(str(e))
    print(f"❌ Error creating user/trigger failed: {e}")

# ALWAYS Read Debug Logs
print("\n--- Reading Debug Logs ---")
try:
    # Get last 5 logs
    logs = supabase.table("debug_logs").select("*").order("created_at", desc=True).limit(5).execute()
    with open("debug_logs_dump.txt", "w") as f:
        for log in logs.data:
            entry = f"[{log['created_at']}] {log['message']}: {log['details']}\n"
            print(entry.strip())
            f.write(entry)
except Exception as e:
    print(f"Error reading logs: {e}")
