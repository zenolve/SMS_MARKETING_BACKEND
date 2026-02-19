
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- Checking for 'AHMAD ALI' ---")
# Search for the name in the screenshot
res = supabase.table("restaurants").select("*").ilike("name", "%AHMAD ALI%").execute()
print(f"Found {len(res.data)} match(es):")
for r in res.data:
    print(f" - ID: {r['id']} | Name: {r['name']} | Created At: {r['created_at']}")

print("\n--- Checking User Role for 'fastnucesstudent@gmail.com' ---")
# Confirm the role again
profiles = supabase.table("user_profiles").select("*").execute()
found = False
for p in profiles.data:
    # Business name might be the email based on previous logs logic
    if p['business_name'] == 'fastnucesstudent@gmail.com':
        print(f"User: {p['business_name']} | Role: {p['role']}")
        found = True
if not found:
    print("User profile not found by business_name='fastnucesstudent@gmail.com'")
