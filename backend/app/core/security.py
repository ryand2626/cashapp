"""
Comprehensive security module for Fynlo POS backend.
Handles environment filtering, input validation, password hashing, and security utilities.
"""

import os
import re
import hmac
import hashlib
import secrets
from typing import Dict, List, Optional, Set, Any, Union
from datetime import datetime, timezone
from functools import lru_cache
import logging
from enum import Enum

from pydantic import BaseModel, Field, validator
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

logger = logging.getLogger(__name__)

# Password hashing context (preserving existing functionality)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


class SecurityLevel(str, Enum):
    """Security levels for different types of operations."""
    PUBLIC = "public"
    AUTHENTICATED = "authenticated"
    ADMIN = "admin"
    PLATFORM_OWNER = "platform_owner"


class SafeEnvironmentFilter:
    """
    Filters environment variables to prevent exposure of sensitive data.
    Only whitelisted variables are accessible through public endpoints.
    """
    
    # Safe environment variables that can be exposed in public endpoints
    PUBLIC_SAFE_VARS: Set[str] = {
        "APP_ENV",
        "ENVIRONMENT", 
        "APP_VERSION",
        "GIT_COMMIT",
        "BUILD_TIME",
        "DESIRED_REPLICAS",
        "DO_REGION",  # Safe to expose region
        "DO_COMPONENT_NAME",  # Safe to expose component name
    }
    
    # Additional variables safe for authenticated users
    AUTHENTICATED_SAFE_VARS: Set[str] = PUBLIC_SAFE_VARS | {
        "DO_APP_NAME",
        "DO_DEPLOYMENT_ID",
        "HOSTNAME",
        "POD_NAME",
        "NODE_NAME",
        "POD_NAMESPACE",
    }
    
    # Patterns for sensitive variable names (case-insensitive)
    SENSITIVE_PATTERNS: List[re.Pattern] = [
        re.compile(r".*(_KEY|_SECRET|_TOKEN|_PASSWORD|_CREDENTIAL).*", re.IGNORECASE),
        re.compile(r".*(API|AUTH|PRIVATE|CERT|WEBHOOK).*", re.IGNORECASE),
        re.compile(r"^(DATABASE_URL|REDIS_URL|AMQP_URL)$", re.IGNORECASE),
    ]
    
    @classmethod
    def get_safe_environment(
        cls, 
        security_level: SecurityLevel = SecurityLevel.PUBLIC,
        additional_safe_vars: Optional[Set[str]] = None
    ) -> Dict[str, str]:
        """
        Get filtered environment variables based on security level.
        
        Args:
            security_level: The security level determining which vars are safe
            additional_safe_vars: Additional variables to include in whitelist
            
        Returns:
            Dictionary of safe environment variables
        """
        if security_level == SecurityLevel.PUBLIC:
            safe_vars = cls.PUBLIC_SAFE_VARS.copy()
        elif security_level in [SecurityLevel.AUTHENTICATED, SecurityLevel.ADMIN]:
            safe_vars = cls.AUTHENTICATED_SAFE_VARS.copy()
        else:
            # Platform owners can see more, but still filter obvious secrets
            safe_vars = cls.AUTHENTICATED_SAFE_VARS.copy()
            # Add some additional vars for platform owners
            safe_vars.update({"DO_APP_ID", "LOG_LEVEL", "DEBUG"})
        
        # Add any additional safe vars
        if additional_safe_vars:
            safe_vars.update(additional_safe_vars)
        
        # Filter environment variables
        filtered_env = {}
        for key, value in os.environ.items():
            # Check if key is in whitelist
            if key in safe_vars:
                # Double-check it's not matching sensitive patterns
                if not any(pattern.match(key) for pattern in cls.SENSITIVE_PATTERNS):
                    filtered_env[key] = value
                else:
                    logger.warning(f"Variable {key} matched sensitive pattern despite being whitelisted")
        
        return filtered_env
    
    @classmethod
    def is_sensitive_variable(cls, var_name: str) -> bool:
        """Check if a variable name appears to be sensitive."""
        return any(pattern.match(var_name) for pattern in cls.SENSITIVE_PATTERNS)
    
    @classmethod
    def sanitize_log_data(cls, data: Any) -> Any:
        """
        Recursively sanitize data for logging, masking sensitive values.
        
        Args:
            data: Data to sanitize (dict, list, or primitive)
            
        Returns:
            Sanitized data with sensitive values masked
        """
        if isinstance(data, dict):
            return {
                key: "***REDACTED***" if cls.is_sensitive_variable(str(key)) else cls.sanitize_log_data(value)
                for key, value in data.items()
            }
        elif isinstance(data, list):
            return [cls.sanitize_log_data(item) for item in data]
        elif isinstance(data, str) and len(data) > 20:
            # Mask long strings that might be tokens/keys
            if re.match(r"^[A-Za-z0-9_\-]{20,}$", data):
                return f"{data[:4]}...{data[-4:]}"
        return data


