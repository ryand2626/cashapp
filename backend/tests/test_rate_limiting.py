import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db, User
from app.api.v1.endpoints.auth import create_access_token # For creating test tokens
from app.middleware.rate_limit_middleware import AUTH_RATE, PAYMENT_RATE, DEFAULT_RATE # Import rate strings

# Use a separate test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_rate_limiting.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency for tests
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=engine) # Create tables
    # Ensure redis_client uses mock for these tests if real redis is not available/desired for testing
    # This should be handled by the RedisClient's fallback logic based on ENVIRONMENT
    # settings.ENVIRONMENT = "testing" # Ensure this if not set globally for tests
    yield
    Base.metadata.drop_all(bind=engine) # Drop tables after tests

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# Helper to parse rate from string like "5/minute"
def parse_rate(rate_str: str):
    num, period = rate_str.split("/")
    return int(num), period

# --- Test Cases ---

def test_ip_based_rate_limit_auth_login():
    """Test IP-based rate limiting on /auth/login."""
    login_url = "/api/v1/auth/login"
    limit, period_name = parse_rate(AUTH_RATE)

    # Headers to simulate different IPs if necessary, but TestClient uses a single "client"
    # For true IP testing, one might need more advanced client mocking or multiple clients.
    # Here, we rely on the rate limiter treating each TestClient instance's default source as one IP.

    for i in range(limit):
        response = client.post(login_url, json={"email": f"testuser{i}@example.com", "password": "password"})
        # We expect these to fail authentication (401) or validation, but not be rate-limited yet
        assert response.status_code != 429
        assert "X-RateLimit-Limit" in response.headers
        assert response.headers["X-RateLimit-Limit"] == str(limit)
        assert "X-RateLimit-Remaining" in response.headers
        assert int(response.headers["X-RateLimit-Remaining"]) == limit - (i + 1)
        assert "X-RateLimit-Reset" in response.headers

    # This request should exceed the limit
    response = client.post(login_url, json={"email": "exceed@example.com", "password": "password"})
    assert response.status_code == 429
    assert "X-RateLimit-Limit" in response.headers
    assert "Retry-After" in response.headers # slowapi adds Retry-After

    # Wait for the rate limit window to pass (e.g., 60 seconds for "/minute")
    # This makes tests slow, consider mocking time or using a shorter test-specific limit if possible.
    # For now, let's assume 'minute' means 60s for testing.
    if period_name == "minute":
        time.sleep(61) # Wait for 61 seconds to be safe
    elif period_name == "second":
        time.sleep(2)
    else: # Add other periods if used
        time.sleep(61)

    # This request should now be allowed again
    response = client.post(login_url, json={"email": "after_wait@example.com", "password": "password"})
    assert response.status_code != 429
    assert "X-RateLimit-Remaining" in response.headers
    assert int(response.headers["X-RateLimit-Remaining"]) == limit - 1

def test_user_based_rate_limit_on_protected_endpoint():
    """Test user-based rate limiting on a protected endpoint (e.g., /auth/me)."""
    # 1. Create a user and log in to get a token
    db = TestingSessionLocal()
    test_user_email = "user_limit_test@example.com"
    test_password = "strongpassword"

    existing_user = db.query(User).filter(User.email == test_user_email).first()
    if not existing_user:
        hashed_password = client.app.dependency_overrides[get_db]().query(User).first().password_hash # hacky way to get pwd_context
        # A better way would be to import get_password_hash from auth.py
        # For now, let's assume a user can be created or use an existing one if pwd_context is hard to get here
        from app.api.v1.endpoints.auth import get_password_hash as util_get_password_hash

        user = User(
            email=test_user_email,
            password_hash=util_get_password_hash(test_password),
            first_name="Test",
            last_name="UserLimit",
            role="employee",
            is_active=True,
            id=str(abs(hash(test_user_email))) # Simple unique ID for test
        )
        db.add(user)
        db.commit()
    else:
        user = existing_user

    db.close()

    # Log in the user - directly call token creation for simplicity if login endpoint is complex to use here
    # Or, use the /auth/login endpoint (make sure it's not overly rate-limited for test setup)
    # For this test, we'll assume /auth/login is available or we can generate a token

    # Simplified token creation for testing purposes
    access_token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Test a protected endpoint that uses the default rate limit
    protected_url = "/api/v1/auth/me" # This endpoint should be covered by DEFAULT_RATE
    limit, period_name = parse_rate(DEFAULT_RATE)

    for i in range(limit):
        response = client.get(protected_url, headers=headers)
        assert response.status_code == 200 # Assuming /auth/me is successful
        assert "X-RateLimit-Limit" in response.headers
        assert response.headers["X-RateLimit-Limit"] == str(limit)
        assert "X-RateLimit-Remaining" in response.headers
        assert int(response.headers["X-RateLimit-Remaining"]) == limit - (i + 1)
        assert "X-RateLimit-Reset" in response.headers
        # Check that the key is user-based (optional, hard to verify directly without log inspection)

    # This request should exceed the limit for this user
    response = client.get(protected_url, headers=headers)
    assert response.status_code == 429
    assert "Retry-After" in response.headers

    # 3. Test with a different user (or no user for IP limit) to ensure limits are distinct
    # If another user makes a request, they should have their own limit.
    # If an unauthenticated request is made, it should hit the IP limit, not this user's.

    # Example: Unauthenticated request to a default-limited public endpoint (if one exists)
    # For now, let's focus on the user-specific limit.
    # A different user would need a different token.

    # Wait for the rate limit window to pass
    if period_name == "minute":
        time.sleep(61)
    elif period_name == "second":
        time.sleep(2)
    else:
        time.sleep(61)

    # This request should now be allowed again for this user
    response = client.get(protected_url, headers=headers)
    assert response.status_code == 200
    assert "X-RateLimit-Remaining" in response.headers
    assert int(response.headers["X-RateLimit-Remaining"]) == limit - 1


