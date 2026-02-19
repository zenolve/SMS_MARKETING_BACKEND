
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
from supabase import Client
from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException
import os

from database import get_db

router = APIRouter()

# -- Models --
class AvailablePhoneNumber(BaseModel):
    phone_number: str
    friendly_name: str
    locality: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    iso_country: Optional[str] = None
    monthly_cost: float = 1.15 # Default Twilio cost, can be dynamic if we want

class BuyNumberRequest(BaseModel):
    phone_number: str
    restaurant_id: str

# -- Helpers --
def get_twilio_client():
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not account_sid or not auth_token:
        raise HTTPException(status_code=500, detail="Twilio credentials not configured")
    return TwilioClient(account_sid, auth_token)

# -- Endpoints --

@router.get("/available-numbers", response_model=List[AvailablePhoneNumber])
async def list_available_numbers(
    area_code: Optional[str] = Query(None, min_length=3, max_length=3),
    country_code: str = "US",
    limit: int = 10,
    db: Client = Depends(get_db)
):
    """
    Search for available phone numbers on Twilio.
    """
    client = get_twilio_client()

    try:
        # Search parameters
        search_params = {"limit": limit}
        if area_code:
            search_params["area_code"] = area_code

        # Call Twilio API
        # We search for Local numbers by default
        numbers = client.available_phone_numbers(country_code).local.list(**search_params)

        results = []
        for num in numbers:
            results.append(AvailablePhoneNumber(
                phone_number=num.phone_number,
                friendly_name=num.friendly_name,
                locality=num.locality,
                region=num.region,
                postal_code=num.postal_code,
                iso_country=num.iso_country,
                monthly_cost=1.15 # Standard US local number cost
            ))
            
        return results

    except TwilioRestException as e:
        raise HTTPException(status_code=e.status, detail=f"Twilio Error: {e.msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/buy-number")
async def buy_phone_number(
    request: BuyNumberRequest,
    db: Client = Depends(get_db)
):
    """
    Purchase a phone number from Twilio and assign it to a restaurant.
    """
    client = get_twilio_client()

    # 1. Verify Restaurant exists
    # TODO: Add specific permission check (User owns restaurant or is admin)
    restaurant = db.table("restaurants").select("*").eq("id", request.restaurant_id).execute()
    if not restaurant.data:
         raise HTTPException(status_code=404, detail="Restaurant not found")

    try:
        # 2. Purchase from Twilio
        # Note: In production, you might want to link this to a Subaccount if using them.
        # For now, we buy on the main account.
        purchased_number = client.incoming_phone_numbers.create(
            phone_number=request.phone_number,
            # sms_url="https://api.yourdomain.com/webhooks/twilio/sms", # TODO: Set this later
            friendly_name=f"Restaurant: {restaurant.data[0]['name']}"
        )

        # 3. Update Database
        update_data = {
            "twilio_phone_number": purchased_number.phone_number,
            "twilio_messaging_service_sid": purchased_number.sid, # Store SID here for ref, though it's not a service SID strictly
            "settings": restaurant.data[0].get('settings', {}) or {}
        }
        # Add extra metadata to settings
        update_data["settings"]["twilio_sid"] = purchased_number.sid
        
        db.table("restaurants").update(update_data).eq("id", request.restaurant_id).execute()

        return {
            "message": "Phone number purchased successfully", 
            "phone_number": purchased_number.phone_number,
            "sid": purchased_number.sid
        }

    except TwilioRestException as e:
        raise HTTPException(status_code=e.status, detail=f"Twilio Purchase Error: {e.msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
