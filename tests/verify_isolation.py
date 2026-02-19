import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:8000")
# We would need test tokens for different roles to run this properly.
# For now, this is a template script for the user to verify.

async def verify_isolation():
    print("--- Verifying Data Isolation ---")
    
    # 1. Test as Restaurant Manager A
    # mock_token_a = "..." 
    # async with httpx.AsyncClient() as client:
    #     resp = await client.get(f"{API_URL}/campaigns", headers={"Authorization": f"Bearer {mock_token_a}"})
    #     # Should only see their own campaigns
    
    # 2. Test as Agency Admin
    # mock_token_agency = "..."
    # async with httpx.AsyncClient() as client:
    #     # Should see all campaigns or be able to query specifically
    #     resp = await client.get(f"{API_URL}/campaigns?restaurant_id=...", headers={"Authorization": f"Bearer {mock_token_agency}"})

    print("Note: This script requires valid JWT tokens for restaurant_manager and agency_admin roles.")
    print("To verify manually:")
    print("1. Log in as an Agency Admin.")
    print("2. Click 'Manage' on any restaurant in the dashboard.")
    print("3. Verify you can see and create campaigns for that restaurant.")
    print("4. Log in as a Restaurant Manager.")
    print("5. Verify you cannot see other restaurants or the Agency Dashboard.")

if __name__ == "__main__":
    asyncio.run(verify_isolation())
