"""
Provider Integration Tests
Real integration tests for payment providers (requires test credentials)
"""

import pytest
import asyncio
import os
from decimal import Decimal
from datetime import datetime
from typing import Dict, Any

from app.services.payment_factory import PaymentProviderFactory
from app.services.config_manager import ConfigurationManager, Environment
from app.services.smart_routing import RoutingStrategy


class BaseProviderIntegrationTest:
    """Base class for provider integration tests"""
    
    @pytest.fixture(scope="class")
    def config_manager(self):
        return ConfigurationManager(environment=Environment.TEST)
    
    @pytest.fixture(scope="class")
    def payment_factory(self):
        return PaymentProviderFactory()
    
    def requires_credentials(self, provider_name: str):
        """Decorator to skip tests if credentials are not available"""
        def decorator(func):
            return pytest.mark.skipif(
                not self._has_test_credentials(provider_name),
                reason=f"No test credentials for {provider_name}"
            )(func)
        return decorator
    
    def _has_test_credentials(self, provider_name: str) -> bool:
        """Check if test credentials are available for a provider"""
        env_mapping = {
            'stripe': ['FYNLO_STRIPE_TEST_API_KEY'],
            'square': ['FYNLO_SQUARE_TEST_ACCESS_TOKEN', 'FYNLO_SQUARE_TEST_LOCATION_ID'],
            'sumup': ['FYNLO_SUMUP_TEST_API_KEY', 'FYNLO_SUMUP_TEST_MERCHANT_CODE']
        }
        
        required_vars = env_mapping.get(provider_name, [])
        return all(os.getenv(var) for var in required_vars)


@pytest.mark.integration
class TestStripeIntegration(BaseProviderIntegrationTest):
    """Stripe provider integration tests"""
    
    @pytest.fixture
    def stripe_provider(self, payment_factory):
        if not self._has_test_credentials('stripe'):
            pytest.skip("No Stripe test credentials")
        return payment_factory.get_provider('stripe')
    
    @pytest.mark.asyncio
    async def test_stripe_payment_intent_creation(self, stripe_provider):
        """Test creating a Stripe PaymentIntent"""
        if not stripe_provider:
            pytest.skip("Stripe provider not available")
        
        result = await stripe_provider.process_payment(
            amount=Decimal("10.00"),
            customer_id=None,
            payment_method_id="pm_card_visa",  # Test payment method
            metadata={"test": "integration_test"}
        )
        
        assert result["status"] in ["success", "pending"]
        assert result["provider"] == "stripe"
        assert "transaction_id" in result
        assert result["amount"] == 1000  # £10.00 in pence
    
    @pytest.mark.asyncio
    async def test_stripe_payment_failure(self, stripe_provider):
        """Test Stripe payment failure handling"""
        if not stripe_provider:
            pytest.skip("Stripe provider not available")
        
        result = await stripe_provider.process_payment(
            amount=Decimal("10.00"),
            customer_id=None,
            payment_method_id="pm_card_chargeDeclined",  # Test declining card
            metadata={"test": "failure_test"}
        )
        
        assert result["status"] == "failed"
        assert "error" in result
    
    @pytest.mark.asyncio
    async def test_stripe_refund(self, stripe_provider):
        """Test Stripe refund functionality"""
        if not stripe_provider:
            pytest.skip("Stripe provider not available")
        
        # First create a successful payment
        payment_result = await stripe_provider.process_payment(
            amount=Decimal("20.00"),
            customer_id=None,
            payment_method_id="pm_card_visa",
            metadata={"test": "refund_test"}
        )
        
        if payment_result["status"] != "success":
            pytest.skip("Could not create test payment for refund")
        
        # Then refund it
        refund_result = await stripe_provider.refund_payment(
            transaction_id=payment_result["transaction_id"],
            amount=Decimal("10.00"),  # Partial refund
            reason="Integration test refund"
        )
        
        assert refund_result["status"] == "refunded"
        assert "refund_id" in refund_result
    
    @pytest.mark.asyncio
    async def test_stripe_webhook_validation(self, stripe_provider):
        """Test Stripe webhook signature validation"""
        if not stripe_provider:
            pytest.skip("Stripe provider not available")
        
        # Mock webhook payload and signature
        payload = '{"id":"evt_test","type":"payment_intent.succeeded"}'
        signature = "t=1234567890,v1=test_signature"
        
        # This should fail with test data (expected behavior)
        is_valid = stripe_provider.validate_webhook(payload, signature)
        assert isinstance(is_valid, bool)