class InputValidator:
    """
    Comprehensive input validation utilities to prevent injection attacks.
    """
    
    # Dangerous characters for different contexts
    SQL_DANGEROUS_CHARS = ["'", '"', ";", "--", "/*", "*/", "\\"]
    HTML_DANGEROUS_CHARS = ["<", ">", "&", '"', "'", "/"]
    SHELL_DANGEROUS_CHARS = ["|", "&", ";", "$", "`", "(", ")", "\\", "\n", "\r"]
    PATH_DANGEROUS_CHARS = ["..", "~", "|", "&", ";", "$", "`", "(", ")", "\\", "\n", "\r"]
    
    # Regex patterns for common identifiers
    UUID_PATTERN = re.compile(r"^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")
    SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    INSTANCE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,127}$")
    
    @classmethod
    def sanitize_string(
        cls, 
        value: str, 
        context: str = "general",
        max_length: int = 1000
    ) -> str:
        """
        Sanitize string input based on context.
        
        Args:
            value: String to sanitize
            context: Context for sanitization (sql, html, shell, path, general)
            max_length: Maximum allowed length
            
        Returns:
            Sanitized string
            
        Raises:
            ValueError: If input is invalid or dangerous
        """
        if not value or not isinstance(value, str):
            raise ValueError("Invalid input: must be non-empty string")
        
        # Length check
        if len(value) > max_length:
            raise ValueError(f"Input too long: max {max_length} characters")
        
        # Context-specific sanitization
        dangerous_chars = []
        if context == "sql":
            dangerous_chars = cls.SQL_DANGEROUS_CHARS
        elif context == "html":
            dangerous_chars = cls.HTML_DANGEROUS_CHARS
        elif context == "shell":
            dangerous_chars = cls.SHELL_DANGEROUS_CHARS
        elif context == "path":
            dangerous_chars = cls.PATH_DANGEROUS_CHARS
        
        # Check for dangerous characters
        for char in dangerous_chars:
            if char in value:
                raise ValueError(f"Dangerous character detected: {char}")
        
        # Additional checks for path context
        if context == "path":
            if value.startswith("/") or value.startswith("\\"):
                raise ValueError("Absolute paths not allowed")
            if ".." in value:
                raise ValueError("Path traversal detected")
        
        return value.strip()
    
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        """Validate UUID format."""
        if not cls.UUID_PATTERN.match(value):
            raise ValueError("Invalid UUID format")
        return value.lower()
    
    @classmethod
    def validate_instance_id(cls, value: str) -> str:
        """Validate instance ID format."""
        if not cls.INSTANCE_ID_PATTERN.match(value):
            raise ValueError("Invalid instance ID format")
        return value
    
    @classmethod
    def validate_redis_pattern(cls, pattern: str) -> str:
        """Validate Redis scan pattern to prevent injection."""
        # Ensure pattern doesn't contain dangerous wildcards
        if pattern.count("*") > 2:
            raise ValueError("Too many wildcards in pattern")
        
        # Ensure pattern has a safe prefix
        safe_prefixes = ["fynlo:", "instance:", "session:", "cache:"]
        if not any(pattern.startswith(prefix) for prefix in safe_prefixes):
            raise ValueError("Pattern must start with a safe prefix")
        
        return pattern


