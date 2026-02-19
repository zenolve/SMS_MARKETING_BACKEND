
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("SELECT count(*) FROM restaurants")
    restaurant_count = cur.fetchone()[0]
    print(f"Total Restaurants: {restaurant_count}")

    if restaurant_count > 0:
        cur.execute("SELECT id, name, status FROM restaurants LIMIT 5")
        print("Sample Restaurants:")
        for r in cur.fetchall():
            print(f" - {r}")

    cur.execute("SELECT count(*) FROM usage_records")
    usage_count = cur.fetchone()[0]
    print(f"Total Usage Records: {usage_count}")

    conn.close()
except Exception as e:
    print(f"Database error: {e}")
