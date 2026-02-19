import pytest
import respx
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from services.campaign_service import send_campaign

@pytest.fixture
def mock_db():
    db = MagicMock()
    return db

@pytest.fixture
def mock_twilio():
    with patch("services.campaign_service.send_scheduled_message") as m_sched, \
         patch("services.campaign_service.send_immediate_message") as m_imm, \
         patch("services.campaign_service.send_message_with_phone") as m_phone:
        yield {"scheduled": m_sched, "immediate": m_imm, "phone": m_phone}

@pytest.mark.asyncio
async def test_send_now_logic(mock_db, mock_twilio):
    # Setup mock data for immediate send
    mock_db.table().select().eq().execute.side_effect = [
        MagicMock(data=[{"id": "camp123", "restaurant_id": "rest1", "status": "draft", "message_template": "Hello", "scheduled_at": None}]),
        MagicMock(data=[{"id": "rest1", "twilio_phone_number": "+1234567890"}]),
    ]
    
    with patch("services.campaign_service.get_db", return_value=mock_db), \
         patch("services.campaign_service.get_campaign_recipients", return_value=[{"id": "c1", "phone": "+987654321"}]), \
         patch("services.campaign_service.check_monthly_limit", return_value=True), \
         patch("services.campaign_service.increment_usage"), \
         patch("services.campaign_service.settings") as mock_settings:
        
        mock_settings.twilio_messaging_service_sid = None
        await send_campaign("camp123")
        
        # Verify immediate send was called
        mock_twilio["phone"].assert_called_once()
        assert mock_db.table("scheduled_campaigns").update.call_count >= 1

@pytest.mark.asyncio
async def test_scheduled_logic_validation(mock_db, mock_twilio):
    # Setup mock data for scheduled send (20 mins in future)
    future_time = datetime.now(timezone.utc) + timedelta(minutes=20)
    mock_db.table().select().eq().execute.side_effect = [
        MagicMock(data=[{"id": "camp456", "restaurant_id": "rest1", "status": "draft", "message_template": "Hello", "scheduled_at": future_time.isoformat()}]),
        MagicMock(data=[{"id": "rest1", "twilio_messaging_service_sid": "MG123"}]),
    ]
    
    with patch("services.campaign_service.get_db", return_value=mock_db), \
         patch("services.campaign_service.get_campaign_recipients", return_value=[{"id": "c1", "phone": "+987654321"}]), \
         patch("services.campaign_service.check_monthly_limit", return_value=True), \
         patch("services.campaign_service.increment_usage"):
        
        await send_campaign("camp456")
        
        # Verify Twilio Native Scheduler was called
        mock_twilio["scheduled"].assert_called_once()

@pytest.mark.asyncio
async def test_scheduled_logic_fallback(mock_db, mock_twilio):
    # Setup mock data for scheduled send (only 5 mins in future - too close for Twilio)
    soon_time = datetime.now(timezone.utc) + timedelta(minutes=5)
    mock_db.table().select().eq().execute.side_effect = [
        MagicMock(data=[{"id": "camp789", "restaurant_id": "rest1", "status": "draft", "message_template": "Hello", "scheduled_at": soon_time.isoformat()}]),
        MagicMock(data=[{"id": "rest1", "twilio_messaging_service_sid": "MG123"}]),
    ]
    
    with patch("services.campaign_service.get_db", return_value=mock_db), \
         patch("services.campaign_service.get_campaign_recipients", return_value=[{"id": "c1", "phone": "+987654321"}]), \
         patch("services.campaign_service.check_monthly_limit", return_value=True), \
         patch("services.campaign_service.increment_usage"):
        
        await send_campaign("camp789")
        
        # Verify it falls back to immediate send because lead time is too short for Twilio Native
        # NOTE: If we have a Messaging Service SID, it uses send_immediate_message, NOT send_message_with_phone
        mock_twilio["immediate"].assert_called_once()
        mock_twilio["scheduled"].assert_not_called()
