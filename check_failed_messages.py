from database import get_db
import json

def check_failed_messages():
    db = get_db()
    
    # Get last 10 failed messages
    result = db.table("sms_messages").select("*").eq("status", "failed").order("created_at", desc=True).limit(10).execute()
    
    if not result.data:
        print("No failed messages found in the last 10 records.")
        return
    
    print(f"Found {len(result.data)} failed messages:")
    for msg in result.data:
        print(f"Time: {msg.get('created_at')}")
        print(f"Phone: {msg.get('to_phone')}")
        print(f"Error: {msg.get('twilio_error_message')}")
        print("-" * 20)

if __name__ == "__main__":
    check_failed_messages()