def test_ip_based_rate_limit_payment_qr_generate():
    """Test IP-based rate limiting on /payments/qr/generate."""
    qr_gen_url = "/api/v1/payments/qr/generate"
    limit, period_name = parse_rate(PAYMENT_RATE)

    # This endpoint requires authentication, so we need a token.
    # However, the rate limit key identify_client first checks for user, then IP.
    # If we don't provide a valid token, it will be IP-based.
    # If we provide a valid token, it will be user-based.
    # Let's test the IP-based limit first by not providing a valid token or specific user context initially.
    # The endpoint itself will likely return 401/403 if no token, but rate limit should still apply.

    # To properly test IP-based limit on an auth-required endpoint,
    # we'd ideally make requests that *would* be valid if not for rate limiting,
    # or ensure identify_client falls back to IP.
    # For now, we'll make requests that will fail auth, but the rate limiter should count them by IP.

    # Create a dummy order_id for the request body, as it's required by the endpoint
    # The actual order creation is not the focus here, just hitting the endpoint.
    # In a real scenario, we'd need to ensure an order exists or mock the DB check.
    dummy_order_id = "test_order_for_qr_rate_limit"

    # Create a dummy user and token to bypass initial auth checks within the endpoint if needed,
    # but the rate limit should apply based on IP if we don't vary users.
    # For simplicity in this IP test, let's assume the endpoint is hit before deep auth logic rejects
    # or that identify_client correctly uses IP for unauthenticated/invalid-token requests.

    # Generate a token for a test user to make the requests "valid" enough to pass initial checks
    # This part is tricky: if the token is valid, it becomes user-based.
    # To test IP based, we should make unauthenticated requests or requests where get_current_user_id returns None.
    # The current identify_client is: user_id if user_id else ip_address.
    # So, if we send requests without Authorization header, it will be IP based.

    for i in range(limit):
        response = client.post(
            qr_gen_url,
            json={"order_id": f"{dummy_order_id}_{i}", "amount": 10.0}
            # No auth header, so it should be IP-based
        )
        # Expect 401 or 403 due to missing auth, but not 429 yet.
        # The rate limiter middleware acts before the endpoint's security dependencies in typical setups.
        assert response.status_code != 429
        if response.status_code == 403: # FastAPI's default for missing auth in some cases
             pass # This is fine, rate limiter should still have counted it.
        elif response.status_code == 401: # More common for Depends(security)
             pass


        assert "X-RateLimit-Limit" in response.headers
        assert response.headers["X-RateLimit-Limit"] == str(limit)
        assert "X-RateLimit-Remaining" in response.headers
        # print(f"QR Test {i+1}: Status {response.status_code}, Remaining {response.headers['X-RateLimit-Remaining']}")
        assert int(response.headers["X-RateLimit-Remaining"]) == limit - (i + 1)
        assert "X-RateLimit-Reset" in response.headers

    # This request should exceed the limit
    response = client.post(qr_gen_url, json={"order_id": f"{dummy_order_id}_exceed", "amount": 10.0})
    assert response.status_code == 429
    assert "Retry-After" in response.headers

    # Wait for the rate limit window to pass
    if period_name == "minute":
        time.sleep(61)
    elif period_name == "second":
        time.sleep(2)
    else:
        time.sleep(61)

    # This request should now be allowed again
    response = client.post(qr_gen_url, json={"order_id": f"{dummy_order_id}_after_wait", "amount": 10.0})
    assert response.status_code != 429


# More tests will be added for other endpoints, user-based limiting, etc.
