
import os
import sys
import psycopg2
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

# Raw password from .env inspection (hardcoded here for testing to bypass parsing issues)
# User's password found in .env: Hc7>QuEx&t=;^P9
RAW_PASSWORD = "Hc7>QuEx&t=;^P9"
HOST = "ezzpqgwtyctlfxejnrbw.supabase.co"
USER = "postgres"
DBNAME = "postgres"
PORT = 5432

print(f"Testing connection to {HOST}:{PORT} with explict password...")

try:
    conn = psycopg2.connect(
        host=HOST,
        user=USER,
        password=RAW_PASSWORD,
        dbname=DBNAME,
        port=PORT,
        connect_timeout=10,
        sslmode="require"
    )
    print("✅ SUCCESS: Connected with raw password via kwargs!")
    conn.close()
    
    # Now verify if the encoded URL works too
    encoded_pass = quote_plus(RAW_PASSWORD)
    print(f"Encoded Password: {encoded_pass}")
    
    # Construct new URL
    new_url = f"postgresql://{USER}:{encoded_pass}@{HOST}:{PORT}/{DBNAME}"
    print(f"Testing URL connection with encoded password...")
    
    conn2 = psycopg2.connect(new_url, connect_timeout=10)
    print("✅ SUCCESS: Connected with encoded URL!")
    conn2.close()
    
    # Save the Fixed URL to a file for me to read and apply
    with open("fixed_db_url.txt", "w") as f:
        f.write(new_url)
        
except Exception as e:
    print(f"❌ FAILED: {e}")
