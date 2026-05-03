from twilio.rest import Client
from datetime import datetime, timezone
from typing import Optional

from config import get_settings
from services.security_service import decrypt_value

settings = get_settings()

# Initialize Twilio master client
master_client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

def get_client(account_sid: Optional[str] = None, auth_token: Optional[str] = None) -> Client:
    """Returns the Subaccount client if credentials provided, else Master client."""
    if account_sid and auth_token:
        return Client(decrypt_value(account_sid), decrypt_value(auth_token))
    return master_client


def create_subaccount(friendly_name: str, master_account_sid: Optional[str] = None, master_auth_token: Optional[str] = None) -> dict:
    """Creates a new Twilio Subaccount.

    master_account_sid and master_auth_token must be PLAIN (unencrypted) strings.
    If omitted, the global master client from .env is used.
    """
    if master_account_sid and master_auth_token:
        client = Client(master_account_sid, master_auth_token)
    else:
        client = master_client

    account = client.api.v2010.accounts.create(friendly_name=friendly_name)
    return {
        "sid": account.sid,
        "auth_token": account.auth_token
    }



def create_messaging_service(account_sid: str, auth_token: str, friendly_name: str) -> dict:
    """Creates a Twilio Messaging Service under a specific Subaccount.
    
    account_sid and auth_token must be ENCRYPTED values (will be decrypted internally).
    Use create_messaging_service_plain() when passing raw/unencrypted credentials.
    """
    client = get_client(account_sid, auth_token)
    service = client.messaging.v1.services.create(friendly_name=friendly_name)
    return {
        "sid": service.sid
    }


def create_messaging_service_plain(account_sid: str, auth_token: str, friendly_name: str) -> dict:
    """Creates a Twilio Messaging Service using plain (unencrypted) credentials.
    
    Use this when you have raw credentials (e.g. freshly returned from create_subaccount).
    """
    client = Client(account_sid, auth_token)
    service = client.messaging.v1.services.create(friendly_name=friendly_name)
    return {
        "sid": service.sid
    }


def suspend_subaccount(account_sid: str) -> bool:
    """Suspends a Twilio subaccount to prevent further spending/usage."""
    try:
        account = master_client.api.v2010.accounts(account_sid).update(status='suspended')
        return account.status == 'suspended'
    except Exception:
        return False


def create_usage_trigger(account_sid: str, trigger_value: float, callback_url: str, master_account_sid: Optional[str] = None, master_auth_token: Optional[str] = None) -> dict:
    """Creates a Twilio Usage Trigger on a subaccount.

    account_sid       — plain subaccount SID.
    master_account_sid / master_auth_token — ENCRYPTED master credentials, or None to use
                        the global master from .env.
    """
    if master_account_sid and master_auth_token:
        msid = decrypt_value(master_account_sid)
        mtoken = decrypt_value(master_auth_token)
    else:
        msid = settings.twilio_account_sid
        mtoken = settings.twilio_auth_token

    # Build a client scoped to the subaccount using master credentials
    sub_client = Client(msid, mtoken, account_sid)

    trigger = sub_client.usage.triggers.create(
        trigger_value=str(trigger_value),
        usage_category='totalprice',
        callback_url=callback_url
    )
    return {
        "sid": trigger.sid,
        "trigger_value": trigger.trigger_value
    }



def send_scheduled_message(
    to: str,
    body: str,
    messaging_service_sid: str,
    send_at: datetime,
    status_callback: Optional[str] = None,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None
) -> dict:
    """Send a scheduled SMS using Twilio's native scheduling."""
    client = get_client(account_sid, auth_token)
    
    if send_at.tzinfo is None:
        send_at = send_at.replace(tzinfo=timezone.utc)
    
    params = {
        "messaging_service_sid": messaging_service_sid,
        "to": to,
        "body": body,
        "schedule_type": "fixed",
        "send_at": send_at,  
    }
    
    if status_callback:
        params["status_callback"] = status_callback
    
    message = client.messages.create(**params)
    
    return {
        "sid": message.sid,
        "status": message.status,
        "to": message.to,
    }


def send_immediate_message(
    to: str,
    body: str,
    messaging_service_sid: str,
    status_callback: Optional[str] = None,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None
) -> dict:
    """Send an immediate SMS."""
    client = get_client(account_sid, auth_token)
    params = {
        "messaging_service_sid": messaging_service_sid,
        "to": to,
        "body": body,
    }
    
    if status_callback:
        params["status_callback"] = status_callback
    
    message = client.messages.create(**params)
    
    return {
        "sid": message.sid,
        "status": message.status,
        "to": message.to,
    }


def send_message_with_phone(
    to: str,
    body: str,
    from_: str,
    status_callback: Optional[str] = None,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None
) -> dict:
    """Send SMS from a specific phone number (not messaging service)."""
    client = get_client(account_sid, auth_token)
    params = {
        "from_": from_,
        "to": to,
        "body": body,
    }
    
    if status_callback:
        params["status_callback"] = status_callback
    
    message = client.messages.create(**params)
    
    return {
        "sid": message.sid,
        "status": message.status,
        "to": message.to,
    }


def cancel_scheduled_message(
    message_sid: str, 
    account_sid: Optional[str] = None, 
    auth_token: Optional[str] = None
) -> bool:
    """Cancel a scheduled message before it's sent."""
    client = get_client(account_sid, auth_token)
    try:
        message = client.messages(message_sid).update(status="canceled")
        return message.status == "canceled"
    except Exception:
        return False


def get_message_status(
    message_sid: str, 
    account_sid: Optional[str] = None, 
    auth_token: Optional[str] = None
) -> dict:
    """Get current status of a message."""
    client = get_client(account_sid, auth_token)
    message = client.messages(message_sid).fetch()
    return {
        "sid": message.sid,
        "status": message.status,
        "error_code": message.error_code,
        "error_message": message.error_message,
        "price": message.price,
    }
