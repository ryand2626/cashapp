"""
Comprehensive tests for payment providers
"""

import pytest
import asyncio
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from app.services.payment_providers import PaymentProvider, StripeProvider, SquareProvider, SumUpProvider
from app.services.payment_factory import PaymentProviderFactory
from app.services.smart_routing import SmartRoutingService, RoutingStrategy
from app.services.payment_analytics import PaymentAnalyticsService
from app.services.config_manager import ConfigurationManager, Environment

class TestPaymentProviders:
    """Test suite for payment provider implementations"""
    
    @pytest.fixture
    def stripe_config(self):
        return {
            "api_key": "sk_test_123456789",
            "webhook_secret": "whsec_test123"
        }
    
    @pytest.fixture
    def square_config(self):
        return {
            "access_token": "sandbox_token_123",
            "location_id": "test_location_123",
            "environment": "sandbox"
        }
    
    @pytest.fixture
    def sumup_config(self):
        return {
            "api_key": "sumup_test_key_123",
            "merchant_code": "SUMUP_TEST_MERCHANT"
        }
    
    @pytest.fixture
    def stripe_provider(self, stripe_config):
        return StripeProvider(stripe_config)
    
    @pytest.fixture
    def square_provider(self, square_config):
        return SquareProvider(square_config)
    
    @pytest.fixture
    def sumup_provider(self, sumup_config):
        return SumUpProvider(sumup_config)
    
    def test_stripe_provider_initialization(self, stripe_provider, stripe_config):
        """Test Stripe provider initialization"""
        assert stripe_provider.name == "stripe"
        assert stripe_provider.config == stripe_config
        assert stripe_provider.is_available()
    
    def test_square_provider_initialization(self, square_provider, square_config):
        """Test Square provider initialization"""
        assert square_provider.name == "square"
        assert square_provider.config == square_config
        assert square_provider.is_available()
    
    def test_sumup_provider_initialization(self, sumup_provider, sumup_config):
        """Test SumUp provider initialization"""
        assert sumup_provider.name == "sumup"
        assert sumup_provider.config == sumup_config
        assert sumup_provider.is_available()
    
    def test_stripe_fee_calculation(self, stripe_provider):
        """Test Stripe fee calculation"""
        # Test various amounts
        test_cases = [
            (Decimal("10.00"), Decimal("0.34")),  # £10.00 -> 1.4% + 20p = £0.34
            (Decimal("50.00"), Decimal("0.90")),  # £50.00 -> 1.4% + 20p = £0.90
            (Decimal("100.00"), Decimal("1.60")), # £100.00 -> 1.4% + 20p = £1.60
        ]
        
        for amount, expected_fee in test_cases:
            calculated_fee = stripe_provider.calculate_fee(amount)
            assert abs(calculated_fee - expected_fee) < Decimal("0.01")
    
    def test_square_fee_calculation(self, square_provider):
        """Test Square fee calculation"""
        # Test various amounts
        test_cases = [
            (Decimal("10.00"), Decimal("0.18")),  # £10.00 -> 1.75% = £0.18
            (Decimal("50.00"), Decimal("0.88")),  # £50.00 -> 1.75% = £0.88
            (Decimal("100.00"), Decimal("1.75")), # £100.00 -> 1.75% = £1.75
        ]
        
        for amount, expected_fee in test_cases:
            calculated_fee = square_provider.calculate_fee(amount)
            assert abs(calculated_fee - expected_fee) < Decimal("0.01")
    
    def test_sumup_fee_calculation(self, sumup_provider):
        """Test SumUp fee calculation"""
        # Test standard rate (1.69%)
        standard_fee = sumup_provider.calculate_fee(Decimal("100.00"))
        assert abs(standard_fee - Decimal("1.69")) < Decimal("0.01")
        
        # Test high volume rate (0.69% + monthly fee)
        monthly_volume = Decimal("3000.00")  # Above £2,714 threshold
        high_volume_fee = sumup_provider.calculate_fee(Decimal("100.00"), monthly_volume)
        assert high_volume_fee < standard_fee  # Should be cheaper
    
    @pytest.mark.asyncio
    async def test_stripe_payment_processing(self, stripe_provider):
        """Test Stripe payment processing"""
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock successful payment
            mock_create.return_value = Mock(
                id="pi_test123",
                status="succeeded",
                amount=5000,  # £50.00 in pence
                currency="gbp"
            )
            
            result = await stripe_provider.process_payment(
                amount=Decimal("50.00"),
                customer_id="cus_test123",
                payment_method_id="pm_test123"
            )
            
            assert result["status"] == "success"
            assert result["provider"] == "stripe"
            assert result["transaction_id"] == "pi_test123"
            assert result["amount"] == 5000  # In pence
    
    @pytest.mark.asyncio
    async def test_payment_failure_handling(self, stripe_provider):
        """Test payment failure handling"""
        with patch('stripe.PaymentIntent.create') as mock_create:
            # Mock failed payment
            mock_create.side_effect = Exception("Payment failed")
            
            result = await stripe_provider.process_payment(
                amount=Decimal("50.00"),
                customer_id="cus_test123",
                payment_method_id="pm_test123"
            )
            
            assert result["status"] == "failed"
            assert "error" in result
    
    @pytest.mark.asyncio
    async def test_refund_processing(self, stripe_provider):
        """Test refund processing"""
        with patch('stripe.Refund.create') as mock_create:
            # Mock successful refund
            mock_create.return_value = Mock(
                id="re_test123",
                status="succeeded",
                amount=2500  # £25.00 refund
            )
            
            result = await stripe_provider.refund_payment(
                transaction_id="pi_test123",
                amount=Decimal("25.00")
            )
            
            assert result["status"] == "refunded"
            assert result["refund_id"] == "re_test123"


