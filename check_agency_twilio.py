from database import get_db
from services.security_service import decrypt_value

db = get_db()

agencies = db.table('agencies').select('id,name,twilio_account_sid,twilio_auth_token,status').execute()
print('=== AGENCIES IN DB ===')
for a in agencies.data:
    sid = decrypt_value(a['twilio_account_sid']) if a.get('twilio_account_sid') else None
    print(f"  name={a['name']} | status={a['status']} | twilio_sid={sid}")

print()
print('=== TWILIO SUBACCOUNTS ===')
from twilio.rest import Client
from config import get_settings
s = get_settings()
client = Client(s.twilio_account_sid, s.twilio_auth_token)
for acc in client.api.v2010.accounts.list():
    print(f"  {acc.sid} | {acc.friendly_name} | status={acc.status}")
