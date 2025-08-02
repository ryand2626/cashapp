"""
Authentication schemas for Supabase integration
"""

from pydantic import BaseModel
from typing import Optional, List


class RegisterRestaurantRequest(BaseModel):
    """Request model for registering a new restaurant"""
    restaurant_name: str
    phone: Optional[str] = None
    address: Optional[str] = None


class UserInfo(BaseModel):
    """User information returned in auth responses"""
    id: str
    email: str
    name: str
    is_platform_owner: bool
    role: str
    restaurant_id: Optional[str] = None
    restaurant_name: Optional[str] = None
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    enabled_features: Optional[List[str]] = []


class AuthVerifyResponse(BaseModel):
    """Response model for auth verification"""
    user: UserInfo