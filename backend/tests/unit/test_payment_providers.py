"""
Unit tests for payment providers
"""
import pytest
from unittest.mock import Mock, patch
from decimal import Decimal
from app.services.payment_providers.base import BasePaymentProvider
from app.services.payment_providers.cash_provider import CashPaymentProvider
from app.services.payment_providers.stripe_provider import StripePaymentProvider
from app.services.payment_providers.sumup_provider import SumUpPaymentProvider
from app.services.payment_providers import PaymentStatus, PaymentMethod


class TestBasePaymentProvider:
    """Test base payment provider functionality"""
    
    def test_fee_calculation(self):
        """Test fee calculation methods"""
        provider = BasePaymentProvider()
        
        # Test percentage fee
        provider.fee_percentage = 2.9
        provider.fixed_fee = 0.30
        
        amount = Decimal("100.00")
        fee = provider.calculate_fee(amount)
        expected_fee = (amount * Decimal("0.029")) + Decimal("0.30")
        
        assert fee == expected_fee
        
    def test_validate_amount(self):
        """Test amount validation"""
        provider = BasePaymentProvider()
        
        # Valid amounts
        assert provider.validate_amount(Decimal("10.00")) is True
        assert provider.validate_amount(Decimal("0.01")) is True
        assert provider.validate_amount(Decimal("999999.99")) is True
        
        # Invalid amounts
        assert provider.validate_amount(Decimal("0.00")) is False
        assert provider.validate_amount(Decimal("-10.00")) is False
        assert provider.validate_amount(None) is False


class TestCashPaymentProvider:
    """Test cash payment provider"""
    
    def test_cash_payment_no_fees(self):
        """Test that cash payments have no fees"""
        provider = CashPaymentProvider()
        
        amount = Decimal("100.00")
        fee = provider.calculate_fee(amount)
        
        assert fee == Decimal("0.00")
    
    @patch('app.services.payment_providers.cash_provider.uuid.uuid4')
    def test_process_cash_payment(self, mock_uuid):
        """Test processing cash payment"""
        mock_uuid.return_value = "test-uuid-123"
        provider = CashPaymentProvider()
        
        payment_data = {
            "amount": Decimal("50.00"),
            "currency": "GBP",
            "order_id": "order-123",
            "customer_id": "customer-123"
        }
        
        result = provider.process_payment(payment_data)
        
        assert result["status"] == PaymentStatus.COMPLETED
        assert result["transaction_id"] == "CASH-test-uuid-123"
        assert result["amount"] == Decimal("50.00")
        assert result["fee"] == Decimal("0.00")
        assert result["net_amount"] == Decimal("50.00")


class TestStripePaymentProvider:
    """Test Stripe payment provider"""
    
    def test_stripe_fee_calculation(self):
        """Test Stripe fee calculation (2.9% + 30p)"""
        provider = StripePaymentProvider(api_key="test_key")
        
        test_cases = [
            (Decimal("10.00"), Decimal("0.59")),  # (10 * 0.029) + 0.30 = 0.59
            (Decimal("100.00"), Decimal("3.20")),  # (100 * 0.029) + 0.30 = 3.20
            (Decimal("1.00"), Decimal("0.33")),    # (1 * 0.029) + 0.30 = 0.33
        ]
        
        for amount, expected_fee in test_cases:
            fee = provider.calculate_fee(amount)
            assert fee == expected_fee
    
    @patch('stripe.PaymentIntent')
    def test_stripe_payment_processing(self, mock_payment_intent):
        """Test Stripe payment processing"""
        # Mock Stripe response
        mock_payment_intent.create.return_value = Mock(
            id="pi_test123",
            status="succeeded",
            amount=10000,  # Stripe uses cents
            currency="gbp"
        )
        
        provider = StripePaymentProvider(api_key="test_key")
        
        payment_data = {
            "amount": Decimal("100.00"),
            "currency": "GBP",
            "order_id": "order-123",
            "payment_method_id": "pm_test123",
            "customer_email": "test@example.com"
        }
        
        result = provider.process_payment(payment_data)
        
        assert result["status"] == PaymentStatus.COMPLETED
        assert result["transaction_id"] == "pi_test123"
        assert result["provider"] == "stripe"
        
        # Verify Stripe was called correctly
        mock_payment_intent.create.assert_called_once()
        call_args = mock_payment_intent.create.call_args[1]
        assert call_args["amount"] == 10000  # Converted to cents
        assert call_args["currency"] == "gbp"


class TestSumUpPaymentProvider:
    """Test SumUp payment provider"""
    
    def test_sumup_fee_calculation(self):
        """Test SumUp fee calculation (1.69%)"""
        provider = SumUpPaymentProvider(
            api_key="test_key",
            merchant_code="test_merchant"
        )
        
        test_cases = [
            (Decimal("10.00"), Decimal("0.17")),   # 10 * 0.0169 = 0.169 -> 0.17
            (Decimal("100.00"), Decimal("1.69")),  # 100 * 0.0169 = 1.69
            (Decimal("50.00"), Decimal("0.85")),   # 50 * 0.0169 = 0.845 -> 0.85
        ]
        
        for amount, expected_fee in test_cases:
            fee = provider.calculate_fee(amount)
            assert abs(fee - expected_fee) < Decimal("0.01")
    
    @patch('requests.post')
    def test_sumup_payment_processing(self, mock_post):
        """Test SumUp payment processing"""
        # Mock SumUp response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "sumup_tx_123",
            "status": "SUCCESSFUL",
            "amount": 50.00,
            "currency": "GBP"
        }
        mock_post.return_value = mock_response
        
        provider = SumUpPaymentProvider(
            api_key="test_key",
            merchant_code="test_merchant"
        )
        
        payment_data = {
            "amount": Decimal("50.00"),
            "currency": "GBP",
            "order_id": "order-123",
            "card_token": "card_token_123"
        }
        
        result = provider.process_payment(payment_data)
        
        assert result["status"] == PaymentStatus.COMPLETED
        assert result["transaction_id"] == "sumup_tx_123"
        assert result["provider"] == "sumup"
        
        # Verify API call
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "/v0.1/checkouts" in call_args[0][0]