from fastapi import APIRouter, Request, HTTPException, Depends
from supabase import Client
from datetime import datetime

from database import get_db
from services.usage_service import increment_usage

router = APIRouter()


import logging

logger = logging.getLogger(__name__)

@router.post("/twilio/status")
async def twilio_status_callback(
    request: Request,
    db: Client = Depends(get_db)
):
    """Handle Twilio message status updates.
    
    Updates sms_messages table with delivery status.
    """
    form_data = await request.form()
    
    message_sid = form_data.get("MessageSid")
    status = form_data.get("MessageStatus")
    error_code = form_data.get("ErrorCode")
    error_message = form_data.get("ErrorMessage")
    price = form_data.get("Price")
    
    if not message_sid:
        raise HTTPException(status_code=400, detail="Missing MessageSid")
    
    update_data = {
        "status": status
    }
    
    if error_code:
        update_data["error_code"] = error_code
    if error_message:
        update_data["error_message"] = error_message
    if price:
        update_data["cost"] = abs(float(price))
    
    if status == "delivered":
        update_data["delivered_at"] = datetime.utcnow().isoformat()
    elif status == "sent":
        update_data["sent_at"] = datetime.utcnow().isoformat()
    
    # Lookup first to support both legacy and canonical SID column names.
    message_lookup = db.table("sms_messages").select("id, campaign_id, restaurant_id").or_(
        f"twilio_message_sid.eq.{message_sid},twilio_sid.eq.{message_sid}"
    ).limit(1).execute()
    if not message_lookup.data:
        return {"status": "received", "matched": False}

    message_id = message_lookup.data[0]["id"]
    result = db.table("sms_messages").update(update_data).eq("id", message_id).execute()
    
    # Update campaign statistics if message found
    if result.data:
        message = result.data[0]
        campaign_id = message.get("campaign_id")
        

        if campaign_id:
            # Increment counters based on status
            if status == "sent":
                db.rpc("increment_campaign_sent", {"campaign_id": campaign_id}).execute()
                # Track usage
                increment_usage(db, message.get("restaurant_id"), "sent", cost=abs(float(price or 0)))
            elif status == "delivered":
                db.rpc("increment_campaign_delivered", {"campaign_id": campaign_id}).execute()
                increment_usage(db, message.get("restaurant_id"), "delivered")
            elif status in ["failed", "undelivered"]:
                db.rpc("increment_campaign_failed", {"campaign_id": campaign_id}).execute()
                increment_usage(db, message.get("restaurant_id"), "failed")
    
    return {"status": "received"}


@router.post("/twilio/incoming")
async def twilio_incoming_message(
    request: Request,
    db: Client = Depends(get_db)
):
    """Handle incoming SMS messages (mainly for opt-out sync).
    
    Twilio's Advanced Opt-Out handles STOP keywords automatically.
    This webhook syncs the opt-out to our database.
    """
    form_data = await request.form()
    
    from_number = form_data.get("From")
    body = form_data.get("Body", "").strip().upper()
    
    if not from_number:
        raise HTTPException(status_code=400, detail="Missing From number")
    
    # Check for opt-out keywords (Twilio also handles these)
    opt_out_keywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]
    
    if body in opt_out_keywords:
        # Update all customers with this phone number to opted_out
        db.table("customers").update({
            "opt_in_status": "opted_out",
            "opt_out_date": datetime.utcnow().isoformat()
        }).eq("phone", from_number).execute()
        
        return {"status": "opt_out_processed", "phone": from_number}
    
    # Check for opt-in keywords
    opt_in_keywords = ["START", "YES", "UNSTOP"]
    
    if body in opt_in_keywords:
        # Re-subscribe customer
        db.table("customers").update({
            "opt_in_status": "opted_in",
            "opt_in_date": datetime.utcnow().isoformat(),
            "opt_out_date": None
        }).eq("phone", from_number).execute()
        
        return {"status": "opt_in_processed", "phone": from_number}
    
    return {"status": "received"}


@router.post("/twilio/usage-trigger")
async def twilio_usage_trigger(
    request: Request,
    db: Client = Depends(get_db)
):
    """Handle Twilio Usage Trigger alerts to suspend subaccount."""
    form_data = await request.form()
    
    account_sid = form_data.get("AccountSid")
    
    if not account_sid:
        raise HTTPException(status_code=400, detail="Missing AccountSid")
        
    # Find restaurant with this subaccount SID
    restaurant_res = db.table("restaurants").select("id").eq("twilio_subaccount_sid", account_sid).execute()
    if not restaurant_res.data:
        return {"status": "ignored", "reason": "No matching restaurant"}
        
    restaurant_id = restaurant_res.data[0]["id"]
    
    from services.twilio_service import suspend_subaccount
    success = suspend_subaccount(account_sid)
    
    if success:
        logger.info(f"Suspended Twilio subaccount {account_sid} for restaurant {restaurant_id} due to usage limit")
    else:
        logger.error(f"Failed to suspend Twilio subaccount {account_sid} for restaurant {restaurant_id}")
        
    return {"status": "processed", "suspended": success}
