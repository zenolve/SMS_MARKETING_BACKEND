import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def check_default_agency():
    print("Checking for Default Agency...")
    try:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        
        if not url or not key:
            print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
            return

        supabase = create_client(url, key)
        
        # Check specific ID
        default_id = '00000000-0000-0000-0000-000000000001'
        response = supabase.table("agencies").select("*").eq("id", default_id).execute()
        
        if response.data:
            print(f"SUCCESS: Default Agency found: {response.data[0]['name']}")
        else:
            print("FAILURE: Default Agency NOT found!")
            print("This is likely causing the signup error for Restaurants.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    check_default_agency()
