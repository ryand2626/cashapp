import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from typing import Dict

from app.main import app  # Assuming your FastAPI app instance is here
from app.core.database import Customer, Order, Product
from app.api.v1.endpoints.auth import create_access_token # For generating tokens
from app.core.config import settings # For JWT settings
from datetime import timedelta

# It's good practice to use a test-specific database or ensure cleanup.
# For this example, we'll assume the test DB is handled by fixtures or test setup.

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

@pytest.fixture(scope="function")
def db_session(client): # Assuming client fixture can provide a db session or you have another way
    # This is a simplified way to get a session. In a real setup, you'd use a proper test DB session fixture.
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(scope="function")
def test_user_token(db_session: Session) -> str:
    # Create a dummy user or fetch an existing one for authentication
    # This depends on your User model and how users are created/managed
    # For simplicity, let's assume a function to get or create a test user and generate a token
    from app.models.user import User as UserModel # Adjust import as per your User model

    test_user_email = "testorderuser@example.com"
    user = db_session.query(UserModel).filter(UserModel.email == test_user_email).first()
    if not user:
        user = UserModel(
            email=test_user_email,
            hashed_password="fakepassword", # In real tests, hash properly or use a factory
            is_active=True,
            role="staff", # or whatever role is needed to create orders
            restaurant_id="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" # Example UUID, use a valid one or create a restaurant
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    token_data = {"sub": user.email, "user_id": str(user.id), "restaurant_id": str(user.restaurant_id)}
    access_token = create_access_token(
        data=token_data, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return access_token

@pytest.fixture(scope="function")
def default_restaurant_id(test_user_token: str, client: TestClient) -> str:
    # A helper to get the restaurant_id from the token, or define a default one used in tests
    # For simplicity, let's assume it's known or extractable, or use a fixed one for tests.
    # This matches the one used in test_user_token
    return "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

@pytest.fixture(scope="function")
def test_customer(db_session: Session, default_restaurant_id: str) -> Customer:
    customer = Customer(
        email="testcustomer@example.com",
        first_name="Test",
        last_name="Customer",
        phone="1234567890",
        restaurant_id=default_restaurant_id,
        loyalty_points=0,
        total_spent=0.0,
        visit_count=0
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)
    return customer

@pytest.fixture(scope="function")
def test_product(db_session: Session, default_restaurant_id: str) -> Product:
    product = db_session.query(Product).filter(Product.name == "Test Latte").first()
    if not product:
        product = Product(
            name="Test Latte",
            price=3.50,
            description="A tasty test latte",
            category="Drinks",
            restaurant_id=default_restaurant_id,
            is_active=True,
            stock_tracking=False
        )
        db_session.add(product)
        db_session.commit()
        db_session.refresh(product)
    return product


def test_create_order_with_customer_id_and_verify_response(
    client: TestClient, db_session: Session, test_user_token: str, test_customer: Customer, test_product: Product, default_restaurant_id: str
):
    headers = {"Authorization": f"Bearer {test_user_token}"}
    order_payload = {
        "customer_id": str(test_customer.id),
        "order_type": "takeaway",
        "items": [
            {
                "product_id": str(test_product.id),
                "quantity": 1,
                "unit_price": float(test_product.price), # Ensure float for Pydantic
                "total_price": float(test_product.price), # Ensure float for Pydantic
            }
        ]
    }

    # Create order
    response = client.post(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers, json=order_payload)
    assert response.status_code == 200, response.text
    order_data = response.json()
    order_id = order_data["id"]

    # Verify /orders/{order_id} response
    response_get = client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert response_get.status_code == 200, response_get.text
    retrieved_order = response_get.json()

    assert retrieved_order["customer_id"] == str(test_customer.id)
    assert retrieved_order["customer"] is not None
    assert retrieved_order["customer"]["id"] == str(test_customer.id)
    assert retrieved_order["customer"]["name"] == f"{test_customer.first_name} {test_customer.last_name}"
    assert retrieved_order["customer"]["email"] == test_customer.email

    # Verify /orders/ (list) response
    response_list = client.get(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers)
    assert response_list.status_code == 200
    orders_list_data = response_list.json()

    # The actual response structure for lists is APIResponseHelper wrapped, so access data field
    assert "data" in orders_list_data
    found_order_in_list = None
    for order_summary in orders_list_data["data"]:
        if order_summary["id"] == order_id:
            found_order_in_list = order_summary
            break

    assert found_order_in_list is not None
    assert found_order_in_list["customer_name"] == f"{test_customer.first_name} {test_customer.last_name}"


def test_create_order_with_new_customer_details_and_verify_response(
    client: TestClient, db_session: Session, test_user_token: str, test_product: Product, default_restaurant_id: str
):
    headers = {"Authorization": f"Bearer {test_user_token}"}
    new_customer_email = "newlycreated@example.com"
    new_customer_name = "Newly Created"

    order_payload = {
        "customer_email": new_customer_email,
        "customer_name": new_customer_name,
        "order_type": "dine_in",
        "items": [
            {
                "product_id": str(test_product.id),
                "quantity": 2,
                "unit_price": float(test_product.price),
                "total_price": float(test_product.price * 2),
            }
        ]
    }

    # Create order
    response = client.post(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers, json=order_payload)
    assert response.status_code == 200, response.text
    order_data = response.json()
    order_id = order_data["id"]
    created_customer_id = order_data["customer"]["id"] # Get the ID of the newly created customer

    # Verify customer was created in DB
    db_customer = db_session.query(Customer).filter(Customer.id == created_customer_id).first()
    assert db_customer is not None
    assert db_customer.email == new_customer_email
    assert db_customer.first_name == "Newly"
    assert db_customer.last_name == "Created"

    # Verify /orders/{order_id} response
    response_get = client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert response_get.status_code == 200, response_get.text
    retrieved_order = response_get.json()

    assert retrieved_order["customer_id"] == created_customer_id
    assert retrieved_order["customer"] is not None
    assert retrieved_order["customer"]["id"] == created_customer_id
    assert retrieved_order["customer"]["name"] == new_customer_name
    assert retrieved_order["customer"]["email"] == new_customer_email

    # Verify /orders/ (list) response
    response_list = client.get(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers)
    assert response_list.status_code == 200
    orders_list_data = response_list.json()["data"] # Access data field

    found_order_in_list = None
    for order_summary in orders_list_data:
        if order_summary["id"] == order_id:
            found_order_in_list = order_summary
            break

    assert found_order_in_list is not None
    assert found_order_in_list["customer_name"] == new_customer_name

def test_create_order_without_customer_info(
    client: TestClient, db_session: Session, test_user_token: str, test_product: Product, default_restaurant_id: str
):
    headers = {"Authorization": f"Bearer {test_user_token}"}
    order_payload = {
        # No customer_id, customer_email, or customer_name
        "order_type": "delivery",
        "items": [
            {
                "product_id": str(test_product.id),
                "quantity": 1,
                "unit_price": float(test_product.price),
                "total_price": float(test_product.price),
            }
        ]
    }

    # Create order
    response = client.post(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers, json=order_payload)
    assert response.status_code == 200, response.text
    order_data = response.json()
    order_id = order_data["id"]

    # Verify /orders/{order_id} response
    response_get = client.get(f"/api/v1/orders/{order_id}", headers=headers)
    assert response_get.status_code == 200, response_get.text
    retrieved_order = response_get.json()

    assert retrieved_order["customer_id"] is None
    assert retrieved_order["customer"] is None

    # Verify /orders/ (list) response
    response_list = client.get(f"/api/v1/orders/?restaurant_id={default_restaurant_id}", headers=headers)
    assert response_list.status_code == 200
    orders_list_data = response_list.json()["data"]

    found_order_in_list = None
    for order_summary in orders_list_data:
        if order_summary["id"] == order_id:
            found_order_in_list = order_summary
            break

    assert found_order_in_list is not None
    assert found_order_in_list["customer_name"] is None
