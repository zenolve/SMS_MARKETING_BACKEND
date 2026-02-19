import asyncio
import os
import traceback
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    if os.path.exists(".env.local"):
        load_dotenv(".env.local")
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("ERROR: Keys not found.")
    exit(1)

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"Error init supabase: {e}")
    exit(1)

async def verify_fix():
    print("Verifying Business Name Fix...")
    
    # Check for any NULL business names in user_profiles
    print("Checking for NULL business_name in user_profiles...")
    res = supabase.table("user_profiles").select("*").is_("business_name", "null").execute()
    
    if res.data:
        print(f"FAILURE: Found {len(res.data)} profiles with NULL business_name.")
        for p in res.data:
            print(f" - ID: {p['id']}, Role: {p['role']}")
    else:
        print("SUCCESS: No NULL business_name found!")

    # Check specific restaurant admin
    print("\nChecking sample restaurant admins...")
    res = supabase.table("user_profiles").select("business_name, role").eq("role", "restaurant_admin").limit(5).execute()
    for p in res.data:
        print(f" - Role: {p['role']}, Business Name: {p['business_name']}")
        if not p['business_name'] or p['business_name'] == 'My Restaurant':
             print("   (Note: 'My Restaurant' might be default if no name provided)")

if __name__ == "__main__":
    import time
    asyncio.run(verify_fix())
    time.sleep(1)
