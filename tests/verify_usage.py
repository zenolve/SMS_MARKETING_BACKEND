import asyncio
import os
import traceback
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime, date

# Load environment variables
load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in environment variables.")
    # Attempt to load from .env.local if .env failed
    if os.path.exists(".env.local"):
        print("Loading from .env.local...")
        load_dotenv(".env.local")
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("STILL ERROR: Could not find keys.")
        exit(1)

print(f"URL: {url}")
print(f"Key: {key[:5]}...{key[-5:] if len(key) > 10 else ''}")

try:
    supabase: Client = create_client(url, key)
except Exception as e:
    print(f"ERROR initializing Supabase client: {e}")
    traceback.print_exc()
    exit(1)

from services.usage_service import increment_usage, check_monthly_limit, get_current_usage_record

async def verify_usage_tracking():
    print("Starting Usage Tracking Verification...")
    
    # 1. Setup Test Data
    print("\n1. Setting up test data...")
    
    # Create or get test agency
    try:
        print("Fetching test agency...")
        agency_res = supabase.table("agencies").select("id").eq("name", "Test Usage Agency").execute()
        if agency_res.data:
            agency_id = agency_res.data[0]["id"]
        else:
            print("Creating test agency...")
            agency_res = supabase.table("agencies").insert({
                "name": "Test Usage Agency",
                "email": "test_usage@agency.com",
                "status": "active"
            }).execute()
            agency_id = agency_res.data[0]["id"]
            
        print(f"Agency ID: {agency_id}")
    except Exception as e:
        print(f"Error fetching/creating agency: {e}")
        if hasattr(e, 'code'):
            print(f"Error Code: {e.code}")
        if hasattr(e, 'details'):
            print(f"Error Details: {e.details}")
        if hasattr(e, 'message'):
            print(f"Error Message: {e.message}")
        traceback.print_exc()
        raise

    # Create test restaurant
    try:
        print("Fetching test restaurant...")
        restaurant_res = supabase.table("restaurants").select("id").eq("name", "Usage Test Restaurant").execute()
        if restaurant_res.data:
            restaurant_id = restaurant_res.data[0]["id"]
            # Update limit to 1 for testing
            supabase.table("restaurants").update({"monthly_sms_limit": 1}).eq("id", restaurant_id).execute()
        else:
            print("Creating test restaurant...")
            restaurant_res = supabase.table("restaurants").insert({
                "agency_id": agency_id,
                "name": "Usage Test Restaurant",
                "email": "usage@test.com",
                "status": "active",
                "monthly_sms_limit": 1 # Set small limit (integer)
            }).execute()
            restaurant_id = restaurant_res.data[0]["id"]
            
        print(f"Restaurant ID: {restaurant_id}")
    except Exception as e:
        print(f"Error fetching/creating restaurant: {e}")
        raise
    
    # Reset usage records for this restaurant
    try:
        today = date.today()
        # Ensure format matches usage_service implementation
        period_start = f"{today.year}-{today.month:02d}-01"
        
        print(f"Resetting usage records for {period_start}...")
        supabase.table("usage_records").delete().eq("restaurant_id", restaurant_id).eq("period_start", period_start).execute()
        print("Reset usage records.")
    except Exception as e:
        print(f"Error resetting usage records: {e}")
        raise
    
    # 2. Verify Initial State
    print("\n2. Verifying initial state...")
    record = get_current_usage_record(supabase, restaurant_id)
    print(f"Initial Record: {record}")
    assert record["total_cost"] == 0.0
    assert record["messages_sent"] == 0
    
    # 3. Simulate Usage
    print("\n3. Simulating usage...")
    
    # Simulate sending 10 messages at $0.05 each
    cost_per_msg = 0.05
    for _ in range(10):
        increment_usage(supabase, restaurant_id, "sent", cost=cost_per_msg)
        
    # Check updated record
    record = get_current_usage_record(supabase, restaurant_id)
    print(f"Updated Record: {record}")
    
    expected_cost = 10 * cost_per_msg
    print(f"Expected Cost: {expected_cost}, Actual Cost: {record['total_cost']}")
    # Float comparison
    assert abs(float(record["total_cost"]) - expected_cost) < 0.001
    assert record["messages_sent"] == 10
    
    # 4. Verify Limit Check
    print("\n4. Verifying limit check...")
    
    # Limit is 1.0. Current usage is 0.5.
    # Trying to send another 10 messages (0.5 cost) should block if we try 11.
    
    can_send = check_monthly_limit(supabase, restaurant_id, 0.4) # 0.5 + 0.4 = 0.9 < 1.0
    print(f"Can send 0.4 more? {can_send}")
    assert can_send == True
    
    can_send = check_monthly_limit(supabase, restaurant_id, 0.6) # 0.5 + 0.6 = 1.1 > 1.0
    print(f"Can send 0.6 more? {can_send}")
    assert can_send == False
    
    print("\n[SUCCESS] Verification Successful!")

if __name__ == "__main__":
    try:
        asyncio.run(verify_usage_tracking())
    except Exception as e:
        print(f"\n[FAILURE] Verification Failed: {e}")
        traceback.print_exc()
        import time
        time.sleep(1) # Allow buffer to flush
