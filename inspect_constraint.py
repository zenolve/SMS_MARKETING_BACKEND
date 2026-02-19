
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

print("--- Inspecting Check Constraints on user_profiles ---")

# We can query information_schema or just try to get the definition via pg_get_constraintdef if we had direct access.
# Since we are using Supabase client, we might be limited.
# But we can try running a raw SQL via an RPC function if one exists, or just try to assume the worst.

# Let's try to verify what roles ARE allowed by trying to update to a known good one (agency_admin already worked).
# And maybe there is a typo in 'restaurant_admin' in the database constraint? E.g. 'restaurant' instead of 'restaurant_admin'?

# First, let's see what roles existing users have.
res = supabase.table("user_profiles").select("role").execute()
unique_roles = set(r['role'] for r in res.data)
print(f"Existing Roles in DB: {unique_roles}")

# If we can't inspect schema directly easily, we can infer.