class TestPaymentFactory:
    """Test suite for payment factory and smart routing"""
    
    @pytest.fixture
    def payment_factory(self):
        return PaymentProviderFactory()
    
    @pytest.fixture
    def mock_db_session(self):
        return Mock()
    
    def test_factory_initialization(self, payment_factory):
        """Test payment factory initialization"""
        available_providers = payment_factory.get_available_providers()
        assert isinstance(available_providers, list)
        # Should have at least one provider available (even if mock)
    
    @pytest.mark.asyncio
    async def test_simple_provider_selection(self, payment_factory):
        """Test simple cost-based provider selection"""
        # Mock the provider selection logic
        with patch.object(payment_factory, '_get_restaurant_monthly_volume', return_value=Decimal("2000")):
            provider = await payment_factory._select_provider_simple(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant",
                monthly_volume=Decimal("2000")
            )
            
            assert provider is not None
    
    @pytest.mark.asyncio
    async def test_optimal_provider_selection(self, payment_factory, mock_db_session):
        """Test optimal provider selection with smart routing"""
        # Test high volume scenario (should prefer SumUp)
        high_volume = Decimal("3000")  # Above £2,714 threshold
        
        with patch.object(payment_factory, '_get_restaurant_monthly_volume', return_value=high_volume):
            provider = await payment_factory.select_optimal_provider(
                amount=Decimal("100.00"),
                restaurant_id="test_restaurant",
                monthly_volume=high_volume,
                db_session=mock_db_session
            )
            
            assert provider is not None
    
    def test_cost_calculation(self, payment_factory):
        """Test provider cost calculations"""
        costs = payment_factory._calculate_provider_costs(
            amount=Decimal("100.00"),
            monthly_volume=Decimal("2000.00")
        )
        
        assert isinstance(costs, dict)
        # Should have costs for available providers
        for provider_name, cost in costs.items():
            assert isinstance(cost, Decimal)
            assert cost >= 0


