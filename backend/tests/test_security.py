"""
Comprehensive unit tests for the security module.
Tests environment filtering, input validation, token encryption, and webhook security.
"""

import pytest
import os
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import re
import time

from app.core.security import (
    SafeEnvironmentFilter,
    SecurityLevel,
    InputValidator,
    TokenEncryption,
    WebhookSecurity,
    verify_password,
    get_password_hash,
    # Pydantic models
    MonitoringQueryParams,
    InstanceIdentifier,
    RefreshRequest,
    WebhookPayload,
    HealthDetailedQueryParams,
    ReplicaQueryParams,
    DeploymentQueryParams,
    DeploymentTriggerRequest,
    MetricsQueryParams,
    RefreshReplicasRequest,
    InstanceHeartbeatRequest,
    RedisPatternQuery,
    PaginationParams,
    FilePathValidator,
    RequestContext
)
from pydantic import ValidationError


class TestPasswordHashing:
    """Test password hashing functions."""
    
    def test_hash_password(self):
        """Test password hashing creates valid hash."""
        password = "test_password123"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert len(hashed) > 50  # bcrypt hashes are long
        assert hashed.startswith("$2b$")  # bcrypt prefix
    
    def test_verify_correct_password(self):
        """Test verifying correct password."""
        password = "test_password123"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_incorrect_password(self):
        """Test verifying incorrect password."""
        password = "test_password123"
        hashed = get_password_hash(password)
        
        assert verify_password("wrong_password", hashed) is False
    
    def test_hash_uniqueness(self):
        """Test that same password creates different hashes."""
        password = "test_password123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        
        assert hash1 != hash2  # bcrypt adds random salt


class TestSafeEnvironmentFilter:
    """Test environment variable filtering."""
    
    @patch.dict(os.environ, {
        "APP_ENV": "production",
        "APP_VERSION": "1.0.0",
        "SECRET_KEY": "super_secret",
        "DATABASE_URL": "postgresql://user:pass@host/db",
        "API_KEY": "secret_api_key",
        "DESIRED_REPLICAS": "2",
        "DO_API_TOKEN": "do_secret_token",
        "HOSTNAME": "server-01"
    })
    def test_public_safe_vars(self):
        """Test public security level filtering."""
        safe_env = SafeEnvironmentFilter.get_safe_environment(SecurityLevel.PUBLIC)
        
        # Should include safe vars
        assert safe_env["APP_ENV"] == "production"
        assert safe_env["APP_VERSION"] == "1.0.0"
        assert safe_env["DESIRED_REPLICAS"] == "2"
        
        # Should NOT include sensitive vars
        assert "SECRET_KEY" not in safe_env
        assert "DATABASE_URL" not in safe_env
        assert "API_KEY" not in safe_env
        assert "DO_API_TOKEN" not in safe_env
        assert "HOSTNAME" not in safe_env
    
    @patch.dict(os.environ, {
        "APP_ENV": "production",
        "HOSTNAME": "server-01",
        "POD_NAME": "pod-123",
        "SECRET_KEY": "super_secret"
    })
    def test_authenticated_safe_vars(self):
        """Test authenticated security level filtering."""
        safe_env = SafeEnvironmentFilter.get_safe_environment(SecurityLevel.AUTHENTICATED)
        
        # Should include additional vars
        assert safe_env["HOSTNAME"] == "server-01"
        assert safe_env["POD_NAME"] == "pod-123"
        
        # Should still exclude secrets
        assert "SECRET_KEY" not in safe_env
    
    @patch.dict(os.environ, {
        "DO_APP_ID": "app-123",
        "LOG_LEVEL": "INFO",
        "DEBUG": "false",
        "API_TOKEN": "secret"
    })
    def test_platform_owner_safe_vars(self):
        """Test platform owner security level filtering."""
        safe_env = SafeEnvironmentFilter.get_safe_environment(SecurityLevel.PLATFORM_OWNER)
        
        # Should include platform owner vars
        assert safe_env["DO_APP_ID"] == "app-123"
        assert safe_env["LOG_LEVEL"] == "INFO"
        assert safe_env["DEBUG"] == "false"
        
        # Should still exclude obvious secrets
        assert "API_TOKEN" not in safe_env
    
    def test_is_sensitive_variable(self):
        """Test sensitive variable detection."""
        # Sensitive patterns
        assert SafeEnvironmentFilter.is_sensitive_variable("SECRET_KEY")
        assert SafeEnvironmentFilter.is_sensitive_variable("API_TOKEN")
        assert SafeEnvironmentFilter.is_sensitive_variable("DATABASE_PASSWORD")
        assert SafeEnvironmentFilter.is_sensitive_variable("WEBHOOK_SECRET")
        assert SafeEnvironmentFilter.is_sensitive_variable("PRIVATE_KEY")
        assert SafeEnvironmentFilter.is_sensitive_variable("DATABASE_URL")
        
        # Non-sensitive
        assert not SafeEnvironmentFilter.is_sensitive_variable("APP_VERSION")
        assert not SafeEnvironmentFilter.is_sensitive_variable("ENVIRONMENT")
    
    def test_sanitize_log_data(self):
        """Test log data sanitization."""
        data = {
            "user": "test_user",
            "API_KEY": "secret_key_12345",
            "message": "Hello",
            "tokens": ["token1", "token2"],
            "nested": {
                "SECRET_TOKEN": "nested_secret"
            }
        }
        
        sanitized = SafeEnvironmentFilter.sanitize_log_data(data)
        
        assert sanitized["user"] == "test_user"
        assert sanitized["API_KEY"] == "***REDACTED***"
        assert sanitized["message"] == "Hello"
        assert sanitized["nested"]["SECRET_TOKEN"] == "***REDACTED***"
    
    def test_sanitize_long_tokens(self):
        """Test sanitization of long token-like strings."""
        long_token = "a" * 50
        data = {"token": long_token}
        
        sanitized = SafeEnvironmentFilter.sanitize_log_data(data)
        assert sanitized["token"] == "aaaa...aaaa"


