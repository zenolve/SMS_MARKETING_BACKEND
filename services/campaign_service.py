from typing import Optional, List
from datetime import datetime, timedelta, timezone
from supabase import Client
import logging
import asyncio


from database import get_db
from config import get_settings
from services.twilio_service import send_scheduled_message, send_immediate_message, send_message_with_phone, cancel_scheduled_message
from services.usage_service import check_monthly_limit, increment_usage
from services.sms_utils import calculate_segments, estimate_cost

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
    
    subaccount_sid = restaurant_data.get("twilio_subaccount_sid")
    auth_token = restaurant_data.get("twilio_auth_token")
    
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
    segment_info = calculate_segments(campaign_data.get("message_template", ""))
    estimated_cost = estimate_cost(segment_info["segments"], len(recipients))
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
            # Strictly fail if validation was somehow bypassed (though router should catch this)
            logger.error("Scheduled time < 15 mins. Rejecting as per strict rules.")
            db.table("scheduled_campaigns").update({"status": "failed"}).eq("id", campaign_id).execute()
            return
    
    # Send/Schedule messages
    sent_count = 0
    failed_count = 0
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
                    status_callback=status_callback,
                    account_sid=subaccount_sid,
                    auth_token=auth_token
                )
            elif messaging_service_sid:
                result = send_immediate_message(
                    to=customer["phone"],
                    body=message_body,
                    messaging_service_sid=messaging_service_sid,
                    status_callback=status_callback,
                    account_sid=subaccount_sid,
                    auth_token=auth_token
                )
            else:
                result = send_message_with_phone(
                    to=customer["phone"],
                    body=message_body,
                    from_=final_sender_phone,
                    status_callback=status_callback,
                    account_sid=subaccount_sid,
                    auth_token=auth_token
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
            if not use_scheduling and not status_callback:
                # Synchronously charge for local dev since webhooks won't fire accurately
                segs = calculate_segments(message_body)["segments"]
                increment_usage(db, restaurant_id, "sent", cost=segs * 0.0079) 
            
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
            failed_count += 1
    
    # Update campaign status
    final_status = "scheduled" if use_scheduling else "sent"
    db.table("scheduled_campaigns").update({
        "status": final_status,
        "total_sent": sent_count,
        "total_failed": failed_count,
        "sent_at": datetime.utcnow().isoformat() if not use_scheduling else None,
        "twilio_message_sids": twilio_sids
    }).eq("id", campaign_id).execute()

    # Send Notification Email
    admin_email = restaurant_data.get("email")
    if admin_email:
        from services.email_service import send_email_notification
        from services.email_templates import get_scheduled_email_html, get_completed_email_html
        
        rest_name = restaurant_data.get("name", "Restaurant Admin")
        camp_name = campaign_data.get("name", "Unknown Campaign")
        
        if use_scheduling:
            subject = f"Campaign Scheduled: {camp_name}"
            sched_str = scheduled_time.strftime('%Y-%m-%d %H:%M:%S UTC')
            html_body = get_scheduled_email_html(camp_name, sched_str, len(recipients), rest_name)
            logger.info(f"Attempting to dispatch SCHEDULING email to {admin_email}...")
            send_email_notification(admin_email, subject, html_body, is_html=True)
        else:
            subject = f"Campaign Sent: {camp_name}"
            html_body = get_completed_email_html(camp_name, sent_count, failed_count, rest_name)
            logger.info(f"Attempting to dispatch COMPLETION email to {admin_email}...")
            send_email_notification(admin_email, subject, html_body, is_html=True)

async def cancel_campaign_messages(campaign_id: str, db: Client):
    """Cancel all scheduled messages for a campaign in Twilio."""
    logger.info(f"Cancelling messages for campaign: {campaign_id}")
    
    campaign = db.table("scheduled_campaigns").select("restaurant_id").eq("id", campaign_id).execute()
    if not campaign.data:
        return
        
    rest_id = campaign.data[0]["restaurant_id"]
    rest = db.table("restaurants").select("twilio_subaccount_sid, twilio_auth_token").eq("id", rest_id).execute()
    subaccount_sid = rest.data[0].get("twilio_subaccount_sid") if rest.data else None
    auth_token = rest.data[0].get("twilio_auth_token") if rest.data else None
    
    messages = db.table("sms_messages").select("twilio_sid").eq("campaign_id", campaign_id).execute()
    if not messages.data:
        return
    
    cancelled_count = 0
    for msg in messages.data:
        sid = msg.get("twilio_sid")
        if sid:
            if cancel_scheduled_message(sid, account_sid=subaccount_sid, auth_token=auth_token):
                cancelled_count += 1
    
    logger.info(f"Cancelled {cancelled_count} messages in Twilio")
    db.table("sms_messages").update({"status": "cancelled"}).eq("campaign_id", campaign_id).execute()
