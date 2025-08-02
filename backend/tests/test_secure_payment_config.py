"""
Test suite for Secure Payment Configuration Service
Tests encryption, storage, and retrieval of payment provider credentials
"""

import pytest
from unittest.mock import Mock, patch
from cryptography.fernet import Fernet
import json
from decimal import Decimal
from datetime import datetime

from app.services.secure_payment_config import SecurePaymentConfigService
from app.core.exceptions import FynloException


class TestSecurePaymentConfigService:
    """Test cases for secure payment configuration management"""
    
    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock()
    
    @pytest.fixture
    def encryption_key(self):
        """Generate test encryption key"""
        return Fernet.generate_key().decode()
    
    @pytest.fixture
    def service(self, mock_db, encryption_key, monkeypatch):
        """Create service instance with test configuration"""
        monkeypatch.setenv('PAYMENT_CONFIG_ENCRYPTION_KEY', encryption_key)
        return SecurePaymentConfigService(mock_db)
    
    def test_encryption_key_initialization(self, mock_db):
        """Test that service requires encryption key"""
        with pytest.raises(ValueError, match="PAYMENT_CONFIG_ENCRYPTION_KEY"):
            SecurePaymentConfigService(mock_db)
    
    def test_store_provider_config_success(self, service, mock_db):
        """Test successful storage of provider configuration"""
        # Arrange
        credentials = {
            'api_key': 'test_api_key_123',
            'secret_key': 'test_secret_456',
            'webhook_secret': 'webhook_789'
        }
        
        # Mock the query chain
        mock_config = Mock()
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        mock_db.query.return_value = mock_query
        
        # Act
        result = service.store_provider_config(
            provider='stripe',
            restaurant_id='rest_123',
            credentials=credentials,
            mode='sandbox'
        )
        
        # Assert
        assert result is True
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        
        # Verify encryption was applied
        added_config = mock_db.add.call_args[0][0]
        assert added_config.encrypted_credentials != json.dumps(credentials)
        assert added_config.provider == 'stripe'
        assert added_config.restaurant_id == 'rest_123'
        assert added_config.mode == 'sandbox'
    
    def test_store_provider_config_validation(self, service):
        """Test validation of provider configuration"""
        # Test empty credentials
        with pytest.raises(ValueError, match="Credentials cannot be empty"):
            service.store_provider_config(
                provider='stripe',
                restaurant_id='rest_123',
                credentials={}
            )
        
        # Test invalid provider
        with pytest.raises(ValueError, match="Unknown provider"):
            service.store_provider_config(
                provider='invalid_provider',
                restaurant_id='rest_123',
                credentials={'key': 'value'}
            )
        
        # Test invalid mode
        with pytest.raises(ValueError, match="Invalid mode"):
            service.store_provider_config(
                provider='stripe',
                restaurant_id='rest_123',
                credentials={'key': 'value'},
                mode='invalid_mode'
            )
    
    def test_retrieve_provider_config_success(self, service, mock_db):
        """Test successful retrieval and decryption of configuration"""
        # Arrange
        original_creds = {'api_key': 'test_123', 'secret': 'secret_456'}
        encrypted_creds = service.cipher.encrypt(
            json.dumps(original_creds).encode()
        ).decode()
        
        mock_config = Mock()
        mock_config.encrypted_credentials = encrypted_creds
        mock_config.enabled = True
        
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = mock_config
        mock_db.query.return_value = mock_query
        
        # Act
        result = service.retrieve_provider_config(
            provider='stripe',
            restaurant_id='rest_123'
        )
        
        # Assert
        assert result == original_creds
        mock_query.filter_by.assert_called_with(
            provider='stripe',
            restaurant_id='rest_123',
            enabled=True
        )
    
    def test_retrieve_provider_config_not_found(self, service, mock_db):
        """Test retrieval when configuration doesn't exist"""
        # Arrange
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = None
        mock_db.query.return_value = mock_query
        
        # Act
        result = service.retrieve_provider_config(
            provider='stripe',
            restaurant_id='rest_123'
        )
        
        # Assert
        assert result is None
    
    def test_update_provider_config(self, service, mock_db):
        """Test updating existing provider configuration"""
        # Arrange
        mock_config = Mock()
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = mock_config
        mock_db.query.return_value = mock_query
        
        new_credentials = {'api_key': 'new_key', 'secret': 'new_secret'}
        
        # Act
        result = service.update_provider_config(
            provider='stripe',
            restaurant_id='rest_123',
            credentials=new_credentials
        )
        
        # Assert
        assert result is True
        assert mock_config.encrypted_credentials is not None
        mock_db.commit.assert_called_once()
    
    def test_disable_provider_config(self, service, mock_db):
        """Test disabling a provider configuration"""
        # Arrange
        mock_config = Mock()
        mock_config.enabled = True
        mock_query = Mock()
        mock_query.filter_by.return_value.first.return_value = mock_config
        mock_db.query.return_value = mock_query
        
        # Act
        result = service.disable_provider_config(
            provider='stripe',
            restaurant_id='rest_123'
        )
        
        # Assert
        assert result is True
        assert mock_config.enabled is False
        mock_db.commit.assert_called_once()
    
    def test_list_provider_configs(self, service, mock_db):
        """Test listing all provider configurations for a restaurant"""
        # Arrange
        mock_configs = [
            Mock(provider='stripe', mode='production', enabled=True,
                 created_at=datetime.utcnow(), updated_at=datetime.utcnow()),
            Mock(provider='square', mode='sandbox', enabled=False,
                 created_at=datetime.utcnow(), updated_at=datetime.utcnow())
        ]
        
        mock_query = Mock()
        mock_query.filter_by.return_value.all.return_value = mock_configs
        mock_db.query.return_value = mock_query
        
        # Act
        result = service.list_provider_configs('rest_123')
        
        # Assert
        assert len(result) == 2
        assert result[0]['provider'] == 'stripe'
        assert result[0]['enabled'] is True
        assert result[1]['provider'] == 'square'
        assert result[1]['enabled'] is False
    
    def test_encryption_decryption_integrity(self, service):
        """Test that encryption and decryption maintain data integrity"""
        # Arrange
        test_data = {
            'api_key': 'sk_test_123456789',
            'secret_key': 'secret_test_987654321',
            'nested': {
                'webhook_secret': 'whsec_test_abcdef',
                'endpoint_url': 'https://api.test.com'
            },
            'array': ['item1', 'item2', 'item3']
        }
        
        # Act
        encrypted = service.cipher.encrypt(json.dumps(test_data).encode())
        decrypted_json = service.cipher.decrypt(encrypted).decode()
        decrypted_data = json.loads(decrypted_json)
        
        # Assert
        assert decrypted_data == test_data
        assert encrypted != json.dumps(test_data).encode()
    
    def test_validate_stripe_credentials(self, service):
        """Test Stripe credential validation"""
        # Valid credentials
        valid_creds = {
            'publishable_key': 'pk_test_123',
            'secret_key': 'sk_test_456',
            'webhook_secret': 'whsec_789'
        }
        assert service.validate_provider_credentials('stripe', valid_creds) is True
        
        # Missing required field
        invalid_creds = {
            'publishable_key': 'pk_test_123',
            'secret_key': 'sk_test_456'
        }
        with pytest.raises(ValueError, match="Missing required Stripe credentials"):
            service.validate_provider_credentials('stripe', invalid_creds)
    
    def test_validate_square_credentials(self, service):
        """Test Square credential validation"""
        # Valid credentials
        valid_creds = {
            'access_token': 'sq0atp-123456',
            'location_id': 'L123456',
            'application_id': 'sq0idp-123456'
        }
        assert service.validate_provider_credentials('square', valid_creds) is True
        
        # Invalid location ID format
        invalid_creds = {
            'access_token': 'sq0atp-123456',
            'location_id': 'invalid',
            'application_id': 'sq0idp-123456'
        }
        with pytest.raises(ValueError, match="Invalid Square location ID"):
            service.validate_provider_credentials('square', invalid_creds)
    
    def test_concurrent_access_handling(self, service, mock_db):
        """Test handling of concurrent configuration updates"""
        # This would test database locking/transaction handling
        # Implementation depends on specific database locking strategy
        pass
    
    def test_encryption_key_rotation(self, service, mock_db):
        """Test ability to rotate encryption keys"""
        # This would test the key rotation functionality
        # Implementation depends on key rotation strategy
        pass


class TestSecurePaymentConfigIntegration:
    """Integration tests with actual database"""
    
    @pytest.mark.integration
    def test_full_config_lifecycle(self, test_db_session):
        """Test complete lifecycle of payment configuration"""
        # This would test with actual database
        # Create -> Retrieve -> Update -> Disable -> List
        pass