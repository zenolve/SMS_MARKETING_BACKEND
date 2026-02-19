from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# ============ Agency ============
class AgencyBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    twilio_account_sid: Optional[str] = None


class AgencyCreate(AgencyBase):
    pass


class AgencyUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    twilio_account_sid: Optional[str] = None


class Agency(AgencyBase):
    id: UUID
    status: str
    twilio_account_sid: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Restaurant ============
class RestaurantBase(BaseModel):
    name: str
    agency_id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: str = "GMT"


class RestaurantCreate(RestaurantBase):
    spending_limit_monthly: Optional[float] = None
    status: Optional[str] = "pending"


class RestaurantSignup(RestaurantBase):
    """Schema for creating a restaurant AND a user account simultaneously."""
    # User fields
    admin_email: EmailStr
    admin_password: str
    admin_first_name: Optional[str] = None
    admin_last_name: Optional[str] = None
    
    # Restaurant extra fields
    spending_limit_monthly: Optional[float] = None
    status: Optional[str] = "active"


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None
    status: Optional[str] = None
    spending_limit_monthly: Optional[float] = None
    twilio_subaccount_sid: Optional[str] = None
    twilio_phone_number: Optional[str] = None


class Restaurant(RestaurantBase):
    id: UUID
    status: str
    twilio_subaccount_sid: Optional[str] = None
    twilio_phone_number: Optional[str] = None
    spending_limit_monthly: Optional[float] = None
    current_month_spend: float
    total_customers: int = 0
    total_messages_sent: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Customer ============
class CustomerBase(BaseModel):
    phone: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_attributes: Optional[dict] = None


class CustomerCreate(CustomerBase):
    restaurant_id: UUID
    opt_in_status: str = "opted_in"


class CustomerUpdate(BaseModel):
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_attributes: Optional[dict] = None
    opt_in_status: Optional[str] = None


class Customer(CustomerBase):
    id: UUID
    restaurant_id: UUID
    opt_in_status: str
    opt_in_date: Optional[datetime] = None
    opt_out_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ Campaign ============
class CampaignBase(BaseModel):
    name: str
    message_template: str
    segment_criteria: Optional[dict] = None
    schedule_type: str = "one_time"
    scheduled_at: Optional[datetime] = None
    recurrence_rule: Optional[dict] = None
    timezone: Optional[str] = None


class CampaignCreate(CampaignBase):
    restaurant_id: UUID


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    message_template: Optional[str] = None
    segment_criteria: Optional[dict] = None
    schedule_type: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    recurrence_rule: Optional[dict] = None
    timezone: Optional[str] = None
    status: Optional[str] = None


class Campaign(CampaignBase):
    id: UUID
    restaurant_id: UUID
    created_by_user_id: Optional[UUID] = None
    status: str
    total_recipients: int
    total_sent: int
    total_delivered: int
    total_failed: int
    total_cost: float
    sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ SMS Message ============
class SMSMessage(BaseModel):
    id: UUID
    campaign_id: Optional[UUID] = None
    restaurant_id: UUID
    customer_id: Optional[UUID] = None
    phone_to: str
    phone_from: Optional[str] = None
    message_body: str
    twilio_message_sid: Optional[str] = None
    status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    cost: Optional[float] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Usage Record ============
class UsageRecord(BaseModel):
    id: UUID
    restaurant_id: UUID
    agency_id: UUID
    period_start: datetime
    period_end: datetime
    total_messages_sent: int
    total_messages_delivered: int
    total_cost: float
    breakdown: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Webhook Payloads ============
class TwilioStatusCallback(BaseModel):
    MessageSid: str
    MessageStatus: str
    ErrorCode: Optional[str] = None
    ErrorMessage: Optional[str] = None
    To: Optional[str] = None
    From_: Optional[str] = None
    Price: Optional[str] = None

    class Config:
        populate_by_name = True


class TwilioIncomingMessage(BaseModel):
    MessageSid: str
    From_: str
    To: str
    Body: str

    class Config:
        populate_by_name = True


# ============ Response Models ============
class CampaignPreview(BaseModel):
    total_recipients: int
    sample_recipients: List[Customer]
    estimated_cost: float


class CSVImportResult(BaseModel):
    total_rows: int
    imported: int
    skipped: int
    errors: List[str]
