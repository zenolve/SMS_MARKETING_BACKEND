from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from uuid import UUID
from supabase import Client
from datetime import datetime, timezone, timedelta

from database import get_db
from models.schemas import Campaign, CampaignCreate, CampaignUpdate, CampaignPreview, Customer
from services.campaign_service import send_campaign, get_campaign_recipients, cancel_campaign_messages

router = APIRouter()


@router.get("", response_model=List[Campaign])
async def list_campaigns(
    restaurant_id: UUID,
    status: Optional[str] = None,
    db: Client = Depends(get_db)
):
    """List campaigns for a restaurant."""
    query = db.table("scheduled_campaigns").select("*").eq("restaurant_id", str(restaurant_id))
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).execute()
    return result.data


@router.post("", response_model=Campaign)
async def create_campaign(
    campaign: CampaignCreate,
    db: Client = Depends(get_db)
):
    """Create a new campaign (draft status)."""
    data = campaign.model_dump()
    data["status"] = "draft"
    
    # Properly serialize all fields
    serialized_data = {}
    for key, value in data.items():
        if value is None:
            continue
        elif isinstance(value, UUID):
            serialized_data[key] = str(value)
        elif isinstance(value, datetime):
            serialized_data[key] = value.isoformat()
        else:
            serialized_data[key] = value
    
    result = db.table("scheduled_campaigns").insert(serialized_data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create campaign")
    return result.data[0]


@router.get("/{campaign_id}", response_model=Campaign)
async def get_campaign(
    campaign_id: UUID,
    db: Client = Depends(get_db)
):
    """Get a specific campaign."""
    result = db.table("scheduled_campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result.data[0]


@router.patch("/{campaign_id}", response_model=Campaign)
async def update_campaign(
    campaign_id: UUID,
    campaign: CampaignUpdate,
    db: Client = Depends(get_db)
):
    """Update a campaign (only if draft or scheduled)."""
    existing = db.table("scheduled_campaigns").select("status").eq("id", str(campaign_id)).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if existing.data[0]["status"] not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail="Cannot edit campaign in current status")
    
    update_data = campaign.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    # Validation for 15m lead time
    if "scheduled_at" in update_data and update_data["scheduled_at"]:
        sched_time = update_data["scheduled_at"]
        if isinstance(sched_time, str):
            sched_time = datetime.fromisoformat(sched_time.replace("Z", "+00:00"))
            
        if sched_time < datetime.now(timezone.utc) + timedelta(minutes=15):
             raise HTTPException(status_code=400, detail="Scheduled time must be at least 15 minutes in the future")

    # Serialize datetime objects
    serialized_update = {}
    for key, value in update_data.items():
        if isinstance(value, datetime):
            serialized_update[key] = value.isoformat()
        else:
            serialized_update[key] = value

    result = db.table("scheduled_campaigns").update(serialized_update).eq("id", str(campaign_id)).execute()
    return result.data[0]


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: UUID,
    db: Client = Depends(get_db)
):
    """Delete a campaign (if draft, or scheduled - cancels messages)."""
    existing = db.table("scheduled_campaigns").select("status").eq("id", str(campaign_id)).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    status = existing.data[0]["status"]
    if status not in ["draft", "scheduled", "cancelled", "failed"]:
        raise HTTPException(status_code=400, detail=f"Cannot delete campaign in status: {status}")
    
    if status == "scheduled":
        await cancel_campaign_messages(str(campaign_id), db)
    
    db.table("scheduled_campaigns").delete().eq("id", str(campaign_id)).execute()
    return {"message": "Campaign deleted"}


@router.get("/{campaign_id}/preview", response_model=CampaignPreview)
async def preview_campaign(
    campaign_id: UUID,
    db: Client = Depends(get_db)
):
    """Preview campaign recipients and estimated cost."""
    campaign = db.table("scheduled_campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_data = campaign.data[0]
    recipients = await get_campaign_recipients(
        db,
        campaign_data["restaurant_id"],
        campaign_data.get("segment_criteria")
    )
    
    estimated_cost = len(recipients) * 0.0079
    
    return CampaignPreview(
        total_recipients=len(recipients),
        sample_recipients=recipients[:10],
        estimated_cost=round(estimated_cost, 4)
    )


@router.post("/{campaign_id}/send")
async def send_campaign_endpoint(
    campaign_id: UUID,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db)
):
    """Send or schedule a campaign."""
    campaign = db.table("scheduled_campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign_data = campaign.data[0]
    if campaign_data["status"] not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail="Campaign already sent or in progress")
    
    # 15m validation for scheduled campaigns
    if campaign_data.get("scheduled_at"):
        sched_time = datetime.fromisoformat(campaign_data["scheduled_at"].replace("Z", "+00:00"))
        if sched_time < datetime.now(timezone.utc) + timedelta(minutes=15):
             raise HTTPException(status_code=400, detail="Scheduled time must be at least 15 minutes in the future")

    # Update status to sending
    db.table("scheduled_campaigns").update({"status": "sending"}).eq("id", str(campaign_id)).execute()
    background_tasks.add_task(send_campaign, str(campaign_id))
    
    return {"message": "Campaign process started", "campaign_id": str(campaign_id)}


@router.post("/{campaign_id}/cancel")
async def cancel_campaign_endpoint(
    campaign_id: UUID,
    db: Client = Depends(get_db)
):
    """Cancel a scheduled campaign."""
    campaign = db.table("scheduled_campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.data[0]["status"] != "scheduled":
        raise HTTPException(status_code=400, detail="Can only cancel scheduled campaigns")
    
    await cancel_campaign_messages(str(campaign_id), db)
    db.table("scheduled_campaigns").update({"status": "cancelled"}).eq("id", str(campaign_id)).execute()
    
    return {"message": "Campaign cancelled"}
