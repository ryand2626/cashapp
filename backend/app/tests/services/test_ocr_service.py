import pytest
import base64
from typing import List, Dict, Any

from app.services.ocr_service import OCRService

# Sample base64 encoded strings for testing
# These are not real images, just strings to simulate different inputs for the mock.
IMAGE_BASE64_MILK_RECEIPT = base64.b64encode(b"This is a test receipt for milk and bread.").decode('utf-8')
IMAGE_BASE64_OTHER_RECEIPT = base64.b64encode(b"This is another generic receipt.").decode('utf-8')
IMAGE_EMPTY_RECEIPT = base64.b64encode(b"").decode('utf-8')


@pytest.fixture
def ocr_service() -> OCRService:
    """Provides an instance of the OCRService for testing."""
    return OCRService(ocr_provider_config={"provider": "mock"})

@pytest.mark.asyncio
async def test_parse_receipt_image_mock_milk_input(ocr_service: OCRService):
    """
    Tests the mock OCR service's parse_receipt_image method with input
    that should trigger the 'milk' specific mock response.
    """
    # The mock service checks if "milk" is in the decoded string.
    # Let's create image_bytes that contain "milk".
    image_bytes_with_milk = b"simulated image data for a milk receipt"

    result: List[Dict[str, Any]] = await ocr_service.parse_receipt_image(image_bytes_with_milk)

    assert len(result) == 3
    assert result[0]["raw_text_name"] == "Milk 1L"
    assert result[0]["parsed_quantity"] == 2.0
    assert result[0]["parsed_price"] == 1.50

    assert result[1]["raw_text_name"] == "Bread Loaf"
    assert result[1]["parsed_quantity"] == 1.0
    assert result[1]["parsed_price"] == 2.20

    assert result[2]["raw_text_name"] == "Organic Eggs"

@pytest.mark.asyncio
async def test_parse_receipt_image_mock_other_input(ocr_service: OCRService):
    """
    Tests the mock OCR service's parse_receipt_image method with generic input.
    """
    image_bytes_other = b"simulated image data for another receipt"
    result: List[Dict[str, Any]] = await ocr_service.parse_receipt_image(image_bytes_other)

    assert len(result) == 3 # Mock currently returns 3 generic items
    assert result[0]["raw_text_name"] == "Generic Item A"
    assert result[0]["parsed_quantity"] == 1.0
    assert result[0]["parsed_price"] == 10.00

    assert result[1]["raw_text_name"] == "Another Item B"
    assert result[2]["raw_text_name"] == "Service Charge"


@pytest.mark.asyncio
async def test_parse_receipt_image_empty_input(ocr_service: OCRService):
    """
    Tests the mock OCR service with empty image bytes.
    """
    image_bytes_empty = b""
    result: List[Dict[str, Any]] = await ocr_service.parse_receipt_image(image_bytes_empty)

    # Current mock returns generic items even for empty, let's assert that.
    # A real implementation might return an empty list or raise an error.
    assert len(result) == 3
    assert result[0]["raw_text_name"] == "Generic Item A"

def test_ocr_service_initialization():
    """Tests that OCRService can be initialized."""
    service = OCRService()
    assert service is not None
    assert service.config == {"provider": "mock"} # As per get_ocr_service or direct init default

    service_with_config = OCRService(ocr_provider_config={"provider": "aws", "key": "testkey"})
    assert service_with_config.config is not None
    assert service_with_config.config["provider"] == "aws"

# To run these tests (assuming pytest is set up and in the backend directory):
# Ensure __init__.py files are present in app/tests and app/tests/services if needed for discovery.
# Command: PYTHONPATH=. pytest app/tests/services/test_ocr_service.py

# Note: These tests are for the MOCK ocr_service.
# Actual OCR parsing tests would require:
# 1. Integration with a real OCR library/service.
# 2. Sample receipt images (JPG/PDF) from different vendors.
# 3. More complex assertions on the extracted and structured data.
# 4. Handling of various OCR challenges (blurry images, different formats, etc.).
# The requirement "Unit tests (OCR parser) PDFs/JPG invoices (3 vendors) → expect correct JSON"
# implies testing the real parsing, which is currently out of scope for BE-2 in the plan.
# These tests cover QA-1 for the *current state* of the mocked OCR service.
# Coverage for the real parser would be part of BE-2 implementation.

# Add __init__.py files if they don't exist
# backend/app/tests/__init__.py (empty file)
# backend/app/tests/services/__init__.py (empty file)
