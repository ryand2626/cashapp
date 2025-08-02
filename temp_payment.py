"""
Comprehensive tests for payment providers
"""

import os
import pytest
import asyncio
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta

from app.services.payment_providers import PaymentProvider, StripeProvider, SquareProvider, SumUpProvider
from app.services.payment_factory import PaymentProviderFactory
from app.services.smart_routing import SmartRoutingService, RoutingStrategy
from app.services.payment_analytics import PaymentAnalyticsService
EOF && tail -n +21 backend/tests/test_payment_providers.py >> temp_payment.py && mv temp_payment.py backend/tests/test_payment_providers.py < /dev/null