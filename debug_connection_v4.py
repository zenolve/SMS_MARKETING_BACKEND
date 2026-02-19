
import os
import sys
import psycopg2
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

# Raw password from .env inspection
RAW_PASSWORD = "Hc7>QuEx&t=;^P9"
HOST = "ezzpqgwtyctlfxejnrbw.supabase.co"
USER = "postgres.ezzpqgwtyctlfxejnrbw" # Supavisor user format with project ref!
# Wait, for Supavisor on port 6543, user is often project_ref.user
# Or just plain postgres if using project-specific domain?
# Let's try both formats.

DBNAME = "postgres"
PORT = 6543

print(f"Testing connection to {HOST}:{PORT} with explict password...")

def try_connect(user_format, description):
    print(f"  Attempting with User: {user_format} ({description})...")
    try:
        conn = psycopg2.connect(
            host=HOST,
            user=user_format,
            password=RAW_PASSWORD,
            dbname=DBNAME,
            port=PORT,
            connect_timeout=10,
            sslmode="require"
        )
        print(f"✅ SUCCESS: Connected with {description}!")
        conn.close()
        return True
    except Exception as e:
        print(f"❌ FAILED with {description}: {e}")
        return False

# 1. Try standard user
try_connect("postgres", "Standard User")

# 2. Try tenant ID user (Supavisor style)
# This format is often: [db_user].[project_ref]
try_connect("postgres.ezzpqgwtyctlfxejnrbw", "Pooler User Format")
