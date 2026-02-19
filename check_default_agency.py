
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- Checking Default Agency ---")
default_id = '00000000-0000-0000-0000-000000000001'
res = supabase.table("agencies").select("*").eq("id", default_id).execute()

if res.data:
    print(f"FOUND: Default Agency exists. ID: {res.data[0]['id']}")
else:
    print(f"MISSING: Default Agency {default_id} NOT FOUND.")
    
    # List any other agencies
    all_agencies = supabase.table("agencies").select("*").limit(5).execute()
    print(f"Other Agencies found: {len(all_agencies.data)}")
    for a in all_agencies.data:
        print(f" - {a['id']} ({a['name']})")
