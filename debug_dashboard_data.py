
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import json

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- 1. Fetching ALL User Profiles (Admin View) ---")
users = supabase.table("user_profiles").select("*").execute()
print(f"Total Users: {len(users.data)}")
for u in users.data:
    print(f" - ID: {u['id'][:8]}... | Role: {u['role']} | Business: {u['business_name']} | Verified: {u['is_verified']}")

print("\n--- 2. Fetching ALL Restaurants (Agency View) ---")
restaurants = supabase.table("restaurants").select("*").execute()
print(f"Total Restaurants: {len(restaurants.data)}")
for r in restaurants.data:
    print(f" - ID: {r['id'][:8]}... | Name: {r['name']} | Status: {r['status']} | AgencyID: {r.get('agency_id')}")

print("\n--- 3. Fetching ALL Agencies ---")
agencies = supabase.table("agencies").select("*").execute()
print(f"Total Agencies: {len(agencies.data)}")
for a in agencies.data:
    print(f" - ID: {a['id'][:8]}... | Name: {a['name']}")
