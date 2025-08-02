#!/usr/bin/env python3
"""
Test production authentication endpoint
"""

import requests
import json

# Test the production verify endpoint
url = 'https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify'

# Test with a fake token to see the error response
headers = {
    'Authorization': 'Bearer fake-token-12345',
    'Content-Type': 'application/json'
}

print("Testing production auth verify endpoint...")
print(f"URL: {url}")
print(f"Headers: {headers}")

try:
    response = requests.post(url, headers=headers)
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    # Also test the Supabase config endpoint
    print("\n\nTesting Supabase config endpoint...")
    config_url = 'https://fynlopos-9eg2c.ondigitalocean.app/api/v1/test/supabase-config'
    config_response = requests.get(config_url)
    print(f"Config Status: {config_response.status_code}")
    print(f"Config Response: {json.dumps(config_response.json(), indent=2)}")
    
except Exception as e:
    print(f"Error: {e}")