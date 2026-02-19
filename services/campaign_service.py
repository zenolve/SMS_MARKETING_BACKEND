from typing import Optional, List
from datetime import datetime, timedelta, timezone
from supabase import Client
import logging
import asyncio


from database import get_db
from config import get_settings
from services.twilio_service import send_scheduled_message, send_immediate_message, send_message_with_phone, cancel_scheduled_message
from services.usage_service import check_monthly_limit, increment_usage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


async def get_campaign_recipients(
    db: Client,
    restaurant_id: str,
    segment_criteria: Optional[dict] = None
) -> List[dict]:
    """Get recipients for a campaign based on segment criteria.
    
    Segment criteria format:
    {
        "tags": ["vip", "lunch"],  # Customer must have ALL these tags
        "opt_in_status": "opted_in"  # Required, defaults to opted_in
    }
    """
    query = db.table("customers").select("*").eq("restaurant_id", restaurant_id)
    
    # Only include opted-in customers by default
    opt_status = "opted_in"
    if segment_criteria and "opt_in_status" in segment_criteria:
        opt_status = segment_criteria["opt_in_status"]
    query = query.eq("opt_in_status", opt_status)
    
    # Filter by tags if specified
    if segment_criteria and segment_criteria.get("tags"):
        for tag in segment_criteria["tags"]:
            query = query.contains("tags", [tag])
    
    result = query.execute()
    return result.data


from services.usage_service import check_monthly_limit