class TestSmartRouting:
    """Test suite for smart routing service"""
    
    @pytest.fixture
    def mock_analytics(self):
        return Mock(spec=PaymentAnalyticsService)
    
    @pytest.fixture
    def smart_router(self, mock_analytics):
        return SmartRoutingService(mock_analytics)
    
    @pytest.mark.asyncio
    async def test_routing_strategies(self, smart_router):
        """Test different routing strategies"""
        strategies = [
            RoutingStrategy.COST_OPTIMAL,
            RoutingStrategy.RELIABILITY_FIRST,
            RoutingStrategy.SPEED_OPTIMAL,
            RoutingStrategy.BALANCED,
            RoutingStrategy.VOLUME_AWARE
        ]
        
        for strategy in strategies:
            weights = smart_router._get_strategy_weights(strategy)
            
            assert isinstance(weights, dict)
            assert all(0 <= weight <= 1 for weight in weights.values())
            assert abs(sum(weights.values()) - 1.0) < 0.01  # Should sum to 1
    
    @pytest.mark.asyncio
    async def test_provider_scoring(self, smart_router):
        """Test provider scoring algorithm"""
        # Mock analytics data
        mock_analytics_data = {
            'monthly_volume': 2500.0,
            'health_scores': {
                'stripe': {'overall_score': 85, 'factors': {'reliability': 90}},
                'square': {'overall_score': 80, 'factors': {'reliability': 85}},
                'sumup': {'overall_score': 88, 'factors': {'reliability': 87}}
            }
        }
        
        scores = await smart_router._score_providers(
            amount=Decimal("50.00"),
            restaurant_id="test_restaurant",
            analytics_data=mock_analytics_data,
            strategy=RoutingStrategy.BALANCED
        )
        
        assert len(scores) > 0
        assert all(hasattr(score, 'total_score') for score in scores)
        assert all(0 <= score.total_score <= 100 for score in scores)
    
    @pytest.mark.asyncio
    async def test_routing_decision(self, smart_router):
        """Test routing decision making"""
        # Mock the routing context and scoring
        with patch.object(smart_router, '_get_routing_context') as mock_context, \
             patch.object(smart_router, '_score_providers') as mock_scoring:
            
            mock_context.return_value = {'monthly_volume': 2500.0, 'health_scores': {}}
            mock_scoring.return_value = [
                Mock(provider='sumup', total_score=90.0, cost_score=85, reliability_score=88),
                Mock(provider='stripe', total_score=85.0, cost_score=80, reliability_score=90)
            ]
            
            decision = await smart_router.route_payment(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant",
                strategy=RoutingStrategy.BALANCED
            )
            
            assert decision.selected_provider == 'sumup'  # Should select highest scoring
            assert 0 <= decision.confidence <= 1
            assert len(decision.reasoning) > 0


class TestConfiguration:
    """Test suite for configuration management"""
    
    @pytest.fixture
    def config_manager(self):
        return ConfigurationManager(environment=Environment.TEST)
    
    def test_environment_detection(self, config_manager):
        """Test environment detection"""
        assert config_manager.environment == Environment.TEST
    
    def test_provider_configuration(self, config_manager):
        """Test provider configuration management"""
        # Add a test provider
        config_manager.update_provider_config(
            "test_provider",
            enabled=True,
            api_key="test_key_123",
            environment="test"
        )
        
        provider_config = config_manager.get_provider_config("test_provider")
        assert provider_config is not None
        assert provider_config.enabled is True
        assert provider_config.api_key == "test_key_123"
    
    def test_feature_flags(self, config_manager):
        """Test feature flag management"""
        # Test default feature flags
        assert config_manager.is_feature_enabled("smart_routing_enabled")
        
        # Update feature flag
        config_manager.update_feature_flag("auto_refunds_enabled", True)
        assert config_manager.is_feature_enabled("auto_refunds_enabled")
    
    def test_configuration_validation(self, config_manager):
        """Test configuration validation"""
        # Add an invalid configuration
        config_manager.update_provider_config(
            "invalid_provider",
            enabled=True,
            api_key=None  # Missing required API key
        )
        
        # Validation should detect the issue
        # Note: In a real implementation, you'd check validation logs
        enabled_providers = config_manager.get_enabled_providers()
        assert "invalid_provider" in enabled_providers  # Still added but flagged
    
    def test_configuration_summary(self, config_manager):
        """Test configuration summary generation"""
        summary = config_manager.get_configuration_summary()
        
        assert "environment" in summary
        assert "providers" in summary
        assert "routing" in summary
        assert "features" in summary
        assert "security" in summary
        
        assert summary["environment"] == "test"


