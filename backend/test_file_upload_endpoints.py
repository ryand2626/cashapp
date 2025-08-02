#!/usr/bin/env python3
"""
File Upload API Endpoints Testing for Fynlo POS
Tests the actual API endpoints with real HTTP requests
"""

import asyncio
import base64
import json
import sys
from pathlib import Path
from io import BytesIO
import httpx
from PIL import Image

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

class FileUploadAPITester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"
        self.test_results = []
        self.auth_token = None
    
    def log_test(self, test_name, success, message="", data=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "data": data
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if data and isinstance(data, dict):
            # Pretty print JSON data
            print(f"    Data: {json.dumps(data, indent=2, default=str)}")
    
    def create_test_image_base64(self, size=(200, 200), color='blue', format='JPEG'):
        """Create a test image in base64 format"""
        img = Image.new('RGB', size, color=color)
        buffer = BytesIO()
        img.save(buffer, format=format)
        image_bytes = buffer.getvalue()
        base64_data = base64.b64encode(image_bytes).decode('utf-8')
        
        # Return as data URL
        mime_type = f"image/{format.lower()}"
        if format == 'JPEG':
            mime_type = "image/jpeg"
        
        return f"data:{mime_type};base64,{base64_data}"
    
    async def test_server_status(self):
        """Test if the server is running"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/")
                if response.status_code == 200:
                    self.log_test("Server Status", True, f"Server running at {self.base_url}")
                    return True
                else:
                    self.log_test("Server Status", False, f"Server returned {response.status_code}")
                    return False
        except Exception as e:
            self.log_test("Server Status", False, f"Server not accessible: {e}")
            return False
    
    async def test_api_docs(self):
        """Test if API documentation is accessible"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/docs")
                if response.status_code == 200:
                    self.log_test("API Documentation", True, "Swagger docs accessible")
                    return True
                else:
                    self.log_test("API Documentation", False, f"Docs returned {response.status_code}")
                    return False
        except Exception as e:
            self.log_test("API Documentation", False, f"Docs not accessible: {e}")
            return False
    
    async def authenticate(self):
        """Authenticate with the API to get a token"""
        try:
            login_data = {
                "email": "admin@fynlo.com",
                "password": "admin123"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/auth/login",
                    json=login_data
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        self.auth_token = data["data"]["access_token"]
                        self.log_test("Authentication", True, "Successfully authenticated")
                        return True
                    else:
                        self.log_test("Authentication", False, "Invalid response format")
                        return False
                else:
                    self.log_test("Authentication", False, f"Login failed: {response.status_code}")
                    return False
        except Exception as e:
            self.log_test("Authentication", False, f"Authentication error: {e}")
            return False
    
    def get_auth_headers(self):
        """Get authentication headers"""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    async def test_file_upload_endpoint(self):
        """Test the file upload endpoint"""
        if not self.auth_token:
            self.log_test("File Upload Endpoint", False, "No authentication token")
            return False
        
        try:
            # Create test image
            test_image_data = self.create_test_image_base64(size=(400, 300), color='red')
            
            upload_data = {
                "file_data": test_image_data,
                "category": "products",
                "filename": "test_product.jpg",
                "description": "Test product image upload"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.api_url}/files/upload",
                    json=upload_data,
                    headers=self.get_auth_headers()
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_test("File Upload Endpoint", True, 
                                "Image uploaded successfully", data)
                    return True
                else:
                    error_data = response.text
                    try:
                        error_data = response.json()
                    except:
                        pass
                    self.log_test("File Upload Endpoint", False, 
                                f"Upload failed: {response.status_code}", error_data)
                    return False
                    
        except Exception as e:
            self.log_test("File Upload Endpoint", False, f"Upload error: {e}")
            return False
    
    async def test_file_serving(self):
        """Test file serving endpoints"""
        try:
            # Try to access a static file or upload directory
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.api_url}/files/")
                
                # We expect either a file listing or a 404, not a 500 error
                if response.status_code in [200, 404]:
                    self.log_test("File Serving", True, 
                                f"File serving endpoint accessible (status: {response.status_code})")
                    return True
                else:
                    self.log_test("File Serving", False, 
                                f"File serving error: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("File Serving", False, f"File serving error: {e}")
            return False
    
    async def test_file_upload_validation(self):
        """Test file upload validation"""
        if not self.auth_token:
            self.log_test("Upload Validation", False, "No authentication token")
            return False
        
        try:
            # Test invalid base64
            invalid_data = {
                "file_data": "invalid_base64_data",
                "category": "products",
                "filename": "invalid.jpg"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_url}/files/upload",
                    json=invalid_data,
                    headers=self.get_auth_headers()
                )
                
                # Should return 400 for invalid data
                if response.status_code == 400:
                    self.log_test("Upload Validation", True, 
                                "Correctly rejected invalid base64 data")
                    return True
                else:
                    self.log_test("Upload Validation", False, 
                                f"Expected 400, got {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("Upload Validation", False, f"Validation test error: {e}")
            return False
    
    async def test_large_file_handling(self):
        """Test large file handling"""
        if not self.auth_token:
            self.log_test("Large File Handling", False, "No authentication token")
            return False
        
        try:
            # Create a large test image (should be rejected)
            large_image_data = self.create_test_image_base64(size=(4000, 3000))
            
            upload_data = {
                "file_data": large_image_data,
                "category": "products",
                "filename": "large_test.jpg"
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_url}/files/upload",
                    json=upload_data,
                    headers=self.get_auth_headers()
                )
                
                # Should either succeed (if processed) or be rejected (413)
                if response.status_code in [200, 413]:
                    self.log_test("Large File Handling", True, 
                                f"Large file handled appropriately (status: {response.status_code})")
                    return True
                else:
                    self.log_test("Large File Handling", False, 
                                f"Unexpected response: {response.status_code}")
                    return False
                    
        except Exception as e:
            self.log_test("Large File Handling", False, f"Large file test error: {e}")
            return False
    
    async def test_different_image_formats(self):
        """Test uploading different image formats"""
        if not self.auth_token:
            self.log_test("Image Format Support", False, "No authentication token")
            return False
        
        formats = ['JPEG', 'PNG', 'WEBP']
        format_results = {}
        
        for fmt in formats:
            try:
                test_image_data = self.create_test_image_base64(
                    size=(200, 200), 
                    color='green', 
                    format=fmt
                )
                
                upload_data = {
                    "file_data": test_image_data,
                    "category": "products",
                    "filename": f"test.{fmt.lower()}"
                }
                
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{self.api_url}/files/upload",
                        json=upload_data,
                        headers=self.get_auth_headers()
                    )
                    
                    format_results[fmt] = response.status_code == 200
                    
            except Exception as e:
                format_results[fmt] = False
                print(f"    {fmt} format test error: {e}")
        
        success_count = sum(format_results.values())
        if success_count == len(formats):
            self.log_test("Image Format Support", True, 
                        f"All {len(formats)} formats supported", format_results)
            return True
        else:
            self.log_test("Image Format Support", False, 
                        f"Only {success_count}/{len(formats)} formats supported", format_results)
            return False
    
    async def run_all_tests(self):
        """Run all file upload API tests"""
        print("🧪 Starting File Upload API Tests")
        print("=" * 45)
        
        # Basic connectivity tests
        server_ok = await self.test_server_status()
        if not server_ok:
            print("\\n❌ Server not running. Please start the backend server:")
            print("   python -m uvicorn app.main:app --reload")
            return False
        
        await self.test_api_docs()
        
        # Authentication
        auth_ok = await self.authenticate()
        if not auth_ok:
            print("\\n⚠️ Authentication failed. Check if database is set up with sample data.")
        
        # File upload tests
        await self.test_file_upload_endpoint()
        await self.test_file_serving()
        await self.test_file_upload_validation()
        await self.test_large_file_handling()
        await self.test_different_image_formats()
        
        # Summary
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"\\n📊 API Test Results Summary")
        print("=" * 35)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        if failed == 0:
            print("\\n🎉 All file upload API tests passed!")
        else:
            print(f"\\n⚠️ {failed} test(s) failed. Check server logs for details.")
        
        return failed == 0

async def main():
    """Main test runner"""
    print("Starting API endpoint tests...")
    print("Make sure the backend server is running on http://localhost:8000")
    print()
    
    tester = FileUploadAPITester()
    success = await tester.run_all_tests()
    
    if success:
        print("\\n✅ File upload system is fully functional!")
        print("\\n📋 What works:")
        print("   ✅ File upload endpoints")
        print("   ✅ Image format validation")
        print("   ✅ Authentication integration")
        print("   ✅ Error handling")
        print("\\n📋 Ready for iOS app integration!")
    else:
        print("\\n❌ Some tests failed. Check the issues above.")
        print("\\n💡 Common fixes:")
        print("   1. Make sure the backend server is running")
        print("   2. Ensure database is set up with sample data")
        print("   3. Check that upload directories exist")
        print("   4. Verify all dependencies are installed")
    
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)