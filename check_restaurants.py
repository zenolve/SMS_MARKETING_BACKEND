from database import get_db
import json

def check_restaurants():
    db = get_db()
    
    # Get last 5 restaurants
    result = db.table("restaurants").select("*").order("created_at", desc=True).limit(5).execute()
    
    if not result.data:
        print("No restaurants found.")
        return
    
    print(f"Checking last {len(result.data)} restaurants:")
    for rest in result.data:
        print(f"ID: {rest.get('id')}")
        print(f"Name: {rest.get('name')}")
        print(f"Status: {rest.get('status')}")
        print(f"Twilio SID: {rest.get('twilio_subaccount_sid')}")
        print(f"Created At: {rest.get('created_at')}")
        print("-" * 20)

if __name__ == "__main__":
    check_restaurants()
