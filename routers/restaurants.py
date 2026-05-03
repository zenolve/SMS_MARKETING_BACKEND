from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
from supabase import Client

from database import get_db
from models.schemas import Restaurant, RestaurantCreate, RestaurantUpdate, RestaurantSignup
from services.security_service import encrypt_value, decrypt_value

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_master_credentials(db: Client, agency_id_str: Optional[str]):
    """
    Return (master_sid, master_token) — plain strings — for creating a Twilio subaccount.

    - Agency has its own Twilio credentials → use those (restaurant subaccount
      is created under the agency's Twilio account, fully isolated).
    - Agency has no credentials → return (None, None) so create_subaccount
      falls back to the global master account from .env.
    """
    if not agency_id_str:
        return None, None

    agency_res = db.table('agencies').select('twilio_account_sid, twilio_auth_token').eq('id', agency_id_str).execute()
    if not agency_res.data:
        return None, None

    ag = agency_res.data[0]
    if ag.get('twilio_account_sid') and ag.get('twilio_auth_token'):
        return decrypt_value(ag['twilio_account_sid']), decrypt_value(ag['twilio_auth_token'])

    return None, None


@router.post('/signup', response_model=dict)
async def signup_restaurant(
    signup_data: RestaurantSignup,
    db: Client = Depends(get_db)
):
    try:
        user_attributes = {
            'email': signup_data.admin_email,
            'password': signup_data.admin_password,
            'email_confirm': True, 
            'user_metadata': {
                'business_name': signup_data.name,
                'role': 'restaurant_admin',
                'phone': signup_data.phone,
            }
        }
        
        user = db.auth.admin.create_user(user_attributes)
        
        if not user:
             raise HTTPException(status_code=400, detail='Failed to create user')

        profile_res = db.table('user_profiles').select('restaurant_id').eq('id', user.user.id).execute()
        if profile_res.data and profile_res.data[0].get('restaurant_id'):
            restaurant_id = profile_res.data[0]['restaurant_id']
            
            update_data = {
                'timezone': signup_data.timezone,
                'address': signup_data.address,
                'phone': signup_data.phone,
                'budget_monthly_gbp': float(signup_data.budget_monthly_gbp or 0),
                'budget_daily_gbp': float(signup_data.budget_daily_gbp or 0),
                'creation_type': signup_data.creation_type,
            }
            if signup_data.status == 'active':
                update_data['status'] = 'active'
            
            if signup_data.created_by_agency_id or signup_data.agency_id:
                # Assign to specified agency instead of default
                agency_id_str = str(signup_data.agency_id or signup_data.created_by_agency_id)
                update_data['created_by_agency_id'] = agency_id_str
                update_data['agency_id'] = agency_id_str
                
                # Auto-verify the user if an agency generated them
                db.table('user_profiles').update({'is_verified': True}).eq('id', user.user.id).execute()

            # Generate Twilio Subaccount if activated
            if update_data.get('status') == 'active':
                from services.twilio_service import create_subaccount, create_usage_trigger
                try:
                    agency_id_str = update_data.get('agency_id') or update_data.get('created_by_agency_id')
                    master_sid, master_token = _resolve_master_credentials(db, agency_id_str)

                    twilio_acc = create_subaccount(
                        friendly_name=f"Restaurant-{signup_data.name}",
                        master_account_sid=master_sid,
                        master_auth_token=master_token,
                    )
                    update_data['twilio_subaccount_sid'] = twilio_acc['sid']
                    update_data['twilio_auth_token'] = encrypt_value(twilio_acc['auth_token'])
                    logger.info(f"Twilio subaccount created: {twilio_acc['sid']} for restaurant {signup_data.name}")

                    if update_data['budget_monthly_gbp'] > 0:
                        from config import get_settings
                        settings = get_settings()
                        callback_url = f"{settings.api_base_url}/webhooks/twilio/usage-trigger"
                        enc_master_sid = encrypt_value(master_sid) if master_sid else None
                        enc_master_token = encrypt_value(master_token) if master_token else None
                        create_usage_trigger(twilio_acc['sid'], update_data['budget_monthly_gbp'], callback_url, enc_master_sid, enc_master_token)

                except Exception as e:
                    # Non-fatal: restaurant is created but Twilio setup failed.
                    # The agency can retry via POST /restaurants/{id}/initialize-twilio
                    logger.error(f"Twilio subaccount creation failed for {signup_data.name}: {e}")
            
            db.table('restaurants').update(update_data).eq('id', restaurant_id).execute()
            
            # Initial Budget Allocation Ledger
            if update_data['budget_monthly_gbp'] > 0:
                db.table('transactions').insert({
                    'restaurant_id': restaurant_id,
                    'amount_gbp': update_data['budget_monthly_gbp'],
                    'transaction_type': 'budget_allocation',
                    'description': 'Initial Monthly Budget Allocation'
                }).execute()

        return {
            'message': 'Restaurant and User created successfully',
            'user_id': user.user.id,
            'email': user.user.email
        }

    except Exception as e:
        error_msg = str(e)
        if "Database error" in error_msg:
             error_msg = "Database error. The email address might already be in use or password is too short."
        print(f'Signup Error: {e}')
        raise HTTPException(status_code=400, detail=error_msg)