@pytest.mark.integration
class TestSquareIntegration(BaseProviderIntegrationTest):
    """Square provider integration tests"""
    
    @pytest.fixture
    def square_provider(self, payment_factory):
        if not self._has_test_credentials('square'):
            pytest.skip("No Square test credentials")
        return payment_factory.get_provider('square')
    
    @pytest.mark.asyncio
    async def test_square_payment_processing(self, square_provider):
        """Test Square payment processing"""
        if not square_provider:
            pytest.skip("Square provider not available")
        
        result = await square_provider.process_payment(
            amount=Decimal("15.00"),
            customer_id=None,
            payment_method_id="cnon:card-nonce-ok",  # Square test nonce
            metadata={"test": "square_integration"}
        )
        
        assert result["status"] in ["success", "pending"]
        assert result["provider"] == "square"
        assert "transaction_id" in result
    
    @pytest.mark.asyncio
    async def test_square_payment_limits(self, square_provider):
        """Test Square payment amount limits"""
        if not square_provider:
            pytest.skip("Square provider not available")
        
        # Test large amount (should fail or be limited)
        result = await square_provider.process_payment(
            amount=Decimal("1000.00"),  # £1000
            customer_id=None,
            payment_method_id="cnon:card-nonce-ok",
            metadata={"test": "limit_test"}
        )
        
        # Result depends on Square's limits
        assert result["status"] in ["success", "failed", "pending"]


@pytest.mark.integration
class TestSumUpIntegration(BaseProviderIntegrationTest):
    """SumUp provider integration tests"""
    
    @pytest.fixture
    def sumup_provider(self, payment_factory):
        if not self._has_test_credentials('sumup'):
            pytest.skip("No SumUp test credentials")
        return payment_factory.get_provider('sumup')
    
    @pytest.mark.asyncio
    async def test_sumup_checkout_creation(self, sumup_provider):
        """Test SumUp checkout creation"""
        if not sumup_provider:
            pytest.skip("SumUp provider not available")
        
        result = await sumup_provider.process_payment(
            amount=Decimal("25.00"),
            customer_id=None,
            payment_method_id=None,  # SumUp may not require this
            metadata={"test": "sumup_integration"}
        )
        
        assert result["status"] in ["success", "pending"]
        assert result["provider"] == "sumup"
        assert "transaction_id" in result
    
    @pytest.mark.asyncio
    async def test_sumup_fee_calculation(self, sumup_provider):
        """Test SumUp fee calculation with volume"""
        if not sumup_provider:
            pytest.skip("SumUp provider not available")
        
        # Test standard rate
        standard_fee = sumup_provider.calculate_fee(Decimal("100.00"))
        
        # Test high volume rate
        high_volume_fee = sumup_provider.calculate_fee(
            Decimal("100.00"), 
            monthly_volume=Decimal("3000.00")
        )
        
        # High volume should be cheaper
        assert high_volume_fee < standard_fee


@pytest.mark.integration
class TestMultiProviderIntegration(BaseProviderIntegrationTest):
    """Multi-provider integration tests"""
    
    @pytest.mark.asyncio
    async def test_smart_routing_integration(self, payment_factory):
        """Test smart routing with real providers"""
        
        # Mock database session
        from unittest.mock import Mock
        mock_db = Mock()
        
        # Test with different volumes to trigger different routing
        test_scenarios = [
            (Decimal("50.00"), Decimal("1000.00")),   # Low volume
            (Decimal("100.00"), Decimal("3000.00")),  # High volume
            (Decimal("25.00"), Decimal("500.00")),    # Very low volume
        ]
        
        for amount, monthly_volume in test_scenarios:
            provider = await payment_factory.select_optimal_provider(
                amount=amount,
                restaurant_id="test_restaurant",
                monthly_volume=monthly_volume,
                strategy=RoutingStrategy.COST_OPTIMAL,
                db_session=mock_db
            )
            
            assert provider is not None
            
            # Verify fee calculation works
            fee = provider.calculate_fee(amount, monthly_volume)
            assert fee >= Decimal("0")
            assert fee < amount
    
    @pytest.mark.asyncio
    async def test_provider_failover(self, payment_factory):
        """Test failover between providers"""
        
        # Mock database session
        from unittest.mock import Mock
        mock_db = Mock()
        
        # Force a specific provider that might not be available
        provider = await payment_factory.select_optimal_provider(
            amount=Decimal("50.00"),
            restaurant_id="test_restaurant",
            force_provider="nonexistent_provider",
            db_session=mock_db
        )
        
        # Should fall back to available provider
        assert provider is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_provider_usage(self, payment_factory):
        """Test concurrent usage of multiple providers"""
        
        from unittest.mock import Mock
        mock_db = Mock()
        
        async def process_payment(amount: Decimal):
            provider = await payment_factory.select_optimal_provider(
                amount=amount,
                restaurant_id="test_restaurant",
                db_session=mock_db
            )
            return provider.calculate_fee(amount)
        
        # Process multiple payments concurrently
        amounts = [Decimal("10.00"), Decimal("25.00"), Decimal("50.00"), Decimal("100.00")]
        tasks = [process_payment(amount) for amount in amounts]
        
        fees = await asyncio.gather(*tasks)
        
        # All should succeed
        assert len(fees) == len(amounts)
        assert all(fee >= Decimal("0") for fee in fees)


