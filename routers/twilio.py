from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from pydantic import BaseModel
from supabase import Client
from twilio.base.exceptions import TwilioRestException
import logging

from database import get_db
from config import get_settings
from services.twilio_service import get_client, create_messaging_service, create_messaging_service_plain
from services.security_service import decrypt_value, encrypt_value

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()

# -- Models --
class AvailablePhoneNumber(BaseModel):
    phone_number: str
    friendly_name: str
    locality: Optional[str] = None
    region: Optional[str] = None
    postal_code: Optional[str] = None
    iso_country: Optional[str] = None
    monthly_cost: float = 1.15

class BuyNumberRequest(BaseModel):
    phone_number: str
    restaurant_id: str


def _get_billing_client(db: Client, restaurant_id: str):
    """
    Return the Twilio client that should be used to PURCHASE a number for a restaurant.

    Rules (same as subaccount creation):
    - Restaurant has its own subaccount → buy under that subaccount
    - Restaurant has no subaccount but agency has own Twilio creds → buy under agency account
    - Otherwise → buy under global master from .env

    Also returns the messaging_service_sid to attach the number to (if any).
    """
    rest_res = db.table("restaurants").select(
        "id, name, agency_id, twilio_subaccount_sid, twilio_auth_token, twilio_messaging_service_sid"
    ).eq("id", restaurant_id).execute()

    if not rest_res.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    restaurant = rest_res.data[0]
    sub_sid = restaurant.get("twilio_subaccount_sid")
    sub_token = restaurant.get("twilio_auth_token")
    ms_sid = restaurant.get("twilio_messaging_service_sid")

    # Case 1: restaurant has its own subaccount — buy under it
    if sub_sid and sub_token:
        return get_client(sub_sid, sub_token), restaurant, ms_sid, sub_sid, sub_token

    # Case 2: no subaccount — resolve via agency
    agency_id = restaurant.get("agency_id")
    if agency_id:
        agency_res = db.table("agencies").select(
            "twilio_account_sid, twilio_auth_token, twilio_messaging_service_sid"
        ).eq("id", str(agency_id)).execute()

        if agency_res.data:
            ag = agency_res.data[0]
            if ag.get("twilio_account_sid") and ag.get("twilio_auth_token"):
                # Agency has own creds — buy under agency account
                ag_sid = decrypt_value(ag["twilio_account_sid"])
                ag_token = decrypt_value(ag["twilio_auth_token"])
                ag_ms_sid = ag.get("twilio_messaging_service_sid") or ms_sid
                from twilio.rest import Client as TwilioClient
                return TwilioClient(ag_sid, ag_token), restaurant, ag_ms_sid, None, None

    # Case 3: fall back to global master
    from twilio.rest import Client as TwilioClient
    master_ms_sid = settings.twilio_messaging_service_sid or ms_sid
    return TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token), restaurant, master_ms_sid, None, None


# -- Endpoints --

@router.get("/available-numbers", response_model=List[AvailablePhoneNumber])
async def list_available_numbers(
    area_code: Optional[str] = Query(None, min_length=3, max_length=3),
    country_code: str = "US",
    limit: int = 10,
    restaurant_id: Optional[str] = Query(None),
    db: Client = Depends(get_db)
):
    """
    Search for available phone numbers.
    If restaurant_id is provided, searches under the account that would be used to buy
    (restaurant subaccount → agency account → global master).
    """
    if restaurant_id:
        try:
            client, _, _, _, _ = _get_billing_client(db, restaurant_id)
        except HTTPException:
            client = get_client()
    else:
        client = get_client()

    try:
        search_params = {"limit": limit}
        if area_code:
            search_params["area_code"] = area_code

        numbers = client.available_phone_numbers(country_code).local.list(**search_params)

        return [
            AvailablePhoneNumber(
                phone_number=num.phone_number,
                friendly_name=num.friendly_name,
                locality=num.locality,
                region=num.region,
                postal_code=num.postal_code,
                iso_country=num.iso_country,
                monthly_cost=1.15,
            )
            for num in numbers
        ]

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
    Purchase a phone number and assign it to a restaurant.

    Buying account hierarchy:
    - Restaurant has subaccount → buy under subaccount
    - Agency has own Twilio creds → buy under agency account
    - Otherwise → buy under global master from .env
    """
    client, restaurant, ms_sid, sub_sid, sub_token = _get_billing_client(db, request.restaurant_id)

    # Re-read spend fresh from DB right before purchase to avoid stale budget check
    fresh_res = db.table("restaurants").select(
        "current_spend_gbp, budget_monthly_gbp"
    ).eq("id", request.restaurant_id).execute()
    if not fresh_res.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    cost_gbp = 1.15
    current_spend = float(fresh_res.data[0].get("current_spend_gbp") or 0)
    budget = float(fresh_res.data[0].get("budget_monthly_gbp") or 0)
    if budget > 0 and (current_spend + cost_gbp) > budget:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient budget. Budget: £{budget:.2f}, Current spend: £{current_spend:.2f}, Number cost: £{cost_gbp:.2f}"
        )

    try:
        # 1. Write transaction FIRST — audit trail must exist before money moves
        tx_res = db.table("transactions").insert({
            "restaurant_id": request.restaurant_id,
            "amount_gbp": -cost_gbp,
            "transaction_type": "number_purchase",
            "description": f"Purchasing Twilio number {request.phone_number} (pending)",
        }).execute()
        tx_id = tx_res.data[0]["id"] if tx_res.data else None

        # 2. Purchase the number from Twilio
        purchased = client.incoming_phone_numbers.create(
            phone_number=request.phone_number,
            friendly_name=f"Restaurant: {restaurant['name']}"
        )

        # 3. Ensure a messaging service exists and attach the number to it
        if not ms_sid:
            ms = create_messaging_service_plain(
                account_sid=client.account_sid,
                auth_token=client.auth_token if hasattr(client, 'auth_token') else settings.twilio_auth_token,
                friendly_name=f"MS-{restaurant['name']}",
            )
            ms_sid = ms["sid"]

        client.messaging.v1.services(ms_sid).phone_numbers.create(
            phone_number_sid=purchased.sid
        )

        # 4. Update transaction description with confirmed number
        if tx_id:
            db.table("transactions").update({
                "description": f"Purchased Twilio number {purchased.phone_number}"
            }).eq("id", tx_id).execute()

        # 5. Persist number and updated spend to DB
        new_spend = current_spend + cost_gbp
        db.table("restaurants").update({
            "twilio_phone_number": purchased.phone_number,
            "twilio_messaging_service_sid": ms_sid,
            "current_spend_gbp": new_spend,
        }).eq("id", request.restaurant_id).execute()

        # 6. Roll up spend to agency
        agency_id = restaurant.get("agency_id")
        if agency_id:
            try:
                all_rests = db.table("restaurants").select("current_spend_gbp").eq("agency_id", agency_id).execute()
                total = sum(float(r.get("current_spend_gbp") or 0) for r in (all_rests.data or []))
                db.table("agencies").update({"current_spend_gbp": total}).eq("id", agency_id).execute()
            except Exception as e:
                logger.warning(f"Failed to rollup agency spend after number purchase: {e}")

        return {
            "message": "Phone number purchased and assigned successfully",
            "phone_number": purchased.phone_number,
            "sid": purchased.sid,
            "messaging_service_sid": ms_sid,
        }

    except TwilioRestException as e:
        raise HTTPException(status_code=e.status, detail=f"Twilio Purchase Error: {e.msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
