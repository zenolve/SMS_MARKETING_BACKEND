from database import get_db
from routers.restaurants import update_restaurant
from models.schemas import RestaurantUpdate
import asyncio
from uuid import UUID

async def test_approve():
    db = get_db()
    restaurant_id = UUID('3aa8b957-0d91-4e82-9044-23caa4ac0515') # Ahsaan
    
    print(f"Attempting to approve restaurant {restaurant_id}...")
    
    update_data = RestaurantUpdate(status='active')
    
    try:
        # We need to mock the dependencies or call the function directly
        # Since update_restaurant is an async function that takes a db client
        result = await update_restaurant(restaurant_id, update_data, db)
        print("Success!")
        print(f"New Status: {result.status}")
        print(f"Twilio SID: {result.twilio_subaccount_sid}")
    except Exception as e:
        print(f"Failed to approve: {e}")

if __name__ == "__main__":
    asyncio.run(test_approve())