async def send_campaign(campaign_id: str):
    """Send or schedule a campaign via Twilio.
    
    This function is called as a background task.
    """
    logger.info(f"========== STARTING CAMPAIGN DISPATCH ==========")
    logger.info(f"Campaign ID: {campaign_id}")
    
    db = get_db()
    
    # Get campaign from the renamed table
    campaign = db.table("scheduled_campaigns").select("*").eq("id", campaign_id).execute()
    if not campaign.data:
        logger.error(f"Campaign not found in scheduled_campaigns: {campaign_id}")
        return
    
    campaign_data = campaign.data[0]
    restaurant_id = campaign_data["restaurant_id"]
    logger.info(f"Campaign data: {campaign_data}")
    
    # Get restaurant for Twilio config
    restaurant = db.table("restaurants").select("*").eq("id", restaurant_id).execute()
    if not restaurant.data:
        logger.error(f"Restaurant not found: {restaurant_id}")
        db.table("scheduled_campaigns").update({"status": "failed"}).eq("id", campaign_id).execute()
        return
    
    restaurant_data = restaurant.data[0]
    restaurant_phone = restaurant_data.get("twilio_phone_number")
    messaging_service_sid = restaurant_data.get("twilio_messaging_service_sid") or settings.twilio_messaging_service_sid
    
    global_phone = settings.twilio_phone_number
    # Priority: 1. Restaurant Phone, 2. Global Phone Fallback
    final_sender_phone = restaurant_phone or global_phone
    
    logger.info(f"--- SENDER IDENTIFICATION ---")
    logger.info(f"Messaging Service SID: {messaging_service_sid}")
    logger.info(f"Selected Phone: {final_sender_phone}")
    
    # Get recipients
    recipients = await get_campaign_recipients(
        db,
        restaurant_id,
        campaign_data.get("segment_criteria")
    )
    
    logger.info(f"Found {len(recipients)} recipients")
    
    if not recipients:
        logger.warning("No recipients found for campaign")
        db.table("scheduled_campaigns").update({
            "status": "sent",
            "total_recipients": 0,
            "sent_at": datetime.utcnow().isoformat()
        }).eq("id", campaign_id).execute()
        return
    
    # Check spending limit
    estimated_cost = len(recipients) * 0.0079
    if not check_monthly_limit(db, restaurant_id, estimated_cost):
        logger.error(f"Spending limit exceeded for restaurant {restaurant_id}")
        db.table("scheduled_campaigns").update({"status": "failed"}).eq("id", campaign_id).execute()
        return
    
    # Update total recipients
    db.table("scheduled_campaigns").update({
        "total_recipients": len(recipients)
    }).eq("id", campaign_id).execute()
    
    # Status callback URL
    status_callback = None
    if settings.api_base_url and not any(x in settings.api_base_url.lower() for x in ['localhost', '127.0.0.1', '0.0.0.0']):
        status_callback = f"{settings.api_base_url}/webhooks/twilio/status"

    # Determine timing
    scheduled_at = campaign_data.get("scheduled_at")
    use_scheduling = False
    scheduled_time = None
    
    if scheduled_at:
        scheduled_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        now_utc = datetime.now(timezone.utc)
        
        # Twilio requires scheduled messages to be at least 15 minutes in future.
        if scheduled_time > now_utc + timedelta(minutes=15):
            use_scheduling = True
            logger.info(f"Using TWILIO NATIVE SCHEDULING for {scheduled_time}")
            if not messaging_service_sid:
                logger.error("Twilio Scheduling REQUIRES a Messaging Service SID")
                db.table("scheduled_campaigns").update({"status": "failed"}).eq("id", campaign_id).execute()
                return
        elif scheduled_time > now_utc:
            logger.warning("Scheduled time < 15 mins. Twilio Native Scheduler will reject this.")
            # We will try to send immediately if it's very close, or fail if we want to be strict.
            # PRD requirement: Lead time 15m. So we should have validated earlier. 
            # If we are here, we might try immediate send as fallback or fail.
            logger.info("Falling back to immediate send (Lead time too short for Twilio Scheduler)")
            use_scheduling = False
    
    # Send/Schedule messages
    sent_count = 0
    twilio_sids = []
    
    for customer in recipients:
        try:
            message_body = campaign_data["message_template"]
            # Personalization
            if customer.get("first_name"):
                message_body = message_body.replace("{first_name}", customer["first_name"])
            else:
                message_body = message_body.replace("{first_name}", "")
            
            result = None
            if use_scheduling:
                result = send_scheduled_message(
                    to=customer["phone"],
                    body=message_body,
                    messaging_service_sid=messaging_service_sid,
                    send_at=scheduled_time,
                    status_callback=status_callback
                )
            elif messaging_service_sid:
                result = send_immediate_message(
                    to=customer["phone"],
                    body=message_body,
                    messaging_service_sid=messaging_service_sid,
                    status_callback=status_callback
                )
            else:
                result = send_message_with_phone(
                    to=customer["phone"],
                    body=message_body,
                    from_=final_sender_phone,
                    status_callback=status_callback
                )

            if not result or not result.get("sid"):
                raise Exception("No SID returned from Twilio")
            
            twilio_sids.append(result["sid"])
            
            # Record message
            db.table("sms_messages").insert({
                "campaign_id": campaign_id,
                "restaurant_id": restaurant_id,
                "customer_id": customer["id"],
                "to_phone": customer["phone"],
                "from_phone": final_sender_phone if not messaging_service_sid else None,
                "message_body": message_body,
                "twilio_sid": result["sid"],
                "status": "scheduled" if use_scheduling else "sent", 
                "scheduled_at": scheduled_time.isoformat() if use_scheduling else None,
                "sent_at": datetime.utcnow().isoformat() if not use_scheduling else None
            }).execute()
            
            sent_count += 1
            if not use_scheduling:
                increment_usage(db, restaurant_id, "sent", cost=0.0) 
            
        except Exception as e:
            logger.error(f"FAILED to dispatch to {customer['phone']}: {str(e)}")
            db.table("sms_messages").insert({
                "campaign_id": campaign_id,
                "restaurant_id": restaurant_id,
                "customer_id": customer["id"],
                "to_phone": customer["phone"],
                "message_body": campaign_data["message_template"],
                "status": "failed",
                "twilio_error_message": str(e),
            }).execute()
            increment_usage(db, restaurant_id, "failed")
    
    # Update campaign status
    final_status = "scheduled" if use_scheduling else "sent"
    db.table("scheduled_campaigns").update({
        "status": final_status,
        "total_sent": sent_count if not use_scheduling else 0,
        "sent_at": datetime.utcnow().isoformat() if not use_scheduling else None,
        "twilio_message_sids": twilio_sids
    }).eq("id", campaign_id).execute()


async def cancel_campaign_messages(campaign_id: str, db: Client):
    """Cancel all scheduled messages for a campaign in Twilio."""
    logger.info(f"Cancelling messages for campaign: {campaign_id}")
    
    messages = db.table("sms_messages").select("twilio_sid").eq("campaign_id", campaign_id).execute()
    if not messages.data:
        return
    
    cancelled_count = 0
    for msg in messages.data:
        sid = msg.get("twilio_sid")
        if sid:
            if cancel_scheduled_message(sid):
                cancelled_count += 1
    
    logger.info(f"Cancelled {cancelled_count} messages in Twilio")
    db.table("sms_messages").update({"status": "cancelled"}).eq("campaign_id", campaign_id).execute()
