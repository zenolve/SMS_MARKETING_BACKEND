
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

emails_to_check = [
    "l243071@lhr.nu.edu.pk",
    "malikabdullah1786@gmail.com",
    "fastnucestudent@gmail.com", # Note: User typed 'fastnucestudent', earlier was 'fastnucesstudent'. I will check both.
    "fastnucesstudent@gmail.com"
]

print("--- Checking Roles for Specific Users ---")

# We need to find these users. Since business_name was set to email in some cases, we check that.
# Also, we can try to look up in auth.users if possible (supabase-py with service key allows it usually)

try:
    # Attempt to list users from auth (admin api)
    auth_users = supabase.auth.admin.list_users()
    
    user_map = {u.email: u.id for u in auth_users}
    
    for email in emails_to_check:
        uid = user_map.get(email)
        if uid:
            # Get profile
            profile = supabase.table("user_profiles").select("*").eq("id", uid).execute()
            if profile.data:
                p = profile.data[0]
                print(f"[{email}] -> ID: {uid} | Role: {p['role']} | Business: {p['business_name']}")
            else:
                 print(f"[{email}] -> ID: {uid} | NO PROFILE FOUND")
        else:
            print(f"[{email}] -> NOT FOUND in Auth")

except Exception as e:
    print(f"Error accessing Auth Admin API: {e}")
    print("Falling back to searching user_profiles by business_name...")
    
    # Fallback: Search profiles where business_name might be the email
    for email in emails_to_check:
        res = supabase.table("user_profiles").select("*").ilike("business_name", f"%{email}%").execute()
        if res.data:
             for p in res.data:
                 print(f"[{email}] (Match) -> Role: {p['role']} | Name: {p['business_name']}")
        else:
             print(f"[{email}] -> No profile match found")