class TestInputValidator:
    """Test input validation utilities."""
    
    def test_sanitize_string_general(self):
        """Test general string sanitization."""
        # Valid input
        assert InputValidator.sanitize_string("hello world") == "hello world"
        assert InputValidator.sanitize_string("  trim me  ") == "trim me"
        
        # Invalid input
        with pytest.raises(ValueError, match="Invalid input"):
            InputValidator.sanitize_string("")
        
        with pytest.raises(ValueError, match="Invalid input"):
            InputValidator.sanitize_string(None)
        
        # Length check
        with pytest.raises(ValueError, match="Input too long"):
            InputValidator.sanitize_string("a" * 1001)
    
    def test_sanitize_string_sql_context(self):
        """Test SQL injection prevention."""
        # Dangerous SQL characters
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string("'; DROP TABLE users; --", context="sql")
        
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string('test" OR 1=1', context="sql")
    
    def test_sanitize_string_html_context(self):
        """Test HTML/XSS prevention."""
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string("<script>alert('xss')</script>", context="html")
        
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string("test&amp;", context="html")
    
    def test_sanitize_string_shell_context(self):
        """Test shell injection prevention."""
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string("test; rm -rf /", context="shell")
        
        with pytest.raises(ValueError, match="Dangerous character"):
            InputValidator.sanitize_string("test | cat /etc/passwd", context="shell")
    
    def test_sanitize_string_path_context(self):
        """Test path traversal prevention."""
        with pytest.raises(ValueError, match="Dangerous character detected"):
            InputValidator.sanitize_string("../../../etc/passwd", context="path")
        
        with pytest.raises(ValueError, match="Absolute paths not allowed"):
            InputValidator.sanitize_string("/etc/passwd", context="path")
        
        # Valid relative path
        assert InputValidator.sanitize_string("subdir/file.txt", context="path") == "subdir/file.txt"
    
    def test_validate_uuid(self):
        """Test UUID validation."""
        # Valid UUID
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        assert InputValidator.validate_uuid(valid_uuid) == valid_uuid.lower()
        
        # Invalid UUIDs
        with pytest.raises(ValueError, match="Invalid UUID"):
            InputValidator.validate_uuid("not-a-uuid")
        
        with pytest.raises(ValueError, match="Invalid UUID"):
            InputValidator.validate_uuid("550e8400-e29b-41d4-a716")
    
    def test_validate_instance_id(self):
        """Test instance ID validation."""
        # Valid instance IDs
        assert InputValidator.validate_instance_id("instance-123") == "instance-123"
        assert InputValidator.validate_instance_id("pod_name_123") == "pod_name_123"
        assert InputValidator.validate_instance_id("a" * 128) == "a" * 128
        
        # Invalid instance IDs
        with pytest.raises(ValueError, match="Invalid instance ID"):
            InputValidator.validate_instance_id("-starts-with-dash")
        
        with pytest.raises(ValueError, match="Invalid instance ID"):
            InputValidator.validate_instance_id("has spaces")
        
        with pytest.raises(ValueError, match="Invalid instance ID"):
            InputValidator.validate_instance_id("a" * 129)  # Too long
    
    def test_validate_redis_pattern(self):
        """Test Redis pattern validation."""
        # Valid patterns
        assert InputValidator.validate_redis_pattern("fynlo:users:*") == "fynlo:users:*"
        assert InputValidator.validate_redis_pattern("instance:*") == "instance:*"
        
        # Too many wildcards
        with pytest.raises(ValueError, match="Too many wildcards"):
            InputValidator.validate_redis_pattern("***")
        
        # Missing safe prefix
        with pytest.raises(ValueError, match="safe prefix"):
            InputValidator.validate_redis_pattern("danger:*")


