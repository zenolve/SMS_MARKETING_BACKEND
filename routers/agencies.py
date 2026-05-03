from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
from supabase import Client

from database import get_db
from models.schemas import Agency, AgencyCreate, AgencyUpdate
from services.security_service import encrypt_value, decrypt_value

router = APIRouter()


@router.get("", response_model=List[Agency])
async def list_agencies(
    status: Optional[str] = None,
    db: Client = Depends(get_db)
):
    """List all agencies, optionally filtered by status."""
    query = db.table("agencies").select("*")
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).execute()
    agencies_data = result.data or []
    for ag in agencies_data:
        if ag.get("twilio_account_sid"):
            ag["twilio_account_sid"] = decrypt_value(ag["twilio_account_sid"])
        if ag.get("twilio_auth_token"):
            ag["twilio_auth_token"] = decrypt_value(ag["twilio_auth_token"])
    return agencies_data


@router.post("", response_model=Agency)
async def create_agency(
    agency: AgencyCreate,
    db: Client = Depends(get_db)
):
    """Create a new agency. Automatically provisions a Twilio subaccount for isolation."""
    agency_data = agency.model_dump()

    # If the caller didn't supply Twilio credentials, auto-create a subaccount
    # under the master account so every agency is isolated from day one.
    if not agency_data.get("twilio_account_sid"):
        try:
            from services.twilio_service import create_subaccount, create_messaging_service_plain
            from config import get_settings
            settings = get_settings()

            # Create a subaccount under the master Twilio account
            sub = create_subaccount(friendly_name=f"Agency-{agency_data['name']}")
            sub_sid = sub["sid"]
            sub_token = sub["auth_token"]

            # Create a messaging service under the new subaccount so it can
            # send SMS without needing a dedicated phone number immediately.
            try:
                ms = create_messaging_service_plain(
                    account_sid=sub_sid,
                    auth_token=sub_token,
                    friendly_name=f"{agency_data['name']} Messaging Service",
                )
                agency_data["twilio_messaging_service_sid"] = ms["sid"]
            except Exception as ms_err:
                # Non-fatal — agency can still work, just won't have a messaging service yet
                print(f"[WARN] Could not create messaging service for agency: {ms_err}")

            agency_data["twilio_account_sid"] = encrypt_value(sub_sid)
            agency_data["twilio_auth_token"] = encrypt_value(sub_token)

        except Exception as e:
            # Non-fatal in dev; raise in production so the admin knows setup failed
            from config import get_settings
            settings = get_settings()
            if settings.env.lower() != "dev":
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to provision Twilio subaccount for agency: {str(e)}"
                )
            print(f"[WARN] Suppressed Twilio subaccount error in dev mode: {e}")
    else:
        # Caller supplied credentials manually — just encrypt them
        agency_data["twilio_account_sid"] = encrypt_value(agency_data["twilio_account_sid"])
        if agency_data.get("twilio_auth_token"):
            agency_data["twilio_auth_token"] = encrypt_value(agency_data["twilio_auth_token"])

    result = db.table("agencies").insert(agency_data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create agency")

    # Return with decrypted values so the caller can see what was provisioned
    created = result.data[0]
    if created.get("twilio_account_sid"):
        created["twilio_account_sid"] = decrypt_value(created["twilio_account_sid"])
    if created.get("twilio_auth_token"):
        created["twilio_auth_token"] = decrypt_value(created["twilio_auth_token"])
    return created


@router.get("/{agency_id}", response_model=Agency)
async def get_agency(
    agency_id: UUID,
    db: Client = Depends(get_db)
):
    """Get a specific agency by ID. Dynamically syncs current_spend_gbp from child restaurants."""
    result = db.table("agencies").select("*").eq("id", str(agency_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    agency = result.data[0]

    if agency.get("twilio_account_sid"):
        agency["twilio_account_sid"] = decrypt_value(agency["twilio_account_sid"])
    if agency.get("twilio_auth_token"):
        agency["twilio_auth_token"] = decrypt_value(agency["twilio_auth_token"])

    # Dynamically compute committed spend = sum of all child restaurant budget allocations
    try:
        rest_res = db.table("restaurants").select("budget_monthly_gbp").eq("agency_id", str(agency_id)).execute()
        total_committed = sum(float(r.get("budget_monthly_gbp") or 0.0) for r in (rest_res.data or []))
        if total_committed != float(agency.get("current_spend_gbp") or 0.0):
            db.table("agencies").update({"current_spend_gbp": total_committed}).eq("id", str(agency_id)).execute()
        agency["current_spend_gbp"] = total_committed
    except Exception as e:
        print(f"[WARN] Failed to sync agency spend: {e}")

    return agency


@router.patch("/{agency_id}", response_model=Agency)
async def update_agency(
    agency_id: UUID,
    agency: AgencyUpdate,
    db: Client = Depends(get_db)
):
    """Update an agency. Records a transaction when budget is allocated by Admin."""
    update_data = agency.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if update_data.get("twilio_account_sid"):
        update_data["twilio_account_sid"] = encrypt_value(update_data["twilio_account_sid"])
    if update_data.get("twilio_auth_token"):
        update_data["twilio_auth_token"] = encrypt_value(update_data["twilio_auth_token"])
    
    # Fetch current state to compute budget delta
    current_res = db.table("agencies").select("budget_monthly_gbp, name").eq("id", str(agency_id)).execute()
    if not current_res.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    current_agency = current_res.data[0]

    # If budget is being changed, write the transaction BEFORE the update
    # so the audit trail is never lost even if the update fails
    if "budget_monthly_gbp" in update_data:
        old_budget = float(current_agency.get("budget_monthly_gbp") or 0.0)
        new_budget = float(update_data["budget_monthly_gbp"] or 0.0)
        delta = new_budget - old_budget
        if delta != 0:
            try:
                db.table("transactions").insert({
                    "agency_id": str(agency_id),
                    "amount_gbp": delta,
                    "transaction_type": "budget_allocation",
                    "description": (
                        f"Admin budget allocation to Agency '{current_agency.get('name', '')}': "
                        f"{'increased' if delta > 0 else 'reduced'} by £{abs(delta):.2f} "
                        f"(£{old_budget:.2f} → £{new_budget:.2f})"
                    )
                }).execute()
            except Exception as e:
                # Transaction write failed — block the budget change to keep ledger consistent
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to record budget transaction. Budget not changed. Error: {str(e)}"
                )

    result = db.table("agencies").update(update_data).eq("id", str(agency_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agency not found")

    return result.data[0]


@router.delete("/{agency_id}")
async def delete_agency(
    agency_id: UUID,
    db: Client = Depends(get_db)
):
    """Delete an agency."""
    result = db.table("agencies").delete().eq("id", str(agency_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Agency not found")
    return {"message": "Agency deleted"}


@router.get("/{agency_id}/restaurants")
async def list_agency_restaurants(
    agency_id: UUID,
    db: Client = Depends(get_db)
):
    """List all restaurants for an agency."""
    result = db.table("restaurants").select("*").eq("agency_id", str(agency_id)).eq("creation_type", "agency_created").execute()
    return result.data