@router.get('', response_model=List[Restaurant])
async def list_restaurants(
    agency_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: Client = Depends(get_db)
):
    # Use the optimized RPC to get restaurants with counts in a single query
    params = {
        "p_agency_id": str(agency_id) if agency_id else None,
        "p_status": status
    }
    result = db.rpc("get_restaurants_with_counts", params).execute()
    
    restaurants_data = result.data or []
    
    for r in restaurants_data:
        # These are now included in the RPC output but we might want to ensure types
        r['total_customers'] = int(r.get('total_customers', 0))
        r['total_messages_sent'] = int(r.get('total_messages_sent', 0))
        
        if r.get('twilio_auth_token'):
            r['twilio_auth_token'] = decrypt_value(r['twilio_auth_token'])
             
    return restaurants_data


@router.post('', response_model=Restaurant)
async def create_restaurant(
    restaurant: RestaurantCreate,
    db: Client = Depends(get_db)
):
    from services.twilio_service import create_subaccount

    restaurant_data = restaurant.model_dump()
    
    # Agency specific overrides
    restaurant_data['creation_type'] = 'agency_created'
    restaurant_data['created_by_agency_id'] = str(restaurant.agency_id)
    restaurant_data['status'] = 'active'
    
    # Enforce Agency budget limits
    new_budget = float(restaurant_data.get('budget_monthly_gbp') or 0.0)
    if new_budget > 0:
        agency_id_str = str(restaurant.agency_id)
        agency_res = db.table('agencies').select('budget_monthly_gbp').eq('id', agency_id_str).execute()
        if agency_res.data:
            agency_budget = float(agency_res.data[0].get('budget_monthly_gbp') or 0.0)
            all_rests = db.table('restaurants').select('budget_monthly_gbp').eq('agency_id', agency_id_str).execute()
            total_allocated = sum(float(r.get('budget_monthly_gbp') or 0.0) for r in (all_rests.data or []))
            if total_allocated + new_budget > agency_budget:
                raise HTTPException(status_code=400, detail=f"Cannot allocate budget. Agency total budget is {agency_budget} GBP but attempted total allocation is {total_allocated + new_budget} GBP.")
    
    # Twilio Subaccount Generation
    try:
        agency_id_str = str(restaurant.agency_id)
        master_sid, master_token = _resolve_master_credentials(db, agency_id_str)

        twilio_acc = create_subaccount(
            friendly_name=f"Restaurant-{restaurant.name}",
            master_account_sid=master_sid,
            master_auth_token=master_token,
        )
        restaurant_data['twilio_subaccount_sid'] = twilio_acc['sid']
        restaurant_data['twilio_auth_token'] = encrypt_value(twilio_acc['auth_token'])

        new_budget = float(restaurant_data.get('budget_monthly_gbp') or 0.0)
        if new_budget > 0:
            from config import get_settings
            from services.twilio_service import create_usage_trigger
            settings = get_settings()
            callback_url = f"{settings.api_base_url}/webhooks/twilio/usage-trigger"
            enc_master_sid = encrypt_value(master_sid) if master_sid else None
            enc_master_token = encrypt_value(master_token) if master_token else None
            create_usage_trigger(twilio_acc['sid'], new_budget, callback_url, enc_master_sid, enc_master_token)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Twilio Subaccount: {str(e)}")

    result = db.table('restaurants').insert(restaurant_data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail='Failed to create restaurant')
    new_restaurant = result.data[0]
    
    new_restaurant['current_month_spend'] = 0.0
    new_restaurant['total_customers'] = 0
    new_restaurant['total_messages_sent'] = 0

    # Initial budget allocation ledger
    if new_restaurant.get('budget_monthly_gbp'):
        db.table('transactions').insert({
            'restaurant_id': new_restaurant['id'],
            'amount_gbp': float(new_restaurant['budget_monthly_gbp']),
            'transaction_type': 'budget_allocation',
            'description': 'Initial Monthly Budget Allocation'
        }).execute()

    # Rollup allocated budget to agency's current_spend_gbp
    # Agency current_spend = sum of ALL restaurant budget allocations (committed/reserved)
    agency_id_str = str(restaurant.agency_id)
    try:
        all_rests = db.table('restaurants').select('budget_monthly_gbp').eq('agency_id', agency_id_str).execute()
        total_committed = sum(float(r.get('budget_monthly_gbp') or 0.0) for r in (all_rests.data or []))
        db.table('agencies').update({'current_spend_gbp': total_committed}).eq('id', agency_id_str).execute()
    except Exception as e:
        print(f"[WARN] Failed to rollup agency allocated spend: {e}")

    return new_restaurant