class TokenEncryption:
    """
    Secure token encryption for storing sensitive tokens like API keys.
    Uses Fernet symmetric encryption with key derivation.
    """
    
    def __init__(self, master_key: Optional[str] = None):
        """
        Initialize token encryption with master key.
        
        Args:
            master_key: Master key for encryption. If None, generates from SECRET_KEY
        """
        if master_key:
            self.master_key = master_key.encode()
        else:
            # Derive from SECRET_KEY environment variable
            secret_key = os.environ.get("SECRET_KEY", "")
            if len(secret_key) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters for secure encryption")
            self.master_key = secret_key.encode()
        
        # Derive encryption key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'fynlo-token-encryption',  # Static salt for deterministic key
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_key))
        self.cipher = Fernet(key)
    
    def encrypt_token(self, token: str) -> str:
        """
        Encrypt a token for secure storage.
        
        Args:
            token: Plain text token
            
        Returns:
            Encrypted token as base64 string
        """
        return self.cipher.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """
        Decrypt a token for use.
        
        Args:
            encrypted_token: Encrypted token as base64 string
            
        Returns:
            Decrypted plain text token
        """
        return self.cipher.decrypt(encrypted_token.encode()).decode()
    
    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate a cryptographically secure random token."""
        return secrets.token_urlsafe(length)


class WebhookSecurity:
    """
    Webhook signature verification and security utilities.
    """
    
    @staticmethod
    def verify_signature(
        payload: bytes,
        signature: str,
        secret: str,
        algorithm: str = "sha256",
        timestamp: Optional[int] = None,
        tolerance_seconds: int = 300
    ) -> bool:
        """
        Verify webhook signature with timing attack protection.
        
        Args:
            payload: Raw request body
            signature: Provided signature
            secret: Webhook secret
            algorithm: Hash algorithm (sha256, sha1)
            timestamp: Optional timestamp for replay protection
            tolerance_seconds: Max age for timestamp validation
            
        Returns:
            True if signature is valid
        """
        # Validate timestamp if provided
        if timestamp:
            current_time = int(datetime.now(timezone.utc).timestamp())
            if abs(current_time - timestamp) > tolerance_seconds:
                logger.warning(f"Webhook timestamp too old: {timestamp}")
                return False
        
        # Calculate expected signature
        secret_bytes = secret.encode('utf-8')
        
        if timestamp:
            # Include timestamp in signature (Stripe/Slack style)
            signed_payload = f"{timestamp}.{payload.decode('utf-8')}".encode('utf-8')
        else:
            signed_payload = payload
        
        if algorithm == "sha256":
            expected = hmac.new(secret_bytes, signed_payload, hashlib.sha256).hexdigest()
        elif algorithm == "sha1":
            expected = hmac.new(secret_bytes, signed_payload, hashlib.sha1).hexdigest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        
        # Remove any prefix (e.g., "sha256=")
        if "=" in signature:
            signature = signature.split("=", 1)[1]
        
        # Constant-time comparison
        return hmac.compare_digest(signature.lower(), expected.lower())


# Pydantic models for strict input validation

class MonitoringQueryParams(BaseModel):
    """Query parameters for monitoring endpoints."""
    force_refresh: bool = Field(False, description="Force cache refresh")
    include_metrics: bool = Field(True, description="Include detailed metrics")
    
    class Config:
        extra = "forbid"  # Reject unknown parameters


class InstanceIdentifier(BaseModel):
    """Validated instance identifier."""
    instance_id: str = Field(..., pattern=r"^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,127}$")
    
    @validator('instance_id')
    def validate_instance_id(cls, v):
        return InputValidator.validate_instance_id(v)


class RefreshRequest(BaseModel):
    """Request to refresh monitoring data."""
    confirm: bool = Field(..., description="Confirmation flag")
    reason: Optional[str] = Field(None, max_length=200)
    
    @validator('reason')
    def sanitize_reason(cls, v):
        if v:
            return InputValidator.sanitize_string(v, context="general", max_length=200)
        return v


class WebhookPayload(BaseModel):
    """Base webhook payload with signature verification."""
    signature: str = Field(..., min_length=32, max_length=256)
    timestamp: Optional[int] = Field(None, ge=0)
    event_type: str = Field(..., pattern="^[a-zA-Z_]+$", max_length=50)
    
    class Config:
        extra = "forbid"


# Health endpoint validation models

class HealthDetailedQueryParams(BaseModel):
    """Query parameters for /health/detailed endpoint."""
    include_system: bool = Field(True, description="Include system metrics")
    
    class Config:
        extra = "forbid"


# Monitoring endpoint validation models

class ReplicaQueryParams(BaseModel):
    """Query parameters for /monitoring/replicas endpoint."""
    include_stale: bool = Field(True, description="Include stale instances")
    include_do_status: bool = Field(True, description="Include DigitalOcean status")
    
    class Config:
        extra = "forbid"


class DeploymentQueryParams(BaseModel):
    """Query parameters for /monitoring/deployments endpoint."""
    limit: int = Field(10, ge=1, le=100, description="Number of deployments to return")
    
    class Config:
        extra = "forbid"


class DeploymentTriggerRequest(BaseModel):
    """Request body for triggering deployments."""
    confirm: bool = Field(..., description="Explicit confirmation required")
    force_rebuild: bool = Field(False, description="Force rebuild of containers")
    reason: str = Field(..., min_length=10, max_length=500, description="Reason for deployment")
    
    @validator('reason')
    def sanitize_reason(cls, v):
        return InputValidator.sanitize_string(v, context="general", max_length=500)
    
    @validator('confirm')
    def validate_confirm(cls, v):
        if not v:
            raise ValueError("Explicit confirmation required for deployment trigger")
        return v
    
    class Config:
        extra = "forbid"


class MetricsQueryParams(BaseModel):
    """Query parameters for metrics endpoints."""
    include_history: bool = Field(False, description="Include historical data")
    time_range: Optional[str] = Field(None, pattern="^(1h|6h|24h|7d|30d)$", description="Time range for metrics")
    
    class Config:
        extra = "forbid"


class RefreshReplicasRequest(BaseModel):
    """Request body for refreshing replica status."""
    force_cleanup: bool = Field(True, description="Force cleanup of stale instances")
    clear_cache: bool = Field(True, description="Clear all monitoring caches")
    
    class Config:
        extra = "forbid"


# Instance tracking validation

class InstanceHeartbeatRequest(BaseModel):
    """Request for instance heartbeat registration."""
    instance_id: str = Field(..., pattern=r"^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,127}$")
    hostname: str = Field(..., max_length=255)
    environment: str = Field(..., pattern="^(development|staging|production|test)$")
    version: Optional[str] = Field(None, max_length=50)
    
    @validator('instance_id')
    def validate_instance_id(cls, v):
        return InputValidator.validate_instance_id(v)
    
    @validator('hostname')
    def sanitize_hostname(cls, v):
        return InputValidator.sanitize_string(v, context="general", max_length=255)
    
    class Config:
        extra = "forbid"


# Redis operation validation

class RedisPatternQuery(BaseModel):
    """Query for Redis pattern operations."""
    pattern: str = Field(..., max_length=100)
    count: int = Field(100, ge=1, le=1000, description="Batch size for scanning")
    
    @validator('pattern')
    def validate_pattern(cls, v):
        return InputValidator.validate_redis_pattern(v)
    
    class Config:
        extra = "forbid"


# API response pagination

class PaginationParams(BaseModel):
    """Standard pagination parameters."""
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")
    
    class Config:
        extra = "forbid"


# File operation validation

class FilePathValidator(BaseModel):
    """Validate file paths for security."""
    path: str = Field(..., max_length=500)
    
    @validator('path')
    def validate_path(cls, v):
        return InputValidator.sanitize_string(v, context="path", max_length=500)
    
    class Config:
        extra = "forbid"


# General request ID tracking

class RequestContext(BaseModel):
    """Context for request tracking and correlation."""
    request_id: str = Field(default_factory=lambda: TokenEncryption.generate_secure_token(16))
    correlation_id: Optional[str] = Field(None, pattern=r"^[a-zA-Z0-9\-]{1,64}$")
    user_agent: Optional[str] = Field(None, max_length=500)
    ip_address: Optional[str] = Field(None, pattern=r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$")
    
    class Config:
        extra = "forbid"