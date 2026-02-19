
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

print(f"Connecting to Supabase REST API at {url}...")
try:
    supabase: Client = create_client(url, key)
    
    # Try a simple query
    print("Executing query via REST API (port 443 HTTPS)...")
    # Just verify auth works by fetching user count or something simple
    # Or just list tables (meta query not supported easily via client)
    # Let's try select from auth.users (requires service key) or public table
    
    # Try public.users table or just check healthcheck
    response = supabase.table("user_profiles").select("*", count="exact").limit(1).execute()
    
    print(f"✅ SUCCESS: REST API connected!")
    print(f"Response data: {response.data}")
    print(f"Count: {response.count}")
    
except Exception as e:
    print(f"❌ FAILED REST API: {e}")
