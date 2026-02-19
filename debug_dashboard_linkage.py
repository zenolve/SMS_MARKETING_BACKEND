
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- Checking Restaurant <-> User Linkage ---")

# 1. Get all restaurants
restaurants = supabase.table("restaurants").select("id, name, agency_id").execute().data
print(f"Total Restaurants: {len(restaurants)}")

# 2. Get all user_profiles
users = supabase.table("user_profiles").select("id, role, business_name, restaurant_id").execute().data
print(f"Total Users: {len(users)}")

# 3. Analyze Linkage
restaurant_map = {r['id']: r for r in restaurants}
user_map = {u['id']: u for u in users}

print("\n--- Restaurants without a Linked User (by restaurant_id in user_profiles) ---")
# Find restaurants that are NOT referenced by any user_profile.restaurant_id
linked_restaurant_ids = set()
for u in users:
    if u.get('restaurant_id'):
        linked_restaurant_ids.add(u['restaurant_id'])

for r in restaurants:
    if r['id'] not in linked_restaurant_ids:
        print(f" [ORPHAN RESTAURANT] ID: {r['id']} | Name: {r['name']}")
    else:
        # Find who owns it
        owners = [u['business_name'] for u in users if u.get('restaurant_id') == r['id']]
        print(f" [LINKED] ID: {r['id']} | Name: {r['name']} | Owned by: {owners}")

print("\n--- Users without a Linked Restaurant (Restaurant Role) ---")
for u in users:
    if u['role'] == 'restaurant_admin' and not u.get('restaurant_id'):
        print(f" [ORPHAN USER] ID: {u['id']} | Name: {u['business_name']}")
