
import os
import sys
import psycopg2
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL not found")
    sys.exit(1)

def test_connection(url, description):
    print(f"Testing connection ({description})...")
    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        conn.close()
        print(f"✅ SUCCESS: Connected ({description})")
        return True
    except Exception as e:
        print(f"❌ FAILED ({description}): {e}")
        return False

# 1. Test Original URL
print("--- 1. Testing Original URL ---")
original_worked = test_connection(DATABASE_URL, "Original")

# 2. Test Port 6543 (Transaction Pooler)
print("\n--- 2. Testing Port 6543 (Pooler) ---")
u = urlparse(DATABASE_URL)
# Replace port
new_netloc = u.netloc.split(":")[0] + ":6543"
# Supavisor requires 'postgres' as database name usually, or keeps original path.
# But for session mode (port 5432) vs transaction mode (port 6543), often the db name matters.
# Let's just try changing the port first.

url_parts = list(u)
url_parts[1] = new_netloc # netloc is user:pass@host:port
pooler_url = urlunparse(url_parts)

pooler_worked = test_connection(pooler_url, "Port 6543")

# 3. Test Port 5432 Explicitly
print("\n--- 3. Testing Port 5432 Explicitly ---")
new_netloc_5432 = u.netloc.split(":")[0] + ":5432"
url_parts[1] = new_netloc_5432
direct_url = urlunparse(url_parts)
direct_worked = test_connection(direct_url, "Port 5432")

if not original_worked and not pooler_worked and not direct_worked:
    print("\n⚠️ ALL CONNECTIONS FAILED.")
    sys.exit(1)
elif pooler_worked and not original_worked:
    print("\n💡 SUGGESTION: Switch to Port 6543.")
else:
    print("\n✅ At least one connection method works.")