class TestTokenEncryption:
    """Test secure token encryption."""
    
    @patch.dict(os.environ, {"SECRET_KEY": "a" * 32})
    def test_encrypt_decrypt_token(self):
        """Test token encryption and decryption."""
        token_enc = TokenEncryption()
        original_token = "my_secret_api_token_12345"
        
        # Encrypt
        encrypted = token_enc.encrypt_token(original_token)
        assert encrypted != original_token
        assert len(encrypted) > 50  # Fernet tokens are long
        
        # Decrypt
        decrypted = token_enc.decrypt_token(encrypted)
        assert decrypted == original_token
    
    @patch.dict(os.environ, {"SECRET_KEY": "short"})
    def test_short_secret_key_error(self):
        """Test error with short secret key."""
        with pytest.raises(ValueError, match="at least 32 characters"):
            TokenEncryption()
    
    def test_custom_master_key(self):
        """Test with custom master key."""
        master_key = "b" * 32
        token_enc = TokenEncryption(master_key=master_key)
        
        token = "test_token"
        encrypted = token_enc.encrypt_token(token)
        decrypted = token_enc.decrypt_token(encrypted)
        
        assert decrypted == token
    
    def test_generate_secure_token(self):
        """Test secure token generation."""
        token1 = TokenEncryption.generate_secure_token()
        token2 = TokenEncryption.generate_secure_token()
        
        # Should be unique
        assert token1 != token2
        
        # Should be URL-safe
        assert re.match(r'^[A-Za-z0-9_-]+$', token1)
        
        # Custom length
        token3 = TokenEncryption.generate_secure_token(length=16)
        assert len(token3) < len(token1)  # Shorter when encoded


