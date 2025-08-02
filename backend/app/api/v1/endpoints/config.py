"""
Configuration Management API Endpoints
Provides endpoints for managing payment system configuration
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db, User
from app.core.exceptions import FynloException, ResourceNotFoundException, ValidationException
from app.core.auth import get_current_user
from app.core.responses import APIResponseHelper
from app.services.config_manager import config_manager, ProviderConfig, RoutingConfig, FeatureFlags
from app.services.payment_factory import payment_factory
from app.services.smart_routing import RoutingStrategy
from app.services.monitoring import get_monitoring_service
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

router = APIRouter()

# Pydantic models for requests/responses
class ProviderConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    environment: Optional[str] = None
    webhook_url: Optional[str] = None
    timeout_seconds: Optional[int] = None
    retry_attempts: Optional[int] = None
    custom_settings: Optional[Dict[str, Any]] = None

class RoutingConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    default_strategy: Optional[str] = None
    fallback_provider: Optional[str] = None

class FeatureFlagRequest(BaseModel):
    feature_name: str
    enabled: bool

class ThresholdUpdateRequest(BaseModel):
    thresholds: Dict[str, float]

@router.get("/summary")
async def get_configuration_summary(
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive configuration summary"""
    try:
        summary = config_manager.get_configuration_summary()
        
        # Add runtime information
        available_providers = payment_factory.get_available_providers()
        
        summary['runtime'] = {
            'available_providers': available_providers,
            'total_providers_configured': len(config_manager.providers),
            'enabled_providers': len(config_manager.get_enabled_providers())
        }
        
        return APIResponseHelper.success(
            data=summary,
            message="Configuration summary retrieved successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/providers")
