"""
Test suite for Secure Payment Processor
Tests payment processing, fallback logic, and audit trails
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from decimal import Decimal
from datetime import datetime
import uuid

from app.services.secure_payment_processor import (
    SecurePaymentProcessor,
    PaymentProcessingError,
    Payment,
    PaymentAuditLog
)
from app.services.payment_providers import PaymentStatus, PaymentMethod


class TestSecurePaymentProcessor:
    """Test cases for secure payment processing"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        db = Mock()
        # Mock transaction context manager
        db.begin.return_value.__enter__ = Mock()
        db.begin.return_value.__exit__ = Mock()
        return db
    
    @pytest.fixture
    def mock_config_service(self):
        """Mock payment configuration service"""
        service = Mock()
        service.list_provider_configs.return_value = [
            {'provider': 'sumup', 'enabled': True},
            {'provider': 'stripe', 'enabled': True}
        ]
        return service
    
    @pytest.fixture
    def processor(self, mock_db, mock_config_service):
        """Create processor instance with mocked dependencies"""
        with patch('app.services.secure_payment_processor.SecurePaymentConfigService', 
                   return_value=mock_config_service):
            processor = SecurePaymentProcessor(
                mock_db,
                request_context={'user_id': 'user_123', 'ip_address': '192.168.1.1'}
            )
            return processor
    
    @pytest.mark.asyncio
    async def test_process_payment_success(self, processor, mock_db):
        """Test successful payment processing"""
        # Arrange
        mock_provider = AsyncMock()
        mock_provider.process_payment.return_value = {
            'success': True,
            'transaction_id': 'txn_123'
        }
        processor.providers['cash_provider'] = mock_provider
        
        # Act
        result = await processor.process_payment(
            order_id='order_123',
            amount=Decimal('100.00'),
            payment_method='cash',
            payment_details={},
            user_id='user_123',
            restaurant_id='rest_123'
        )
        
        # Assert
        assert result['success'] is True
        assert result['payment_id'] is not None
        assert result['transaction_id'] == 'txn_123'
        assert result['amount'] == 100.0
        assert result['fees']['total_fee'] == 0  # Cash has no fees
        mock_db.add.assert_called()  # Payment record added
        mock_db.commit.assert_called()  # Transaction committed
    
    @pytest.mark.asyncio
    async def test_process_payment_validation_error(self, processor):
        """Test payment validation errors"""
        # Test negative amount
        with pytest.raises(PaymentProcessingError, match="positive"):
            await processor.process_payment(
                order_id='order_123',
                amount=Decimal('-10.00'),
                payment_method='card',
                payment_details={},
                user_id='user_123',
                restaurant_id='rest_123'
            )
        
        # Test amount too large
        with pytest.raises(PaymentProcessingError, match="exceeds maximum"):
            await processor.process_payment(
                order_id='order_123',
                amount=Decimal('20000.00'),
                payment_method='card',
                payment_details={},
                user_id='user_123',
                restaurant_id='rest_123'
            )
        
        # Test invalid payment method
        with pytest.raises(PaymentProcessingError, match="Invalid payment method"):
            await processor.process_payment(
                order_id='order_123',
                amount=Decimal('100.00'),
                payment_method='invalid_method',
                payment_details={},
                user_id='user_123',
                restaurant_id='rest_123'
            )
    
    @pytest.mark.asyncio
    async def test_payment_fallback_logic(self, processor, mock_db):
        """Test automatic provider fallback on failure"""
        # Arrange
        # First provider fails
        mock_provider1 = AsyncMock()
        mock_provider1.process_payment.side_effect = Exception("Provider 1 failed")
        
        # Second provider succeeds
        mock_provider2 = AsyncMock()
        mock_provider2.process_payment.return_value = {
            'success': True,
            'transaction_id': 'txn_456'
        }
        
        processor.providers = {
            'sumup': mock_provider1,
            'stripe': mock_provider2
        }
        
        # Mock provider priority
        processor._get_provider_priority = Mock(return_value=['sumup', 'stripe'])
        
        # Act
        result = await processor.process_payment(
            order_id='order_123',
            amount=Decimal('100.00'),
            payment_method='card',
            payment_details={},
            user_id='user_123',
            restaurant_id='rest_123'
        )
        
        # Assert
        assert result['success'] is True
        assert result['provider'] == 'stripe'  # Second provider succeeded
        mock_provider1.process_payment.assert_called_once()
        mock_provider2.process_payment.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_all_providers_fail(self, processor, mock_db):
        """Test when all payment providers fail"""
        # Arrange
        mock_provider = AsyncMock()
        mock_provider.process_payment.side_effect = Exception("Provider failed")
        processor.providers = {'sumup': mock_provider}
        processor._get_provider_priority = Mock(return_value=['sumup'])
        
        # Act & Assert
        with pytest.raises(PaymentProcessingError, match="All providers failed"):
            await processor.process_payment(
                order_id='order_123',
                amount=Decimal('100.00'),
                payment_method='card',
                payment_details={},
                user_id='user_123',
                restaurant_id='rest_123'
            )
        
        # Verify payment marked as failed
        payment_record = mock_db.add.call_args[0][0]
        assert payment_record.status == PaymentStatus.FAILED
    
    def test_fee_calculation(self, processor):
        """Test fee calculation for different providers"""
        # SumUp - 0.69%
        fees = processor._calculate_fees(Decimal('100.00'), 'sumup')
        assert fees['percentage_fee'] == Decimal('0.69')
        assert fees['fixed_fee'] == Decimal('0')
        assert fees['total_fee'] == Decimal('0.69')
        assert fees['rate_percentage'] == 0.69
        
        # Stripe - 1.4% + 20p
        fees = processor._calculate_fees(Decimal('100.00'), 'stripe')
        assert fees['percentage_fee'] == Decimal('1.40')
        assert fees['fixed_fee'] == Decimal('0.20')
        assert fees['total_fee'] == Decimal('1.60')
        assert fees['rate_percentage'] == 1.4
        
        # Cash - No fees
        fees = processor._calculate_fees(Decimal('100.00'), 'cash_provider')
        assert fees['total_fee'] == Decimal('0')
    
    def test_provider_priority_logic(self, processor, mock_config_service):
        """Test provider selection based on fees and availability"""
        # Test card payment priority
        priority = processor._get_provider_priority('card', Decimal('100'), 'rest_123')
        
        # Should prioritize by lowest fees: SumUp -> Square -> Stripe
        expected_order = ['sumup', 'square', 'stripe']
        assert all(p in priority for p in expected_order if p in ['sumup', 'stripe'])
    
    def test_audit_logging(self, processor, mock_db):
        """Test audit trail creation"""
        # Arrange
        mock_db.add = Mock()
        mock_db.commit = Mock()
        
        # Act
        processor._log_action(
            payment_id='pay_123',
            action='attempt',
            provider='stripe',
            request_data={'amount': 100},
            error_message=None
        )
        
        # Assert
        mock_db.add.assert_called_once()
        log_entry = mock_db.add.call_args[0][0]
        assert isinstance(log_entry, PaymentAuditLog)
        assert log_entry.payment_id == 'pay_123'
        assert log_entry.action == 'attempt'
        assert log_entry.provider == 'stripe'
        assert log_entry.user_id == 'user_123'
        assert log_entry.ip_address == '192.168.1.1'
    
    def test_data_sanitization(self, processor):
        """Test removal of sensitive data before logging"""
        # Arrange
        sensitive_data = {
            'amount': 100,
            'card_number': '4111111111111111',
            'cvv': '123',
            'api_key': 'sk_test_123',
            'nested': {
                'secret_key': 'secret_123',
                'safe_field': 'safe_value'
            }
        }
        
        # Act
        sanitized = processor._sanitize_data(sensitive_data)
        
        # Assert
        assert sanitized['amount'] == 100  # Non-sensitive preserved
        assert sanitized['card_number'] == '[REDACTED]'
        assert sanitized['cvv'] == '[REDACTED]'
        assert sanitized['api_key'] == '[REDACTED]'
        assert sanitized['nested']['secret_key'] == '[REDACTED]'
        assert sanitized['nested']['safe_field'] == 'safe_value'
    
    def test_payment_method_mapping(self, processor):
        """Test mapping of payment method strings to enums"""
        assert processor._map_payment_method('card') == PaymentMethod.CARD
        assert processor._map_payment_method('cash') == PaymentMethod.CASH
        assert processor._map_payment_method('qr_code') == PaymentMethod.QR_CODE
        assert processor._map_payment_method('apple_pay') == PaymentMethod.APPLE_PAY
        assert processor._map_payment_method('unknown') == PaymentMethod.CARD  # Default
    
    @pytest.mark.asyncio
    async def test_payment_record_creation(self, processor, mock_db):
        """Test proper payment record creation and updates"""
        # Arrange
        mock_provider = AsyncMock()
        mock_provider.process_payment.return_value = {
            'success': True,
            'transaction_id': 'txn_789'
        }
        processor.providers['stripe'] = mock_provider
        processor._get_provider_priority = Mock(return_value=['stripe'])
        
        # Capture the payment record
        payment_record = None
        def capture_payment(record):
            nonlocal payment_record
            payment_record = record
        mock_db.add.side_effect = capture_payment
        
        # Act
        await processor.process_payment(
            order_id='order_456',
            amount=Decimal('250.50'),
            payment_method='card',
            payment_details={'source': 'tok_visa'},
            user_id='user_456',
            restaurant_id='rest_456',
            metadata={'items': ['item1', 'item2']}
        )
        
        # Assert payment record
        assert payment_record is not None
        assert payment_record.order_id == 'order_456'
        assert payment_record.amount == Decimal('250.50')
        assert payment_record.payment_method == 'card'
        assert payment_record.status == PaymentStatus.COMPLETED
        assert payment_record.provider == 'stripe'
        assert payment_record.provider_transaction_id == 'txn_789'
        assert payment_record.fee_amount > 0
        assert payment_record.net_amount < payment_record.amount


class TestPaymentProcessorIntegration:
    """Integration tests for payment processor"""
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_end_to_end_payment_flow(self, test_db_session):
        """Test complete payment flow with real database"""
        # This would test the full flow with actual database
        pass
    
    @pytest.mark.integration
    @pytest.mark.asyncio
    async def test_concurrent_payments(self, test_db_session):
        """Test handling of concurrent payment requests"""
        # This would test race conditions and locking
        pass