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
    """Increment usage metrics (sent, delivered, failed) and cost."""
    try:
        # metrics: 'sent', 'delivered', 'failed'
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
        
        # For simplicity in this implementation, we fetch current values and update.
        # Ideally, use RPC for atomic updates.
        current_val = record.get(col_name, 0)
        current_total_cost = float(record.get("total_cost", 0.0))
        
        update_data = {
            col_name: current_val + 1,
            "total_cost": current_total_cost + cost,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        db.table("usage_records").update(update_data).eq("id", record_id).execute()
        
    except Exception as e:
        logger.error(f"Failed to increment usage for {restaurant_id}: {e}")

def check_monthly_limit(db: Client, restaurant_id: str, estimated_cost: float) -> bool:
    """Check if the estimated cost would exceed the monthly limit."""
    try:
        # Get restaurant limit
        restaurant_res = db.table("restaurants").select("monthly_sms_limit").eq("id", restaurant_id).execute()
        if not restaurant_res.data:
            return False 
            
        limit = restaurant_res.data[0].get("monthly_sms_limit")
        # No limit set = unlimited
        if limit is None:
            return True
            
        limit = float(limit)
            
        # Get current usage
        record = get_current_usage_record(db, restaurant_id)
        current_cost = float(record.get("total_cost", 0.0))
        
        if current_cost + estimated_cost > limit:
            logger.warning(f"Monthly limit reached for {restaurant_id}. Limit: {limit}, Current: {current_cost}, Estimated: {estimated_cost}")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error checking monthly limit: {e}")
        # Fail safe: allow send if check fails
        return True