async def get_provider_configurations(
    current_user: User = Depends(get_current_user)
):
    """Get all provider configurations"""
    try:
        providers_config = {}
        
        for name, config in config_manager.providers.items():
            providers_config[name] = {
                'name': config.name,
                'enabled': config.enabled,
                'environment': config.environment,
                'webhook_url': config.webhook_url,
                'timeout_seconds': config.timeout_seconds,
                'retry_attempts': config.retry_attempts,
                'custom_settings': config.custom_settings,
                'has_api_key': bool(config.api_key),
                'has_secret_key': bool(config.secret_key)
            }
        
        return APIResponseHelper.success(
            data=providers_config,
            message=f"Retrieved configuration for {len(providers_config)} providers"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/providers/{provider_name}")
async def get_provider_configuration(
    provider_name: str,
    current_user: User = Depends(get_current_user)
):
    """Get configuration for a specific provider"""
    try:
        config = config_manager.get_provider_config(provider_name)
        
        if not config:
            raise ResourceNotFoundException(resource="Provider", resource_id=provider_name)        
        # Don't expose sensitive information
        provider_config = {
            'name': config.name,
            'enabled': config.enabled,
            'environment': config.environment,
            'webhook_url': config.webhook_url,
            'timeout_seconds': config.timeout_seconds,
            'retry_attempts': config.retry_attempts,
            'custom_settings': config.custom_settings,
            'has_api_key': bool(config.api_key),
            'has_secret_key': bool(config.secret_key)
        }
        
        return APIResponseHelper.success(
            data=provider_config,
            message=f"Configuration for {provider_name} retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/providers/{provider_name}")
async def update_provider_configuration(
    provider_name: str,
    config_update: ProviderConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """Update configuration for a specific provider"""
    try:
        # Get current configuration
        current_config = config_manager.get_provider_config(provider_name)
        
        # Prepare update data (exclude None values)
        update_data = {
            k: v for k, v in config_update.dict().items() 
            if v is not None
        }
        
        if not update_data:
            raise ValidationException(message="No configuration changes provided")        
        # Update configuration
        config_manager.update_provider_config(provider_name, **update_data)
        
        # Save to file
        config_manager.save_configuration("providers")
        
        # Get updated configuration
        updated_config = config_manager.get_provider_config(provider_name)
        
        return APIResponseHelper.success(
            data={
                'name': updated_config.name,
                'enabled': updated_config.enabled,
                'environment': updated_config.environment,
                'webhook_url': updated_config.webhook_url,
                'timeout_seconds': updated_config.timeout_seconds,
                'retry_attempts': updated_config.retry_attempts,
                'custom_settings': updated_config.custom_settings
            },
            message=f"Configuration for {provider_name} updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/routing")
async def get_routing_configuration(
    current_user: User = Depends(get_current_user)
):
    """Get smart routing configuration"""
    try:
        routing_config = config_manager.get_routing_config()
        
        config_data = {
            'enabled': routing_config.enabled,
            'default_strategy': routing_config.default_strategy,
            'volume_thresholds': {k: float(v) for k, v in routing_config.volume_thresholds.items()},
            'provider_weights': routing_config.provider_weights,
            'fallback_provider': routing_config.fallback_provider,
            'available_strategies': [strategy.value for strategy in RoutingStrategy]
        }
        
        return APIResponseHelper.success(
            data=config_data,
            message="Routing configuration retrieved successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/routing")
async def update_routing_configuration(
    config_update: RoutingConfigRequest,
    current_user: User = Depends(get_current_user)
):
    """Update smart routing configuration"""
    try:
        routing_config = config_manager.routing
        
        # Update provided fields
        if config_update.enabled is not None:
            routing_config.enabled = config_update.enabled
        
        if config_update.default_strategy is not None:
            # Validate strategy
            try:
                RoutingStrategy(config_update.default_strategy)
                routing_config.default_strategy = config_update.default_strategy
            except ValueError:
                raise ValidationException(
                    message=f"Invalid routing strategy: {config_update.default_strategy}"
                )        
        if config_update.fallback_provider is not None:
            # Validate provider exists
            if config_update.fallback_provider not in config_manager.providers:
                raise ValidationException(
                    message=f"Fallback provider '{config_update.fallback_provider}' not configured"
                )
            routing_config.fallback_provider = config_update.fallback_provider
        
        # Save configuration
        config_manager.save_configuration("routing")
        
        return APIResponseHelper.success(
            data={
                'enabled': routing_config.enabled,
                'default_strategy': routing_config.default_strategy,
                'fallback_provider': routing_config.fallback_provider
            },
            message="Routing configuration updated successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/features")
async def get_feature_flags(
    current_user: User = Depends(get_current_user)
):
    """Get all feature flags"""
    try:
        features = config_manager.features
        
        feature_flags = {
            'smart_routing_enabled': features.smart_routing_enabled,
            'analytics_enabled': features.analytics_enabled,
            'volume_tracking_enabled': features.volume_tracking_enabled,
            'qr_payments_enabled': features.qr_payments_enabled,
            'cash_payments_enabled': features.cash_payments_enabled,
            'auto_refunds_enabled': features.auto_refunds_enabled,
            'webhook_retries_enabled': features.webhook_retries_enabled,
            'cost_optimization_alerts': features.cost_optimization_alerts
        }
        
        return APIResponseHelper.success(
            data=feature_flags,
            message="Feature flags retrieved successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/features")
async def update_feature_flag(
    feature_update: FeatureFlagRequest,
    current_user: User = Depends(get_current_user)
):
    """Update a feature flag"""
    try:
        config_manager.update_feature_flag(feature_update.feature_name, feature_update.enabled)
        
        # Save configuration
        config_manager.save_configuration("features")
        
        return APIResponseHelper.success(
            data={
                'feature_name': feature_update.feature_name,
                'enabled': feature_update.enabled
            },
            message=f"Feature flag '{feature_update.feature_name}' updated successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/security")
async def get_security_configuration(
    current_user: User = Depends(get_current_user)
):
    """Get security configuration"""
    try:
        security_config = config_manager.get_security_config()
        
        config_data = {
            'encrypt_api_keys': security_config.encrypt_api_keys,
            'webhook_signature_validation': security_config.webhook_signature_validation,
            'rate_limiting_enabled': security_config.rate_limiting_enabled,
            'max_requests_per_minute': security_config.max_requests_per_minute,
            'allowed_origins': security_config.allowed_origins,
            'ssl_required': security_config.ssl_required
        }
        
        return APIResponseHelper.success(
            data=config_data,
            message="Security configuration retrieved successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/validate")
async def validate_configuration(
    current_user: User = Depends(get_current_user)
):
    """Validate current configuration"""
    try:
        # Re-run validation
        config_manager._validate_configurations()
        
        # Get validation results
        issues = []
        
        # Check provider configurations
        enabled_providers = config_manager.get_enabled_providers()
        if not enabled_providers:
            issues.append("No payment providers are enabled")
        
        # Check routing configuration
        if config_manager.routing.enabled and config_manager.routing.fallback_provider not in enabled_providers:
            issues.append(f"Fallback provider '{config_manager.routing.fallback_provider}' is not enabled")
        
        # Check feature dependencies
        if config_manager.features.smart_routing_enabled and not config_manager.routing.enabled:
            issues.append("Smart routing feature is enabled but routing is disabled")
        
        validation_result = {
            'valid': len(issues) == 0,
            'issues': issues,
            'enabled_providers': enabled_providers,
            'routing_enabled': config_manager.routing.enabled,
            'features_enabled': {
                name: getattr(config_manager.features, name)
                for name in dir(config_manager.features)
                if not name.startswith('_')
            }
        }
        
        return APIResponseHelper.success(
            data=validation_result,
            message="Configuration validation completed"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/monitoring/health")
async def get_system_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system health status"""
    try:
        monitoring_service = get_monitoring_service(db)
        health_status = await monitoring_service.check_system_health()
        
        return APIResponseHelper.success(
            data=health_status,
            message="System health status retrieved successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.get("/monitoring/metrics")
async def get_system_metrics(
    hours: int = 24,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system metrics for specified time period"""
    try:
        if hours < 1 or hours > 168:  # Max 1 week
            raise ValidationException(message="Hours must be between 1 and 168")        
        monitoring_service = get_monitoring_service(db)
        metrics = await monitoring_service.get_system_metrics(hours)
        
        return APIResponseHelper.success(
            data=metrics,
            message=f"System metrics for last {hours} hours retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.put("/monitoring/thresholds")
async def update_monitoring_thresholds(
    threshold_update: ThresholdUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update monitoring alert thresholds"""
    try:
        monitoring_service = get_monitoring_service(db)
        await monitoring_service.update_thresholds(threshold_update.thresholds)
        
        return APIResponseHelper.success(
            data=threshold_update.thresholds,
            message="Monitoring thresholds updated successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/test/routing")
async def test_routing_simulation(
    restaurant_id: str,
    strategy: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test routing strategy simulation"""
    try:
        # Validate strategy
        try:
            routing_strategy = RoutingStrategy(strategy)
        except ValueError:
            raise ValidationException(message=f"Invalid routing strategy: {strategy}")        
        # Run simulation
        simulation_result = await payment_factory.simulate_routing_impact(
            restaurant_id=restaurant_id,
            strategy=routing_strategy,
            db_session=db
        )
        
        return APIResponseHelper.success(
            data=simulation_result,
            message="Routing simulation completed successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise FynloException(message=str(e))
@router.post("/backup")
async def backup_configuration(
    current_user: User = Depends(get_current_user)
):
    """Create a backup of current configuration"""
    try:
        # Save all configurations
        config_manager.save_configuration("all")
        
        # Get configuration summary for backup verification
        summary = config_manager.get_configuration_summary()
        
        return APIResponseHelper.success(
            data={
                'backup_timestamp': summary,
                'backup_location': f"config/payment_config_{config_manager.environment.value}.json"
            },
            message="Configuration backup created successfully"
        )
    except Exception as e:
        raise FynloException(message=str(e))