class TestWebhookSecurity:
    """Test webhook signature verification."""
    
    def test_verify_signature_sha256(self):
        """Test SHA256 signature verification."""
        payload = b'{"event": "test"}'
        secret = "webhook_secret_123"
        
        # Generate valid signature
        import hmac
        import hashlib
        expected = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Should verify
        assert WebhookSecurity.verify_signature(
            payload, expected, secret
        ) is True
        
        # Should fail with wrong signature
        assert WebhookSecurity.verify_signature(
            payload, "wrong_signature", secret
        ) is False
    
    def test_verify_signature_with_prefix(self):
        """Test signature verification with prefix."""
        payload = b'{"event": "test"}'
        secret = "webhook_secret"
        
        import hmac
        import hashlib
        expected = hmac.new(
            secret.encode('utf-8'),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # With prefix (like GitHub)
        prefixed = f"sha256={expected}"
        assert WebhookSecurity.verify_signature(
            payload, prefixed, secret
        ) is True
    
    def test_verify_signature_with_timestamp(self):
        """Test signature verification with timestamp."""
        payload = b'{"event": "test"}'
        secret = "webhook_secret"
        timestamp = int(time.time())
        
        # Generate signature with timestamp
        import hmac
        import hashlib
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode('utf-8')
        expected = hmac.new(
            secret.encode('utf-8'),
            signed_payload,
            hashlib.sha256
        ).hexdigest()
        
        # Should verify
        assert WebhookSecurity.verify_signature(
            payload, expected, secret, timestamp=timestamp
        ) is True
    
    def test_verify_signature_expired_timestamp(self):
        """Test signature verification with expired timestamp."""
        payload = b'{"event": "test"}'
        secret = "webhook_secret"
        old_timestamp = int(time.time()) - 400  # 400 seconds ago
        
        import hmac
        import hashlib
        signed_payload = f"{old_timestamp}.{payload.decode('utf-8')}".encode('utf-8')
        expected = hmac.new(
            secret.encode('utf-8'),
            signed_payload,
            hashlib.sha256
        ).hexdigest()
        
        # Should fail due to old timestamp
        assert WebhookSecurity.verify_signature(
            payload, expected, secret, timestamp=old_timestamp
        ) is False


class TestPydanticModels:
    """Test Pydantic validation models."""
    
    def test_monitoring_query_params(self):
        """Test monitoring query parameters validation."""
        # Valid params
        params = MonitoringQueryParams(force_refresh=True, include_metrics=False)
        assert params.force_refresh is True
        assert params.include_metrics is False
        
        # Default values
        params = MonitoringQueryParams()
        assert params.force_refresh is False
        assert params.include_metrics is True
        
        # Extra fields rejected
        with pytest.raises(ValidationError):
            MonitoringQueryParams(force_refresh=True, unknown_field="value")
    
    def test_instance_identifier(self):
        """Test instance identifier validation."""
        # Valid
        inst = InstanceIdentifier(instance_id="server-123")
        assert inst.instance_id == "server-123"
        
        # Invalid format
        with pytest.raises(ValidationError):
            InstanceIdentifier(instance_id="-invalid")
    
    def test_deployment_trigger_request(self):
        """Test deployment trigger request validation."""
        # Valid request
        req = DeploymentTriggerRequest(
            confirm=True,
            reason="Fix replica count mismatch issue"
        )
        assert req.confirm is True
        assert req.reason == "Fix replica count mismatch issue"
        
        # Confirmation required
        with pytest.raises(ValidationError, match="confirmation required"):
            DeploymentTriggerRequest(
                confirm=False,
                reason="Test deployment"
            )
        
        # Reason too short
        with pytest.raises(ValidationError):
            DeploymentTriggerRequest(
                confirm=True,
                reason="short"
            )
    
    def test_instance_heartbeat_request(self):
        """Test instance heartbeat request validation."""
        # Valid
        req = InstanceHeartbeatRequest(
            instance_id="pod-123",
            hostname="server-01",
            environment="production",
            version="1.0.0"
        )
        assert req.instance_id == "pod-123"
        assert req.environment == "production"
        
        # Invalid environment
        with pytest.raises(ValidationError):
            InstanceHeartbeatRequest(
                instance_id="pod-123",
                hostname="server-01",
                environment="invalid_env"
            )
    
    def test_redis_pattern_query(self):
        """Test Redis pattern query validation."""
        # Valid
        query = RedisPatternQuery(pattern="fynlo:users:*", count=500)
        assert query.pattern == "fynlo:users:*"
        assert query.count == 500
        
        # Count out of range
        with pytest.raises(ValidationError):
            RedisPatternQuery(pattern="fynlo:*", count=2000)
    
    def test_pagination_params(self):
        """Test pagination parameters."""
        # Valid
        params = PaginationParams(page=2, per_page=50)
        assert params.page == 2
        assert params.per_page == 50
        
        # Defaults
        params = PaginationParams()
        assert params.page == 1
        assert params.per_page == 20
        
        # Out of range
        with pytest.raises(ValidationError):
            PaginationParams(page=0, per_page=200)
    
    def test_request_context(self):
        """Test request context validation."""
        # Auto-generated request ID
        ctx = RequestContext()
        assert len(ctx.request_id) > 10
        
        # With all fields
        ctx = RequestContext(
            correlation_id="trace-123",
            user_agent="Mozilla/5.0",
            ip_address="192.168.1.1"
        )
        assert ctx.correlation_id == "trace-123"
        
        # Invalid IP (not proper format)
        with pytest.raises(ValidationError):
            RequestContext(ip_address="192.168.1.1.1")  # Too many octets
        
        # Invalid correlation ID
        with pytest.raises(ValidationError):
            RequestContext(correlation_id="invalid!@#")