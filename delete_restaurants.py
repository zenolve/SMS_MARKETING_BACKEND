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

print("--- Deleting All Restaurants ---")
try:
    # Delete all restaurants (neq is not equal, so creating a condition that is always true or finding all)
    # Supabase-py doesn't have a 'delete all' without filter usually, need a filter.
    # We can filter by id is not null.
    
    # First count
    res = supabase.table("restaurants").select("*", count="exact").execute()
    print(f"Found {len(res.data)} restaurants to delete.")
    
    if len(res.data) > 0:
        # Delete each one or use a broad filter
        # Since 'status' is a field, let's delete all where status is in ['active', 'pending', 'suspended']
        # Or simply delete where id is not null (neq)
        
        # Using a loop to be safe and simple if bulk delete has issues, but bulk is better.
        # Let's try deleting where ID is not null (hacky way: id neq '00000000-0000-0000-0000-000000000000')
        
        for r in res.data:
            print(f"Deleting restaurant: {r['name']} ({r['id']})")
            supabase.table("restaurants").delete().eq("id", r['id']).execute()
            
        print("✅ All restaurants deleted.")
    else:
        print("No restaurants to delete.")

except Exception as e:
    print(f"❌ Error deleting restaurants: {e}")
