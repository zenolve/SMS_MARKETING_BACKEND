import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app
from datetime import datetime, timezone, timedelta
import uuid

client = TestClient(app)

from database import get_db

@pytest.fixture
def mock_db():
    db = MagicMock()
    app.dependency_overrides[get_db] = lambda: db
    yield db
    app.dependency_overrides = {}

def test_create_campaign_endpoint(mock_db):
    payload = {
        "restaurant_id": str(uuid.uuid4()),
        "name": "Test Campaign",
        "message_template": "Hello {first_name}",
        "schedule_type": "one_time"
    }
    
    mock_db.table().insert().execute.return_value = MagicMock(data=[{
        "id": str(uuid.uuid4()), 
        **payload, 
        "status": "draft",
        "total_recipients": 0,
        "total_sent": 0,
        "total_delivered": 0,
        "total_failed": 0,
        "total_cost": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }])
    
    response = client.post("/campaigns", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "draft"

def test_schedule_validation_failure(mock_db):
    # Try to update a campaign with a scheduled_at too close to now
    soon_time = datetime.now(timezone.utc) + timedelta(minutes=5)
    campaign_id = str(uuid.uuid4())
    
    mock_db.table().select().eq().execute.return_value = MagicMock(data=[{"status": "draft"}])
    
    payload = {
        "scheduled_at": soon_time.isoformat()
    }
    
    response = client.patch(f"/campaigns/{campaign_id}", json=payload)
    assert response.status_code == 400
    assert "at least 15 minutes" in response.json()["detail"]

def test_schedule_validation_success(mock_db):
    # Try to update a campaign with a valid future time (30 mins)
    future_time = datetime.now(timezone.utc) + timedelta(minutes=30)
    campaign_id = str(uuid.uuid4())
    
    mock_db.table().select().eq().execute.return_value = MagicMock(data=[{"status": "draft"}])
    mock_db.table().update().eq().execute.return_value = MagicMock(data=[{
        "id": campaign_id, 
        "restaurant_id": str(uuid.uuid4()),
        "name": "Test Campaign",
        "message_template": "Hello",
        "status": "draft", 
        "scheduled_at": future_time.isoformat(),
        "total_recipients": 0,
        "total_sent": 0,
        "total_delivered": 0,
        "total_failed": 0,
        "total_cost": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }])
    
    payload = {
        "scheduled_at": future_time.isoformat()
    }
    
    response = client.patch(f"/campaigns/{campaign_id}", json=payload)
    assert response.status_code == 200
