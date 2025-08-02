"""
Two-Factor Authentication for Platform Owners
Implements TOTP (Time-based One-Time Password) for Ryan and Arnaud
"""

import pyotp
import qrcode
import io
import base64
from datetime import datetime, timedelta
from typing import Optional, Tuple
from fastapi import status

from app.core.redis_client import RedisClient
from app.models import User
from app.core.tenant_security import TenantSecurity
from app.core.exceptions import ValidationException, AuthenticationException, FynloException, ResourceNotFoundException, ConflictException

# 2FA Configuration
TOTP_ISSUER = "Fynlo POS"
TOTP_WINDOW = 1  # Allow 1 time window before/after for clock skew
BACKUP_CODES_COUNT = 10
RECOVERY_CODE_LENGTH = 8


class TwoFactorAuth:
    """
    Manages 2FA for platform owners
    """
    
    def __init__(self, redis_client: Optional[RedisClient] = None):
        self.redis = redis_client
    
    def generate_secret(self) -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()
    
    def generate_qr_code(self, user: User, secret: str) -> str:
        """
        Generate QR code for authenticator app setup
        
        Returns:
            Base64 encoded PNG image
        """
        # Create provisioning URI
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name=TOTP_ISSUER
        )
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        # Convert to image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.getvalue()).decode()
    
    def generate_backup_codes(self) -> list[str]:
        """Generate backup recovery codes"""
        codes = []
        for _ in range(BACKUP_CODES_COUNT):
            # Generate cryptographically secure random code
            code = pyotp.random_base32()[:RECOVERY_CODE_LENGTH]
            codes.append(f"{code[:4]}-{code[4:]}")
        return codes
    
    async def setup_2fa(self, user: User) -> dict:
        """
        Set up 2FA for a platform owner
        
        Returns:
            Dict with secret, QR code, and backup codes
        """
        # Only platform owners require 2FA
        if not TenantSecurity.is_platform_owner(user):
            raise AuthenticationException(
                detail="2FA is only required for platform owners",
                error_code="ACCESS_DENIED"
            )
        
        # Generate secret and backup codes
        secret = self.generate_secret()
        backup_codes = self.generate_backup_codes()
        qr_code = self.generate_qr_code(user, secret)
        
        # Store in Redis temporarily (user must confirm setup)
        if self.redis:
            setup_key = f"2fa:setup:{user.id}"
            setup_data = {
                "secret": secret,
                "backup_codes": ",".join(backup_codes),
                "created_at": datetime.utcnow().isoformat()
            }
            await self.redis.setex(setup_key, 600, setup_data)  # 10 minute expiry
        
        return {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_code}",
            "backup_codes": backup_codes,
            "setup_key": f"2fa:setup:{user.id}"
        }
    
    async def confirm_2fa_setup(
        self, 
        user: User, 
        token: str,
        setup_key: str
    ) -> bool:
        """
        Confirm 2FA setup with a valid token
        """
        if not self.redis:
            raise FynloException(
                detail="2FA service unavailable", 
                status_code=503
            )
        
        # Get setup data
        setup_data = await self.redis.get(setup_key)
        if not setup_data:
            raise ValidationException(
                detail="2FA setup expired or invalid"
            )
        
        # Verify token
        secret = setup_data.get("secret")
        if not self.verify_totp(secret, token):
            return False
        
        # Store 2FA data permanently
        user_2fa_key = f"2fa:user:{user.id}"
        permanent_data = {
            "secret": secret,
            "backup_codes": setup_data.get("backup_codes"),
            "enabled": True,
            "enabled_at": datetime.utcnow().isoformat()
        }
        await self.redis.set(user_2fa_key, permanent_data)
        
        # Clean up setup data
        await self.redis.delete(setup_key)
        
        return True
    
    def verify_totp(self, secret: str, token: str) -> bool:
        """Verify a TOTP token"""
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=TOTP_WINDOW)
    
    async def verify_2fa(
        self, 
        user: User, 
        token: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify 2FA token for user
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message)
        """
        # Platform owners must have 2FA
        if TenantSecurity.is_platform_owner(user):
            if not self.redis:
                return False, "2FA service unavailable"
            
            # Get user's 2FA data
            user_2fa_key = f"2fa:user:{user.id}"
            user_2fa_data = await self.redis.get(user_2fa_key)
            
            if not user_2fa_data or not user_2fa_data.get("enabled"):
                return False, "2FA not enabled for platform owner"
            
            secret = user_2fa_data.get("secret")
            
            # Try TOTP first
            if self.verify_totp(secret, token):
                return True, None
            
            # Try backup codes
            backup_codes = user_2fa_data.get("backup_codes", "").split(",")
            formatted_token = token if "-" in token else f"{token[:4]}-{token[4:]}"
            
            if formatted_token in backup_codes:
                # Remove used backup code
                backup_codes.remove(formatted_token)
                user_2fa_data["backup_codes"] = ",".join(backup_codes)
                await self.redis.set(user_2fa_key, user_2fa_data)
                
                return True, None
            
            return False, "Invalid 2FA token"
        
        # Non-platform owners don't need 2FA
        return True, None
    
    async def is_2fa_enabled(self, user: User) -> bool:
        """Check if user has 2FA enabled"""
        if not self.redis:
            return False
        
        user_2fa_key = f"2fa:user:{user.id}"
        user_2fa_data = await self.redis.get(user_2fa_key)
        
        return bool(user_2fa_data and user_2fa_data.get("enabled"))
    
    async def disable_2fa(self, user: User, current_token: str) -> bool:
        """
        Disable 2FA for user (requires current token)
        """
        # Verify current token first
        valid, _ = await self.verify_2fa(user, current_token)
        if not valid:
            raise AuthenticationException(
                detail="Invalid 2FA token"
            )
        
        if self.redis:
            user_2fa_key = f"2fa:user:{user.id}"
            await self.redis.delete(user_2fa_key)
        
        return True
    
    async def generate_new_backup_codes(
        self, 
        user: User, 
        current_token: str
    ) -> list[str]:
        """
        Generate new backup codes (requires current token)
        """
        # Verify current token
        valid, _ = await self.verify_2fa(user, current_token)
        if not valid:
            raise AuthenticationException(
                detail="Invalid 2FA token"
            )
        
        if not self.redis:
            raise FynloException(
                detail="2FA service unavailable", 
                status_code=503
            )
        
        # Generate new codes
        new_codes = self.generate_backup_codes()
        
        # Update stored data
        user_2fa_key = f"2fa:user:{user.id}"
        user_2fa_data = await self.redis.get(user_2fa_key)
        
        if user_2fa_data:
            user_2fa_data["backup_codes"] = ",".join(new_codes)
            await self.redis.set(user_2fa_key, user_2fa_data)
        
        return new_codes


# Global 2FA instance
two_factor_auth = TwoFactorAuth()