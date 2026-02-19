import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    exit(1)

# Default to fix_business_name.sql if no argument provided
SQL_FILE = sys.argv[1] if len(sys.argv) > 1 else "fix_business_name.sql"

conn = None
cur = None

try:
    print(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print(f"Reading SQL file: {SQL_FILE}")
    if not os.path.exists(SQL_FILE):
        print(f"Error: File {SQL_FILE} not found")
        exit(1)
        
    with open(SQL_FILE, "r") as f:
        sql = f.read()
        
    print("Executing SQL script...")
    cur.execute(sql)
    conn.commit()
    
    print("Success! Script executed.")
    
except Exception as e:
    print(f"Error executing SQL: {type(e).__name__}: {e}")
    if conn:
        conn.rollback()
    sys.exit(1)
finally:
    if cur:
        cur.close()
    if conn:
        conn.close()
