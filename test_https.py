
import requests
import sys

url = "https://ezzpqgwtyctlfxejnrbw.supabase.co"
print(f"Testing HTTPS connectivity to {url}...")

try:
    response = requests.get(url, timeout=10)
    print(f"✅ SUCCESS: Connected to HTTPS (Status: {response.status_code})")
except Exception as e:
    print(f"❌ FAILED HTTPS: {e}")
