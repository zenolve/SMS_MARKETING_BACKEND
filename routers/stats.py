from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID
from supabase import Client
from typing import Dict, Any

from database import get_db

router = APIRouter()

@router.get("/agency/{agency_id}")
async def get_agency_stats(
    agency_id: UUID,
    db: Client = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get aggregated statistics for an agency dashboard.
    """
    # Use the optimized RPC function to get all stats in one query
    result = db.rpc("get_agency_dashboard_stats", {"p_agency_id": str(agency_id)}).execute()
    
    if not result.data:
        # Fallback to empty stats if RPC fails or returns nothing
        stats = {
            "total_restaurants": 0,
            "active_customers": 0,
            "messages_sent": 0,
            "monthly_revenue": 0.0
        }
    else:
        stats = result.data

    # Format for Frontend
    return {
        "total_restaurants": {
            "value": stats.get("total_restaurants", 0),
            "change": "+0 this month"
        },
        "active_customers": {
            "value": stats.get("active_customers", 0),
            "change": "+0"
        },
        "messages_sent": {
            "value": stats.get("messages_sent", 0),
            "change": "this month"
        },
        "monthly_revenue": {
            "value": round(float(stats.get("monthly_revenue", 0) or 0), 2),
            "change": "+0%"
        }
    }
