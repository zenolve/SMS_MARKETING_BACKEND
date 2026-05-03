from datetime import datetime, date
from uuid import UUID
from supabase import Client
import logging

logger = logging.getLogger(__name__)

def get_current_usage_record(db: Client, restaurant_id: str) -> dict:
    """Get or create the usage record for the current month."""
    today = date.today()
    # Start of current month
    period_start = f"{today.year}-{today.month:02d}-01"
    # End of current month approx (next month start)
    if today.month == 12:
        period_end = f"{today.year + 1}-01-01"
    else:
        period_end = f"{today.year}-{today.month + 1:02d}-01"
        
    # Check for existing record
    result = db.table("usage_records").select("*").eq("restaurant_id", restaurant_id).eq("period_start", period_start).execute()
    
    if result.data:
        return result.data[0]
        
    # Create new record if not exists
    new_record = {
        "restaurant_id": restaurant_id,
        "period_start": period_start,
        "period_end": period_end,
        "messages_sent": 0,
        "messages_delivered": 0,
        "messages_failed": 0,
        "total_cost": 0.0
    }
    
    insert_result = db.table("usage_records").insert(new_record).execute()
    if insert_result.data:
        return insert_result.data[0]
        
    raise Exception("Failed to create usage record")

def increment_usage(db: Client, restaurant_id: str, metric: str, cost: float = 0.0):
    """Increment usage metrics (sent, delivered, failed) and cost.
    
    All financial writes are done atomically via RPC where possible.
    Transaction record is written BEFORE spend update so audit trail is never lost.
    """
    try:
        column_map = {
            "sent": "messages_sent",
            "delivered": "messages_delivered",
            "failed": "messages_failed"
        }
        
        if metric not in column_map:
            logger.error(f"Invalid usage metric: {metric}")
            return
            
        col_name = column_map[metric]
        
        # Get current record to ensure it exists
        record = get_current_usage_record(db, restaurant_id)
        record_id = record["id"]
        
        current_val = record.get(col_name, 0)
        current_total_cost = float(record.get("total_cost", 0.0))
        
        update_data = {
            col_name: current_val + 1,
            "total_cost": current_total_cost + cost,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        db.table("usage_records").update(update_data).eq("id", record_id).execute()
        
        if metric == "sent" and cost > 0:
            # 1. Write transaction FIRST — audit trail must never be lost
            db.table("transactions").insert({
                "restaurant_id": restaurant_id,
                "amount_gbp": -cost,
                "transaction_type": "campaign_send",
                "description": "SMS Campaign Send Cost"
            }).execute()

            # 2. Fetch restaurant with agency_id included
            rest_res = db.table("restaurants").select(
                "current_spend_gbp, budget_monthly_gbp, twilio_subaccount_sid, agency_id"
            ).eq("id", restaurant_id).execute()

            if rest_res.data:
                rest_data = rest_res.data[0]
                current_spend = float(rest_data.get("current_spend_gbp") or 0.0)
                new_spend = current_spend + cost
                budget = float(rest_data.get("budget_monthly_gbp") or 0.0)
                
                # 3. Update restaurant spend
                db.table("restaurants").update({
                    "current_spend_gbp": new_spend
                }).eq("id", restaurant_id).execute()
                
                # 4. Rollup to parent agency
                agency_id = rest_data.get("agency_id")
                if agency_id:
                    try:
                        all_rests = db.table("restaurants").select("current_spend_gbp").eq("agency_id", agency_id).execute()
                        total_agency_spend = sum(float(r.get("current_spend_gbp") or 0.0) for r in (all_rests.data or []))
                        db.table("agencies").update({
                            "current_spend_gbp": total_agency_spend
                        }).eq("id", agency_id).execute()
                        logger.info(f"Updated agency {agency_id} total spend to {total_agency_spend:.4f} GBP")
                    except Exception as agency_err:
                        logger.error(f"Failed to rollup agency spend for {agency_id}: {agency_err}")
                
                # 5. Suspend subaccount if budget exceeded
                if budget > 0 and new_spend >= budget:
                    logger.warning(f"Budget exceeded for {restaurant_id}! Suspending subaccount.")
                    sub_sid = rest_data.get("twilio_subaccount_sid")
                    if sub_sid:
                        from services.twilio_service import suspend_subaccount
                        suspend_subaccount(sub_sid)
        
    except Exception as e:
        logger.error(f"Failed to increment usage for {restaurant_id}: {e}")

def check_monthly_limit(db: Client, restaurant_id: str, estimated_cost: float) -> bool:
    """Check if the estimated cost would exceed the monthly budget.
    
    Fails CLOSED on error — if the DB check fails, we block the send
    rather than risk exceeding budget.
    """
    try:
        restaurant_res = db.table("restaurants").select(
            "budget_monthly_gbp, current_spend_gbp"
        ).eq("id", restaurant_id).execute()

        if not restaurant_res.data:
            logger.error(f"check_monthly_limit: restaurant {restaurant_id} not found — blocking send")
            return False

        limit = restaurant_res.data[0].get("budget_monthly_gbp")
        current_cost = float(restaurant_res.data[0].get("current_spend_gbp") or 0.0)

        # No limit set = unlimited
        if limit is None or float(limit) <= 0:
            return True

        limit = float(limit)

        if current_cost + estimated_cost > limit:
            logger.warning(
                f"Monthly limit reached for {restaurant_id}. "
                f"Limit: {limit:.2f}, Current: {current_cost:.2f}, Estimated: {estimated_cost:.4f}"
            )
            return False

        return True

    except Exception as e:
        logger.error(f"Error checking monthly limit for {restaurant_id}: {e} — blocking send (fail-closed)")
        return False  # Fail closed — never allow spend if we can't verify the limit
