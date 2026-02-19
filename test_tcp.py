
import socket
import sys

host = "ezzpqgwtyctlfxejnrbw.supabase.co"
ports = [5432, 6543]

print(f"Testing TCP connection to {host}...")

for port in ports:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5)
        print(f"Connecting to port {port}...")
        result = s.connect_ex((host, port))
        if result == 0:
            print(f"✅ Port {port} is OPEN")
        else:
            print(f"❌ Port {port} is CLOSED/FILTERED (Err: {result})")
        s.close()
    except Exception as e:
        print(f"❌ Error testing port {port}: {e}")