@router.get('/{restaurant_id}', response_model=Restaurant)
async def get_restaurant(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    params = {
        "p_agency_id": None,
        "p_status": None,
        "p_restaurant_id": str(restaurant_id)
    }
    result = db.rpc("get_restaurants_with_counts", params).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    
    restaurant = result.data[0]
    
    # Map fields to match the expected schema if different
    restaurant['restaurant_admin_email'] = restaurant.get('email')
    restaurant['current_month_spend'] = float(restaurant.get('current_spend_gbp') or 0.0)
    
    if restaurant.get('twilio_auth_token'):
        restaurant['twilio_auth_token'] = decrypt_value(restaurant['twilio_auth_token'])
    
    return restaurant


@router.patch('/{restaurant_id}', response_model=Restaurant)
async def update_restaurant(
    restaurant_id: UUID,
    restaurant: RestaurantUpdate,
    db: Client = Depends(get_db)
):
    from services.twilio_service import create_subaccount

    update_data = restaurant.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail='No fields to update')
    
    # Enforce Agency budget limits
    if 'budget_monthly_gbp' in update_data:
        new_budget = float(update_data['budget_monthly_gbp'] or 0.0)
        current_rest = db.table('restaurants').select('budget_monthly_gbp, agency_id, creation_type').eq('id', str(restaurant_id)).execute()
        if current_rest.data:
            old_budget = float(current_rest.data[0].get('budget_monthly_gbp') or 0.0)
            agency_id_str = current_rest.data[0].get('agency_id')
            # Only enforce on agency created
            if new_budget != old_budget and agency_id_str and current_rest.data[0].get('creation_type') == 'agency_created':
                agency_res = db.table('agencies').select('budget_monthly_gbp').eq('id', agency_id_str).execute()
                if agency_res.data:
                    agency_budget = float(agency_res.data[0].get('budget_monthly_gbp') or 0.0)
                    all_rests = db.table('restaurants').select('budget_monthly_gbp').eq('agency_id', agency_id_str).eq('creation_type', 'agency_created').execute()
                    total_allocated = sum(float(r.get('budget_monthly_gbp') or 0.0) for r in (all_rests.data or []))
                    if (total_allocated - old_budget + new_budget) > agency_budget:
                        raise HTTPException(status_code=400, detail=f"Cannot allocate budget. Agency total budget is {agency_budget} GBP but attempted total allocation is {total_allocated - old_budget + new_budget} GBP.")
    
    # Auto-generate subaccount on approval and update usage triggers
    if update_data.get('status') == 'active' or 'budget_monthly_gbp' in update_data:
        current_rest = db.table('restaurants').select('twilio_subaccount_sid, name, budget_monthly_gbp, agency_id').eq('id', str(restaurant_id)).execute()
        if current_rest.data:
            base_rest = current_rest.data[0]
            current_sub_sid = base_rest.get('twilio_subaccount_sid')
            agency_id_str = base_rest.get('agency_id')
            master_sid, master_token = _resolve_master_credentials(db, agency_id_str)

            if update_data.get('status') == 'active' and not current_sub_sid:
                try:
                    twilio_acc = create_subaccount(
                        friendly_name=f"Restaurant-{base_rest['name']}",
                        master_account_sid=master_sid,
                        master_auth_token=master_token,
                    )
                    update_data['twilio_subaccount_sid'] = twilio_acc['sid']
                    update_data['twilio_auth_token'] = encrypt_value(twilio_acc['auth_token'])
                    current_sub_sid = twilio_acc['sid']
                except Exception as e:
                    import os
                    if os.getenv('ENV', 'dev').lower() == 'dev':
                        print(f"Suppressed Twilio Subaccount Error in DEV mode: {e}")
                    else:
                        raise HTTPException(status_code=500, detail=f"Failed to create Twilio Subaccount: {str(e)}")

            if 'budget_monthly_gbp' in update_data and current_sub_sid:
                new_budget = float(update_data['budget_monthly_gbp'] or 0.0)
                if new_budget > 0:
                    from config import get_settings
                    from services.twilio_service import create_usage_trigger
                    settings = get_settings()
                    callback_url = f"{settings.api_base_url}/webhooks/twilio/usage-trigger"
                    enc_master_sid = encrypt_value(master_sid) if master_sid else None
                    enc_master_token = encrypt_value(master_token) if master_token else None
                    try:
                        create_usage_trigger(current_sub_sid, new_budget, callback_url, enc_master_sid, enc_master_token)
                    except Exception as e:
                        print(f"Failed to update Twilio Usage Trigger: {e}")

    result = db.table('restaurants').update(update_data).eq('id', str(restaurant_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail='Restaurant not found')
        
    updated_restaurant = result.data[0]
    updated_restaurant['current_month_spend'] = float(updated_restaurant.get('current_spend_gbp') or 0.0)
    
    # If budget was updated, log a transaction and rollup agency spend
    if 'budget_monthly_gbp' in update_data:
        new_bud = float(update_data.get('budget_monthly_gbp') or 0.0)
        try:
            db.table('transactions').insert({
                'restaurant_id': str(restaurant_id),
                'amount_gbp': new_bud,
                'transaction_type': 'budget_allocation',
                'description': f"Budget allocation updated to £{new_bud:.2f}/mo by Agency"
            }).execute()
        except Exception as e:
            print(f"[WARN] Failed to write restaurant allocation transaction: {e}")

        # Rollup: agency's current_spend = sum of ALL child restaurant budgets (allocated)
        rest_data_for_agency = db.table('restaurants').select('agency_id').eq('id', str(restaurant_id)).execute()
        if rest_data_for_agency.data and rest_data_for_agency.data[0].get('agency_id'):
            agency_id_str = rest_data_for_agency.data[0]['agency_id']
            try:
                all_rests = db.table('restaurants').select('budget_monthly_gbp').eq('agency_id', agency_id_str).execute()
                total_committed = sum(float(r.get('budget_monthly_gbp') or 0.0) for r in (all_rests.data or []))
                db.table('agencies').update({'current_spend_gbp': total_committed}).eq('id', agency_id_str).execute()
            except Exception as e:
                print(f"[WARN] Failed to rollup agency committed spend: {e}")
    
    cust_res = db.table('customers').select('*', count='exact', head=True).eq('restaurant_id', str(restaurant_id)).execute()
    updated_restaurant['total_customers'] = cust_res.count or 0
    
    usage_res = db.table('usage_records').select('messages_sent').eq('restaurant_id', str(restaurant_id)).execute()
    total_msgs = sum(record.get('messages_sent', 0) for record in (usage_res.data or []))
    updated_restaurant['total_messages_sent'] = total_msgs
    
    return updated_restaurant


@router.delete('/{restaurant_id}')
async def delete_restaurant(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    result = db.table('restaurants').delete().eq('id', str(restaurant_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    return {'message': 'Restaurant deleted'}


@router.get('/{restaurant_id}/usage')
async def get_restaurant_usage(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    result = db.table('usage_records').select('*').eq('restaurant_id', str(restaurant_id)).order('period_start', desc=True).execute()
    return result.data


@router.get('/{restaurant_id}/messages')
async def get_restaurant_messages(
    restaurant_id: UUID,
    limit: int = 50,
    db: Client = Depends(get_db)
):
    result = db.table('sms_messages').select('*').eq('restaurant_id', str(restaurant_id)).order('created_at', desc=True).limit(limit).execute()
    return result.data


@router.get('/{restaurant_id}/stats')
async def get_restaurant_stats(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    customers_result = db.table('customers').select('opt_in_status').eq('restaurant_id', str(restaurant_id)).execute()
    customers = customers_result.data or []
    
    total_customers = len(customers)
    opted_in = sum(1 for c in customers if c.get('opt_in_status') == 'opted_in')
    opted_out = sum(1 for c in customers if c.get('opt_in_status') == 'opted_out')
    
    campaigns_result = db.table('scheduled_campaigns').select('status, total_sent, total_delivered, total_cost').eq('restaurant_id', str(restaurant_id)).execute()
    campaigns = campaigns_result.data or []
    
    total_campaigns = len(campaigns)
    sent_campaigns = sum(1 for c in campaigns if c.get('status') == 'sent')
    scheduled_campaigns = sum(1 for c in campaigns if c.get('status') == 'scheduled')
    
    total_sent = sum(c.get('total_sent', 0) or 0 for c in campaigns)
    total_delivered = sum(c.get('total_delivered', 0) or 0 for c in campaigns)
    total_cost = sum(c.get('total_cost', 0) or 0 for c in campaigns)
    
    delivery_rate = round((total_delivered / total_sent * 100) if total_sent > 0 else 0, 1)
    
    return {
        'customers': {
            'total': total_customers,
            'opted_in': opted_in,
            'opted_out': opted_out,
        },
        'campaigns': {
            'total': total_campaigns,
            'sent': sent_campaigns,
            'scheduled': scheduled_campaigns,
        },
        'messages': {
            'total_sent': total_sent,
            'total_delivered': total_delivered,
            'delivery_rate': delivery_rate,
        },
        'cost': {
            'total': round(total_cost, 2),
        }
    }


@router.get('/{restaurant_id}/tags')
async def get_restaurant_tags(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    result = db.table('customers').select('tags').eq('restaurant_id', str(restaurant_id)).execute()
    
    all_tags = set()
    for customer in result.data or []:
        tags = customer.get('tags') or []
        all_tags.update(tags)
    
    return sorted(list(all_tags))
@router.post('/{restaurant_id}/initialize-twilio', response_model=Restaurant)
async def initialize_restaurant_twilio(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    """Manually trigger Twilio subaccount creation if it failed previously."""
    res = db.table('restaurants').select('*').eq('id', str(restaurant_id)).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    restaurant = res.data[0]

    if restaurant.get('twilio_subaccount_sid'):
        return restaurant

    try:
        from services.twilio_service import create_subaccount

        agency_id_str = str(restaurant.get('agency_id')) if restaurant.get('agency_id') else None
        master_sid, master_token = _resolve_master_credentials(db, agency_id_str)

        twilio_acc = create_subaccount(
            friendly_name=f"Restaurant-{restaurant['name']}",
            master_account_sid=master_sid,
            master_auth_token=master_token,
        )

        update_data = {
            'twilio_subaccount_sid': twilio_acc['sid'],
            'twilio_auth_token': encrypt_value(twilio_acc['auth_token']),
            'status': 'active',
        }

        final_res = db.table('restaurants').update(update_data).eq('id', str(restaurant_id)).execute()
        if not final_res.data:
            raise HTTPException(status_code=500, detail="Failed to update restaurant with Twilio info")

        return final_res.data[0]

    except Exception as e:
        logger.error(f"Manual Twilio Init Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create Twilio Subaccount: {str(e)}")
