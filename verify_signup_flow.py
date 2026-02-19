import requests
import time
import uuid

BASE_URL = "http://localhost:8000"

def verify_signup():
    email = f"test_rest_{int(time.time())}@example.com"
    password = "Password123!"
    name = f"Test Restaurant {int(time.time())}"
    phone = "+15550001234"
    
    print(f"Testing signup with: {email}")
    
    # Fetch an agency ID
    try:
        agencies_res = requests.get(f"{BASE_URL}/agencies")
        agencies = agencies_res.json()
        if not agencies:
            print("FAILED: No agencies found. Cannot create restaurant.")
            return False
        agency_id = agencies[0]["id"]
        print(f"Using Agency ID: {agency_id}")
    except Exception as e:
        print(f"FAILED to fetch agencies: {e}")
        return False

    payload = {
        "name": name,
        "agency_id": agency_id,
        "address": "123 Test St",
        "phone": phone,
        "admin_email": email,
        "admin_password": password,
        "admin_first_name": "Test",
        "admin_last_name": "Admin"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/restaurants/signup", json=payload)
        
        if response.status_code != 200:
            print(f"FAILED: {response.status_code} - {response.text}")
            return False
            
        data = response.json()
        print(f"SUCCESS: {data}")
        
        # Verify if restaurant exists in list
        print("Verifying restaurant list...")
        # Give trigger a moment (async?) although trigger is usually sync in Postgres unless deferred
        time.sleep(2)
        
        list_response = requests.get(f"{BASE_URL}/restaurants")
        restaurants = list_response.json()
        
        found = False
        for r in restaurants:
            if r.get("name") == name:
                found = True
                print(f"Found restaurant: {r['id']} - {r['name']}")
                # Check computed fields
                if "current_month_spend" in r:
                     print("Computed fields present.")
                else:
                     print("WARNING: Computed fields MISSING in new restaurant.")
                break
        
        if found:
            print("Signup flow VERIFIED!")
            return True
        else:
            print("FAILED: Restaurant not found in list after signup (UserInfo trigger might have failed).")
            return False

    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    verify_signup()
