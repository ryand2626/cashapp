#!/usr/bin/env python3
"""
Test authentication endpoint with a sample Supabase token
"""

import requests
import json

# API endpoint
API_URL = "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify"

def test_auth_without_token():
    """Test authentication without token"""
    print("1. Testing without authorization header...")
    response = requests.post(API_URL)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.text}\n")

def test_auth_with_invalid_token():
    """Test authentication with invalid token"""
    print("2. Testing with invalid token...")
    headers = {
        "Authorization": "Bearer invalid_token_12345"
    }
    response = requests.post(API_URL, headers=headers)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.text}\n")

def test_auth_with_malformed_header():
    """Test authentication with malformed header"""
    print("3. Testing with malformed authorization header...")
    headers = {
        "Authorization": "invalid_format"
    }
    response = requests.post(API_URL, headers=headers)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.text}\n")

def main():
    print("=== Testing Fynlo Authentication Endpoint ===\n")
    print(f"API URL: {API_URL}\n")
    
    # Run tests
    test_auth_without_token()
    test_auth_with_invalid_token()
    test_auth_with_malformed_header()
    
    print("=== Authentication Tests Complete ===")
    print("\nNOTE: To test with a valid token, you need to:")
    print("1. Sign in through the Fynlo app or Supabase dashboard")
    print("2. Extract the JWT token from the authorization header")
    print("3. Use it in the 'Authorization: Bearer <token>' header")

if __name__ == "__main__":
    main()