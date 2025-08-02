#!/usr/bin/env python3
"""
Test script for File Upload System
Tests base64 image upload functionality for iOS integration
"""

import base64
import requests
import json
import os
from io import BytesIO
from PIL import Image

# Test configuration
BASE_URL = "http://localhost:8000"
API_VERSION = "v1"

# Test endpoints
ENDPOINTS = {
    "login": f"{BASE_URL}/api/{API_VERSION}/auth/login",
    "product_image": f"{BASE_URL}/api/{API_VERSION}/files/products",
    "restaurant_logo": f"{BASE_URL}/api/{API_VERSION}/files/restaurants"
}

def create_test_image_base64(size=(300, 300), color='red'):
    """Create a test image and return base64 encoded data"""
    # Create test image
    img = Image.new('RGB', size, color)
    
    # Convert to base64
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode('utf-8')

def test_file_upload_validation():
    """Test file upload validation"""
    print("🧪 Testing File Upload Validation...")
    
    # Test 1: Invalid base64
    print("\n1. Testing invalid base64...")
    invalid_base64 = "not_valid_base64"
    
    from app.core.file_upload import file_upload_service
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=invalid_base64,
            upload_type="product"
        )
        print("❌ Should have failed for invalid base64")
    except Exception as e:
        print(f"✅ Correctly rejected invalid base64: {str(e)}")
    
    # Test 2: Valid image upload
    print("\n2. Testing valid image upload...")
    test_image = create_test_image_base64(size=(200, 200), color='blue')
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=test_image,
            upload_type="product",
            filename="test_product.jpg"
        )
        print(f"✅ Upload successful: {result.file_id}")
        print(f"   Original URL: {result.original_url}")
        print(f"   Thumbnail URL: {result.thumbnail_url}")
        print(f"   Variants: {list(result.variants.keys())}")
    except Exception as e:
        print(f"❌ Upload failed: {str(e)}")

def test_mobile_optimization():
    """Test mobile optimization features"""
    print("\n🔍 Testing Mobile Optimization...")
    
    from app.core.file_upload import file_upload_service
    
    # Create large test image
    large_image = create_test_image_base64(size=(2500, 2500), color='green')
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=large_image,
            upload_type="product",
            filename="large_test.jpg",
            generate_variants=True
        )
        
        print(f"✅ Large image processed successfully")
        print(f"   Generated variants: {len(result.variants)}")
        
        for variant_name, variant_info in result.variants.items():
            print(f"   {variant_name}: {variant_info['size']} -> {variant_info['url']}")
            
    except Exception as e:
        print(f"❌ Large image processing failed: {str(e)}")

def test_api_endpoints():
    """Test API endpoints with authentication"""
    print("\n🌐 Testing API Endpoints...")
    
    # Note: This would require a running server and valid credentials
    print("⚠️  API endpoint testing requires running server")
    print("   Test manually with:")
    print(f"   POST {ENDPOINTS['product_image']}/{{product_id}}/image")
    print("   Body: {\"image_data\": \"<base64_encoded_image>\"}")

def test_ios_integration():
    """Test iOS-specific features"""
    print("\n📱 Testing iOS Integration Features...")
    
    # Test data URL format (common in mobile apps)
    test_image_data = create_test_image_base64(size=(150, 150), color='purple')
    data_url = f"data:image/jpeg;base64,{test_image_data}"
    
    from app.core.file_upload import file_upload_service
    
    try:
        result = file_upload_service.upload_base64_image(
            base64_data=data_url,
            upload_type="product",
            filename="ios_test.jpg"
        )
        print("✅ Data URL format processed successfully")
        print(f"   File ID: {result.file_id}")
        
        # Test multiple size variants (mobile needs different densities)
        variants = result.variants
        required_sizes = ['thumbnail', 'small', 'medium', 'large']
        
        for size in required_sizes:
            if size in variants:
                print(f"   ✅ {size}: {variants[size]['size']}")
            else:
                print(f"   ❌ Missing {size} variant")
                
    except Exception as e:
        print(f"❌ iOS integration test failed: {str(e)}")

def main():
    """Run all file upload tests"""
    print("🚀 Fynlo POS File Upload System Tests")
    print("=" * 50)
    
    try:
        test_file_upload_validation()
        test_mobile_optimization()
        test_ios_integration()
        test_api_endpoints()
        
        print("\n" + "=" * 50)
        print("✅ File Upload System Tests Completed")
        print("\nNext steps:")
        print("1. Start the server: uvicorn app.main:app --reload")
        print("2. Test endpoints with actual product IDs")
        print("3. Verify file serving works correctly")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're running from the backend directory")
        print("Install dependencies: pip install -r requirements.txt")
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    main()