
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def query_sql(sql_file):
    if not DATABASE_URL:
        print("Error: DATABASE_URL not found in .env file")
        return

    try:
        # Connect to the database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Read the SQL file
        with open(sql_file, "r") as f:
            sql = f.read()

        print(f"Executing SQL from {sql_file}...")
        cur.execute(sql)
        
        # Fetch and print results
        if cur.description:
            rows = cur.fetchall()
            print("\n--- Results ---")
            for row in rows:
                print(row)
            print(f"\nTotal rows: {len(rows)}")
        else:
            print("No results returned (not a SELECT statement?)")

        conn.commit()
        cur.close()
        conn.close()
        print("Done.")

    except Exception as e:
        print(f"Error executing SQL: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python query_sql.py <sql_file>")
    else:
        query_sql(sys.argv[1])
