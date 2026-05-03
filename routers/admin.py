from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from supabase import Client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])

class UserProfileWithEmail(BaseModel):
    id: str
    role: str
    is_verified: bool
    business_name: Optional[str] = None
    restaurant_id: Optional[str] = None
    created_at: str
    email: Optional[str] = None

@router.get("/users", response_model=List[UserProfileWithEmail])
async def get_all_users(db: Client = Depends(get_db)):
    """
    Fetch all users from user_profiles combined with their auth emails.
    Requires server-side service_role key to access auth.users.
    """
    try:
        auth_users = db.auth.admin.list_users()
        email_map = {user.id: user.email for user in auth_users}

        profiles_response = db.from_("user_profiles").select("*").neq("role", "superadmin").order("created_at", desc=True).execute()
        profiles = profiles_response.data

        result = []
        for profile in profiles:
            result.append(UserProfileWithEmail(
                id=profile["id"],
                role=profile["role"],
                is_verified=profile["is_verified"],
                business_name=profile.get("business_name"),
                restaurant_id=profile.get("restaurant_id"),
                created_at=profile["created_at"],
                email=email_map.get(profile["id"])
            ))

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")


@router.delete("/users/{user_id}")
async def permanently_delete_user(user_id: str, db: Client = Depends(get_db)):
    """
    Permanently delete a user and ALL their associated data:
    - Supabase Auth account
    - user_profiles row
    - restaurant row (if restaurant_admin) + all child data:
        customers, campaigns, sms_messages, usage_records, transactions
    - agency row (if agency_admin) + all child restaurants and their data
    """
    try:
        # 1. Get the user profile to know their role and restaurant/agency
        profile_res = db.from_("user_profiles").select("*").eq("id", user_id).execute()
        if not profile_res.data:
            raise HTTPException(status_code=404, detail="User not found")

        profile = profile_res.data[0]
        role = profile.get("role")
        restaurant_id = profile.get("restaurant_id")

        logger.info(f"Permanently deleting user {user_id} (role={role})")

        # 2. Delete restaurant data if restaurant_admin
        if role == "restaurant_admin" and restaurant_id:
            _delete_restaurant_data(db, restaurant_id)

        # 3. Delete agency and all its restaurants if agency_admin
        elif role == "agency_admin":
            # Find the agency owned by this user
            agency_res = db.table("agencies").select("id").execute()
            # Match by checking restaurants created_by_agency or user_profiles business link
            # The agency is linked via user_profiles.restaurant_id being null for agency admins
            # We find agencies where the admin user created them — use business_name match as proxy
            # More reliably: find agencies where this user is the owner via a direct query
            # Since there's no direct user->agency FK, find by matching business_name
            business_name = profile.get("business_name")
            if business_name:
                agency_match = db.table("agencies").select("id").eq("name", business_name).execute()
                if agency_match.data:
                    agency_id = agency_match.data[0]["id"]
                    # Delete all restaurants under this agency first
                    rests = db.table("restaurants").select("id").eq("agency_id", agency_id).execute()
                    for r in (rests.data or []):
                        _delete_restaurant_data(db, r["id"])
                    # Delete agency-level transactions
                    db.table("transactions").delete().eq("agency_id", agency_id).execute()
                    # Delete the agency
                    db.table("agencies").delete().eq("id", agency_id).execute()
                    logger.info(f"Deleted agency {agency_id} and all its restaurants")

        # 4. Delete the user_profiles row
        db.from_("user_profiles").delete().eq("id", user_id).execute()

        # 5. Delete from Supabase Auth (hard delete — cannot be undone)
        db.auth.admin.delete_user(user_id)

        logger.info(f"User {user_id} permanently deleted")
        return {"message": "User and all associated data permanently deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")


def _delete_restaurant_data(db: Client, restaurant_id: str):
    """Delete a restaurant and all its child data in the correct order."""
    logger.info(f"Deleting all data for restaurant {restaurant_id}")

    # Delete in FK-safe order (children before parents)
    db.table("sms_messages").delete().eq("restaurant_id", restaurant_id).execute()
    db.table("scheduled_campaigns").delete().eq("restaurant_id", restaurant_id).execute()
    db.table("customers").delete().eq("restaurant_id", restaurant_id).execute()
    db.table("usage_records").delete().eq("restaurant_id", restaurant_id).execute()
    db.table("transactions").delete().eq("restaurant_id", restaurant_id).execute()
    db.table("restaurants").delete().eq("id", restaurant_id).execute()

    logger.info(f"Restaurant {restaurant_id} and all child data deleted")


@router.post("/migrate-transactions")
async def migrate_transactions(db: Client = Depends(get_db)):
    """One-time migration: add agency_id column to transactions table."""
    results = []
    try:
        try:
            db.rpc("exec_sql", {"sql": "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE"}).execute()
            results.append("agency_id column: OK")
        except Exception as e1:
            results.append(f"agency_id column: {str(e1)[:100]}")

        try:
            db.rpc("exec_sql", {"sql": "ALTER TABLE transactions ALTER COLUMN restaurant_id DROP NOT NULL"}).execute()
            results.append("restaurant_id nullable: OK")
        except Exception as e2:
            results.append(f"restaurant_id nullable: {str(e2)[:100]}")

        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