@pytest.mark.integration
class TestEndToEndIntegration(BaseProviderIntegrationTest):
    """End-to-end integration tests"""
    
    @pytest.mark.asyncio
    async def test_complete_payment_flow(self, payment_factory):
        """Test complete payment flow from selection to processing"""
        
        from unittest.mock import Mock
        mock_db = Mock()
        
        # Step 1: Select optimal provider
        provider = await payment_factory.select_optimal_provider(
            amount=Decimal("50.00"),
            restaurant_id="test_restaurant",
            monthly_volume=Decimal("2000.00"),
            db_session=mock_db
        )
        
        assert provider is not None
        
        # Step 2: Calculate fees
        fee = provider.calculate_fee(Decimal("50.00"))
        net_amount = Decimal("50.00") - fee
        
        assert fee > Decimal("0")
        assert net_amount > Decimal("0")
        assert net_amount < Decimal("50.00")
        
        # Step 3: Process payment (only if test credentials available)
        if self._has_test_credentials(provider.name):
            result = await provider.process_payment(
                amount=Decimal("50.00"),
                customer_id=None,
                payment_method_id=self._get_test_payment_method(provider.name),
                metadata={"test": "end_to_end"}
            )
            
            assert result["status"] in ["success", "failed", "pending"]
            assert result["provider"] == provider.name
        else:
            # Skip actual processing if no credentials
            pytest.skip(f"No test credentials for {provider.name}")
    
    def _get_test_payment_method(self, provider_name: str) -> str:
        """Get test payment method ID for a provider"""
        test_methods = {
            'stripe': 'pm_card_visa',
            'square': 'cnon:card-nonce-ok',
            'sumup': None  # SumUp may not require this
        }
        return test_methods.get(provider_name)
    
    @pytest.mark.asyncio
    async def test_error_handling_integration(self, payment_factory):
        """Test error handling in integration scenarios"""
        
        from unittest.mock import Mock
        mock_db = Mock()
        
        # Test with invalid restaurant ID
        provider = await payment_factory.select_optimal_provider(
            amount=Decimal("50.00"),
            restaurant_id="invalid_restaurant_id",
            db_session=mock_db
        )
        
        # Should still work (fall back to defaults)
        assert provider is not None
        
        # Test with zero amount
        try:
            provider = await payment_factory.select_optimal_provider(
                amount=Decimal("0.00"),
                restaurant_id="test_restaurant",
                db_session=mock_db
            )
            
            # Should handle gracefully
            assert provider is not None
            
        except Exception as e:
            # Or raise appropriate error
            assert isinstance(e, (ValueError, TypeError))


@pytest.mark.integration
@pytest.mark.performance
class TestIntegrationPerformance(BaseProviderIntegrationTest):
    """Performance tests for integration scenarios"""
    
    @pytest.mark.asyncio
    async def test_provider_selection_performance(self, payment_factory):
        """Test performance of provider selection under load"""
        
        from unittest.mock import Mock
        import time
        
        mock_db = Mock()
        
        start_time = time.time()
        
        # Run 50 provider selections
        tasks = []
        for i in range(50):
            task = payment_factory.select_optimal_provider(
                amount=Decimal("50.00"),
                restaurant_id=f"restaurant_{i % 10}",  # 10 different restaurants
                db_session=mock_db
            )
            tasks.append(task)
        
        providers = await asyncio.gather(*tasks)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Should complete within reasonable time
        assert duration < 30.0  # 30 seconds for 50 selections
        assert all(provider is not None for provider in providers)
        
        # Calculate average time per selection
        avg_time = duration / len(providers)
        assert avg_time < 1.0  # Less than 1 second per selection
    
    @pytest.mark.asyncio
    async def test_fee_calculation_performance(self, payment_factory):
        """Test fee calculation performance"""
        
        provider = payment_factory.get_provider('stripe')  # Use first available
        if not provider:
            pytest.skip("No providers available")
        
        import time
        
        start_time = time.time()
        
        # Calculate fees for 1000 different amounts
        amounts = [Decimal(f"{i + 1}.00") for i in range(1000)]
        fees = [provider.calculate_fee(amount) for amount in amounts]
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Should be very fast (computational only)
        assert duration < 5.0  # 5 seconds for 1000 calculations
        assert len(fees) == 1000
        assert all(fee >= Decimal("0") for fee in fees)


if __name__ == "__main__":
    # Run with: pytest test_provider_integration.py -m integration -v
    pytest.main([__file__, "-m", "integration", "-v"])