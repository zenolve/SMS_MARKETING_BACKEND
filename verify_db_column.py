from database import get_db
from supabase import Client

def check_column():
    print("Checking database columns...")
    try:
        # Get DB client
        db = next(get_db())
        
        # Try to select the specific column
        # If it doesn't exist, this should raise an error
        response = db.table("restaurants").select("spending_limit_monthly").limit(1).execute()
        
        print("SUCCESS: 'spending_limit_monthly' column exists.")
        print(f"Data sample: {response.data}")
        
    except Exception as e:
        print(f"FAILURE: Could not select 'spending_limit_monthly'.")
        print(f"Error details: {e}")
        print("\nCONCLUSION: The database schema has NOT been updated. Please run update_schema_v2.sql in Supabase.")

if __name__ == "__main__":
    check_column()
