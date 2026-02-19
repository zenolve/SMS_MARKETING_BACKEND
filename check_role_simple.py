
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(url, key)

profiles = supabase.table("user_profiles").select("role").eq("business_name", "fastnucesstudent@gmail.com").execute()
if profiles.data:
    print(f"ROLE: {profiles.data[0]['role']}")
else:
    print("USER NOT FOUND")