class TestIntegration:
    """Integration tests for the complete payment system"""
    
    @pytest.fixture
    def payment_system(self):
        """Set up a complete payment system for integration testing"""
        config_manager = ConfigurationManager(environment=Environment.TEST)
        payment_factory = PaymentProviderFactory()
        return {
            'config': config_manager,
            'factory': payment_factory
        }
    
    @pytest.mark.asyncio
    async def test_end_to_end_payment_flow(self, payment_system):
        """Test complete payment flow from routing to processing"""
        factory = payment_system['factory']
        
        # Mock database session
        mock_db = Mock()
        
        with patch.object(factory, '_get_restaurant_monthly_volume', return_value=Decimal("2000")):
            # Select provider
            provider = await factory.select_optimal_provider(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant",
                db_session=mock_db
            )
            
            assert provider is not None
            
            # Calculate fee
            fee = provider.calculate_fee(Decimal("50.00"))
            assert fee > Decimal("0")
            assert fee < Decimal("50.00")  # Fee should be less than amount
    
    @pytest.mark.asyncio
    async def test_fallback_scenarios(self, payment_system):
        """Test system behavior in fallback scenarios"""
        factory = payment_system['factory']
        
        # Test when smart routing fails
        with patch.object(factory, 'smart_router', None):
            provider = await factory.select_optimal_provider(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant"
            )
            
            assert provider is not None  # Should fall back to simple selection
    
    @pytest.mark.asyncio
    async def test_high_volume_optimization(self, payment_system):
        """Test optimization for high volume merchants"""
        factory = payment_system['factory']
        
        high_volume = Decimal("5000")  # Well above SumUp threshold
        
        with patch.object(factory, '_get_restaurant_monthly_volume', return_value=high_volume):
            costs = factory._calculate_provider_costs(
                amount=Decimal("100.00"),
                monthly_volume=high_volume
            )
            
            # SumUp should be cheapest for high volume
            if "sumup" in costs and "stripe" in costs:
                assert costs["sumup"] < costs["stripe"]


# Performance and load testing
class TestPerformance:
    """Performance tests for payment system"""
    
    @pytest.mark.asyncio
    async def test_concurrent_payment_processing(self):
        """Test system under concurrent load"""
        factory = PaymentProviderFactory()
        
        async def process_payment():
            return await factory.select_optimal_provider(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant"
            )
        
        # Run 10 concurrent payment selections
        tasks = [process_payment() for _ in range(10)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All should succeed
        assert all(not isinstance(result, Exception) for result in results)
        assert all(result is not None for result in results)
    
    @pytest.mark.asyncio
    async def test_routing_performance(self):
        """Test smart routing performance"""
        mock_analytics = Mock(spec=PaymentAnalyticsService)
        router = SmartRoutingService(mock_analytics)
        
        start_time = datetime.utcnow()
        
        # Mock analytics data
        mock_analytics.get_provider_performance_summary.return_value = {
            'overall_metrics': {'total_volume': 2500.0, 'total_fees': 35.0},
            'provider_performance': {}
        }
        mock_analytics.get_provider_health_scores.return_value = {
            'health_scores': {
                'stripe': {'overall_score': 85},
                'square': {'overall_score': 80},
                'sumup': {'overall_score': 88}
            }
        }
        
        # Route 100 payments
        for _ in range(100):
            await router.route_payment(
                amount=Decimal("50.00"),
                restaurant_id="test_restaurant"
            )
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        # Should complete within reasonable time (adjust threshold as needed)
        assert duration < 10.0  # 10 seconds for 100 routing decisions


if __name__ == "__main__":
    pytest.main([__file__, "-v"])