from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
from supabase import Client

from database import get_db
from models.schemas import Restaurant, RestaurantCreate, RestaurantUpdate, RestaurantSignup

router = APIRouter()


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

        return {
            'message': 'Restaurant and User created successfully',
            'user_id': user.user.id,
            'email': user.user.email
        }

    except Exception as e:
        print(f'Signup Error: {e}')
        raise HTTPException(status_code=400, detail=str(e))


@router.get('', response_model=List[Restaurant])
async def list_restaurants(
    agency_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: Client = Depends(get_db)
):
    query = db.table('restaurants').select('*')
    if agency_id:
        query = query.eq('agency_id', str(agency_id))
    if status:
        query = query.eq('status', status)
    result = query.order('created_at', desc=True).execute()
    
    restaurants_data = result.data or []
    
    for r in restaurants_data:
        cust_res = db.table('customers').select('*', count='exact', head=True).eq('restaurant_id', r['id']).execute()
        r['total_customers'] = cust_res.count or 0
        
        usage_res = db.table('usage_records').select('messages_sent').eq('restaurant_id', r['id']).execute()
        total_msgs = sum(record.get('messages_sent', 0) for record in (usage_res.data or []))
        r['total_messages_sent'] = total_msgs
        
        if 'current_month_spend' not in r:
             r['current_month_spend'] = 0.0 
             
    return restaurants_data


@router.post('', response_model=Restaurant)
async def create_restaurant(
    restaurant: RestaurantCreate,
    db: Client = Depends(get_db)
):
    result = db.table('restaurants').insert(restaurant.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail='Failed to create restaurant')
    new_restaurant = result.data[0]
    
    new_restaurant['current_month_spend'] = 0.0
    new_restaurant['total_customers'] = 0
    new_restaurant['total_messages_sent'] = 0
    return new_restaurant


@router.get('/{restaurant_id}', response_model=Restaurant)
async def get_restaurant(
    restaurant_id: UUID,
    db: Client = Depends(get_db)
):
    result = db.table('restaurants').select('*').eq('id', str(restaurant_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail='Restaurant not found')
    restaurant = result.data[0]
    
    cust_res = db.table('customers').select('*', count='exact', head=True).eq('restaurant_id', str(restaurant_id)).execute()
    restaurant['total_customers'] = cust_res.count or 0
    
    usage_res = db.table('usage_records').select('messages_sent').eq('restaurant_id', str(restaurant_id)).execute()
    total_msgs = sum(record.get('messages_sent', 0) for record in (usage_res.data or []))
    restaurant['total_messages_sent'] = total_msgs
    
    restaurant['current_month_spend'] = 0.0 
    
    return restaurant


@router.patch('/{restaurant_id}', response_model=Restaurant)
async def update_restaurant(
    restaurant_id: UUID,
    restaurant: RestaurantUpdate,
    db: Client = Depends(get_db)
):
    update_data = restaurant.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail='No fields to update')
    
    result = db.table('restaurants').update(update_data).eq('id', str(restaurant_id)).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail='Restaurant not found')
        
    updated_restaurant = result.data[0]
    
    updated_restaurant['current_month_spend'] = 0.0 
    
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
    
    campaigns_result = db.table('campaigns').select('status, total_sent, total_delivered, total_cost').eq('restaurant_id', str(restaurant_id)).execute()
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
