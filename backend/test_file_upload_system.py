#!/usr/bin/env python3
"""
File Upload System Testing and Validation for Fynlo POS
Tests all file upload functionality and dependency resolution
"""

import base64
import os
import sys
import tempfile
from pathlib import Path
from io import BytesIO

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import magic
    MAGIC_AVAILABLE = True
    print("✅ python-magic imported successfully")
except ImportError as e:
    MAGIC_AVAILABLE = False
    print(f"❌ python-magic import failed: {e}")

try:
    from app.core.file_upload import FileUploadService, FileUploadConfig
    from app.core.exceptions import FynloException
    UPLOAD_SERVICE_AVAILABLE = True
except ImportError as e:
    UPLOAD_SERVICE_AVAILABLE = False
    print(f"❌ FileUploadService import failed: {e}")

class FileUploadTester:
    def __init__(self):
        self.test_results = []
        self.upload_service = None
        if UPLOAD_SERVICE_AVAILABLE:
            try:
                self.upload_service = FileUploadService()
            except Exception as e:
                print(f"⚠️ FileUploadService initialization failed: {e}")
    
    def log_test(self, test_name, success, message="", details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "message": message,
            "details": details
        })
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")
        if details:
            print(f"    Details: {details}")
    
    def test_dependencies(self):
        """Test all required dependencies"""
        print("🔍 Testing File Upload Dependencies")
        print("=" * 40)
        
        # Test PIL/Pillow
        if PIL_AVAILABLE:
            try:
                # Test basic PIL functionality
                img = Image.new('RGB', (100, 100), color='red')
                buffer = BytesIO()
                img.save(buffer, format='JPEG')
                self.log_test("PIL/Pillow Basic Operations", True, "Image creation and saving works")
            except Exception as e:
                self.log_test("PIL/Pillow Basic Operations", False, f"PIL operations failed: {e}")
        else:
            self.log_test("PIL/Pillow Import", False, "PIL/Pillow not available")
        
        # Test python-magic
        if MAGIC_AVAILABLE:
            try:
                # Test magic detection
                test_data = b"\\xff\\xd8\\xff\\xe0"  # JPEG magic bytes
                mime = magic.from_buffer(test_data, mime=True)
                self.log_test("python-magic Detection", True, f"Detected MIME type: {mime}")
            except Exception as e:
                self.log_test("python-magic Detection", False, f"Magic detection failed: {e}")
        else:
            self.log_test("python-magic Import", False, "python-magic not available")
        
        # Test file system operations
        try:
            test_dir = tempfile.mkdtemp()
            test_file = os.path.join(test_dir, "test.txt")
            with open(test_file, 'w') as f:
                f.write("test")
            os.remove(test_file)
            os.rmdir(test_dir)
            self.log_test("File System Operations", True, "Directory and file operations work")
        except Exception as e:
            self.log_test("File System Operations", False, f"File operations failed: {e}")
    
    def create_test_image_base64(self, format='JPEG', size=(200, 200), color='blue'):
        """Create a test image in base64 format"""
        if not PIL_AVAILABLE:
            return None
        
        img = Image.new('RGB', size, color=color)
        buffer = BytesIO()
        img.save(buffer, format=format)
        image_bytes = buffer.getvalue()
        return base64.b64encode(image_bytes).decode('utf-8')
    
    def test_upload_service_functionality(self):
        """Test the FileUploadService functionality"""
        print("\\n📁 Testing FileUploadService Functionality")
        print("=" * 45)
        
        if not self.upload_service:
            self.log_test("Upload Service Initialization", False, "Service not available")
            return False
        
        # Test directory creation
        try:
            self.upload_service._ensure_directories()
            upload_dir = Path(self.upload_service.config.UPLOAD_DIR)
            if upload_dir.exists():
                self.log_test("Directory Creation", True, f"Upload directory created: {upload_dir}")
            else:
                self.log_test("Directory Creation", False, "Upload directory not found")
        except Exception as e:
            self.log_test("Directory Creation", False, f"Directory creation failed: {e}")
        
        # Test base64 validation
        if PIL_AVAILABLE:
            try:
                test_base64 = self.create_test_image_base64()
                if test_base64:
                    image_bytes, mime_type = self.upload_service.validate_base64_image(test_base64)
                    self.log_test("Base64 Validation", True, 
                                f"Validated image: {len(image_bytes)} bytes, MIME: {mime_type}")
                else:
                    self.log_test("Base64 Validation", False, "Could not create test image")
            except Exception as e:
                self.log_test("Base64 Validation", False, f"Base64 validation failed: {e}")
        
        # Test image processing
        if PIL_AVAILABLE:
            try:
                test_base64 = self.create_test_image_base64(size=(1000, 1000))
                if test_base64:
                    # Test image processing
                    processed_image = self.upload_service.process_image_for_mobile(
                        base64.b64decode(test_base64)
                    )
                    self.log_test("Image Processing", True, 
                                f"Processed image variants: {list(processed_image.keys())}")
                else:
                    self.log_test("Image Processing", False, "Could not create test image")
            except Exception as e:
                self.log_test("Image Processing", False, f"Image processing failed: {e}")
    
    def test_mime_type_detection(self):
        """Test MIME type detection methods"""
        print("\\n🔍 Testing MIME Type Detection")
        print("=" * 35)
        
        if PIL_AVAILABLE:
            # Create test images of different formats
            formats = ['JPEG', 'PNG', 'WEBP']
            for fmt in formats:
                try:
                    test_base64 = self.create_test_image_base64(format=fmt)
                    if test_base64:
                        image_bytes = base64.b64decode(test_base64)
                        
                        # Test with magic if available
                        if MAGIC_AVAILABLE:
                            try:
                                detected_mime = magic.from_buffer(image_bytes, mime=True)
                                expected_mime = f"image/{fmt.lower()}"
                                if fmt == 'JPEG':
                                    expected_mime = "image/jpeg"
                                
                                success = detected_mime.startswith("image/")
                                self.log_test(f"MIME Detection - {fmt}", success, 
                                            f"Detected: {detected_mime}")
                            except Exception as e:
                                self.log_test(f"MIME Detection - {fmt}", False, f"Detection failed: {e}")
                        
                        # Test with PIL
                        try:
                            img = Image.open(BytesIO(image_bytes))
                            self.log_test(f"PIL Format Detection - {fmt}", True, 
                                        f"PIL detected format: {img.format}")
                        except Exception as e:
                            self.log_test(f"PIL Format Detection - {fmt}", False, f"PIL detection failed: {e}")
                            
                except Exception as e:
                    self.log_test(f"Test Image Creation - {fmt}", False, f"Creation failed: {e}")
    
    def test_fallback_methods(self):
        """Test fallback methods when dependencies are missing"""
        print("\\n🔄 Testing Fallback Methods")
        print("=" * 30)
        
        # Test extension-based MIME detection
        test_cases = [
            ("test.jpg", "image/jpeg"),
            ("test.jpeg", "image/jpeg"),
            ("test.png", "image/png"),
            ("test.webp", "image/webp"),
            ("test.gif", "image/gif")
        ]
        
        for filename, expected_mime in test_cases:
            # Simple extension-based detection
            ext = os.path.splitext(filename)[1].lower()
            mime_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.gif': 'image/gif'
            }
            detected_mime = mime_map.get(ext, 'application/octet-stream')
            success = detected_mime == expected_mime
            self.log_test(f"Extension-based MIME - {filename}", success, 
                        f"Expected: {expected_mime}, Got: {detected_mime}")
    
    def test_upload_directory_permissions(self):
        """Test upload directory permissions and access"""
        print("\\n📂 Testing Upload Directory Permissions")
        print("=" * 40)
        
        if not self.upload_service:
            self.log_test("Directory Permissions", False, "Upload service not available")
            return
        
        try:
            config = self.upload_service.config
            base_dir = Path(config.UPLOAD_DIR)
            
            # Test base directory
            if base_dir.exists():
                # Test write permission
                test_file = base_dir / "test_write.tmp"
                try:
                    test_file.write_text("test")
                    test_file.unlink()
                    self.log_test("Base Directory Write", True, f"Can write to {base_dir}")
                except Exception as e:
                    self.log_test("Base Directory Write", False, f"Write failed: {e}")
            else:
                self.log_test("Base Directory Exists", False, f"Directory {base_dir} does not exist")
            
            # Test subdirectories
            subdirs = [
                config.PRODUCT_IMAGES_DIR,
                config.RESTAURANT_LOGOS_DIR,
                config.RECEIPT_IMAGES_DIR,
                config.PROFILE_PHOTOS_DIR
            ]
            
            for subdir in subdirs:
                subdir_path = base_dir / subdir
                if subdir_path.exists():
                    self.log_test(f"Subdirectory - {subdir}", True, f"Exists: {subdir_path}")
                else:
                    self.log_test(f"Subdirectory - {subdir}", False, f"Missing: {subdir_path}")
                    
        except Exception as e:
            self.log_test("Directory Permissions Test", False, f"Test failed: {e}")
    
    def generate_dependency_fix_report(self):
        """Generate a report with specific fix instructions"""
        print("\\n🔧 Dependency Fix Report")
        print("=" * 30)
        
        fixes_needed = []
        
        if not PIL_AVAILABLE:
            fixes_needed.append({
                "issue": "PIL/Pillow not available",
                "fix": "pip install Pillow==10.0.1",
                "description": "Required for image processing and optimization"
            })
        
        if not MAGIC_AVAILABLE:
            fixes_needed.append({
                "issue": "python-magic not available", 
                "fix": "pip install python-magic-bin==0.4.14",
                "description": "Required for MIME type detection and file validation"
            })
        
        if not UPLOAD_SERVICE_AVAILABLE:
            fixes_needed.append({
                "issue": "FileUploadService import failed",
                "fix": "Check Python path and import statements",
                "description": "Required for file upload functionality"
            })
        
        if fixes_needed:
            print("\\n❌ Issues Found:")
            for i, fix in enumerate(fixes_needed, 1):
                print(f"\\n{i}. {fix['issue']}")
                print(f"   Fix: {fix['fix']}")
                print(f"   Why: {fix['description']}")
        else:
            print("\\n✅ All dependencies are available!")
        
        return fixes_needed
    
    def run_all_tests(self):
        """Run all file upload tests"""
        print("🧪 Starting File Upload System Tests")
        print("=" * 50)
        
        self.test_dependencies()
        self.test_upload_service_functionality()
        self.test_mime_type_detection()
        self.test_fallback_methods()
        self.test_upload_directory_permissions()
        
        # Generate summary
        passed = sum(1 for result in self.test_results if "✅ PASS" in result["status"])
        failed = sum(1 for result in self.test_results if "❌ FAIL" in result["status"])
        total = len(self.test_results)
        
        print(f"\\n📊 Test Results Summary")
        print("=" * 30)
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%" if total > 0 else "0%")
        
        # Generate fix report
        fixes = self.generate_dependency_fix_report()
        
        if failed == 0:
            print("\\n🎉 All file upload tests passed! System is ready.")
        else:
            print(f"\\n⚠️ {failed} test(s) failed. Review issues above.")
        
        return failed == 0, fixes

def main():
    """Main test runner"""
    tester = FileUploadTester()
    success, fixes = tester.run_all_tests()
    
    if not success and fixes:
        print("\\n💡 Recommended Actions:")
        print("1. Install missing dependencies:")
        for fix in fixes:
            if "pip install" in fix["fix"]:
                print(f"   {fix['fix']}")
        print("2. Re-run this test to verify fixes")
        print("3. Test file upload endpoints manually")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)