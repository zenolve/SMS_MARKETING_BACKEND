
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

output = []
output.append("--- Checking Restaurant <-> User Linkage ---")

# 1. Get all restaurants
restaurants = supabase.table("restaurants").select("id, name, agency_id").execute().data
output.append(f"Total Restaurants: {len(restaurants)}")

# 2. Get all user_profiles
users = supabase.table("user_profiles").select("id, role, business_name, restaurant_id").execute().data
output.append(f"Total Users: {len(users)}")

# 3. Analyze Linkage
linked_restaurant_ids = set()
for u in users:
    if u.get('restaurant_id'):
        linked_restaurant_ids.add(u['restaurant_id'])

output.append("\n--- Restaurants without a Linked User (Orphans) ---")
orphan_count = 0
for r in restaurants:
    if r['id'] not in linked_restaurant_ids:
        output.append(f" [ORPHAN] ID: {r['id']} | Name: {r['name']}")
        orphan_count += 1
    else:
        owners = [u['business_name'] for u in users if u.get('restaurant_id') == r['id']]
        output.append(f" [LINKED] ID: {r['id']} | Name: {r['name']} | Owned by: {owners}")

output.append(f"\nTotal Orphans: {orphan_count}")

with open("linkage_report.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(output))

print("Report saved to linkage_report.txt")
