"""
Minimal FastAPI server to get essential endpoints working
This bypasses complex payment provider imports and focuses on core data endpoints
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import json
from datetime import datetime

app = FastAPI(
    title="Fynlo POS API - Minimal",
    description="Essential API endpoints for Fynlo POS mobile app",
    version="1.0.0"
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data - Casa Estrella Mexican Restaurant
MOCK_EMPLOYEES = [
    {
        "id": 1,
        "name": "Maria Garcia",
        "firstName": "Maria",
        "lastName": "Garcia",
        "role": "server",
        "email": "maria.garcia@casaestrella.com",
        "phone": "+44 7700 900001",
        "hourlyRate": 12.50,
        "hoursWorked": 38,
        "isActive": True,
        "hireDate": "2023-01-15"
    },
    {
        "id": 2,
        "name": "Jose Rodriguez",
        "firstName": "Jose",
        "lastName": "Rodriguez",
        "role": "chef",
        "email": "jose.rodriguez@casaestrella.com",
        "phone": "+44 7700 900002",
        "hourlyRate": 18.00,
        "hoursWorked": 42,
        "isActive": True,
        "hireDate": "2022-08-20"
    },
    {
        "id": 3,
        "name": "Ana Martinez",
        "firstName": "Ana",
        "lastName": "Martinez",
        "role": "bartender",
        "email": "ana.martinez@casaestrella.com",
        "phone": "+44 7700 900003",
        "hourlyRate": 14.00,
        "hoursWorked": 35,
        "isActive": True,
        "hireDate": "2023-03-10"
    },
    {
        "id": 4,
        "name": "Carlos Lopez",
        "firstName": "Carlos",
        "lastName": "Lopez",
        "role": "server",
        "email": "carlos.lopez@casaestrella.com",
        "phone": "+44 7700 900004",
        "hourlyRate": 12.50,
        "hoursWorked": 32,
        "isActive": True,
        "hireDate": "2023-06-01"
    },
    {
        "id": 5,
        "name": "Sofia Hernandez",
        "firstName": "Sofia",
        "lastName": "Hernandez",
        "role": "cashier",
        "email": "sofia.hernandez@casaestrella.com",
        "phone": "+44 7700 900005",
        "hourlyRate": 11.50,
        "hoursWorked": 40,
        "isActive": True,
        "hireDate": "2023-04-15"
    }
]

MOCK_INVENTORY = [
    {
        "id": 1,
        "sku": "BEEF-001",
        "name": "Ground Beef",
        "category": "Meat",
        "currentStock": 25.5,
        "unit": "kg",
        "minThreshold": 10,
        "maxThreshold": 50,
        "costPerUnit": 8.50,
        "supplier": "Premium Meats Ltd",
        "lastRestocked": "2025-07-01",
        "status": "in_stock"
    },
    {
        "id": 2,
        "sku": "CHICK-001",
        "name": "Chicken Breast",
        "category": "Meat",
        "currentStock": 18.2,
        "unit": "kg",
        "minThreshold": 15,
        "maxThreshold": 40,
        "costPerUnit": 6.75,
        "supplier": "Premium Meats Ltd",
        "lastRestocked": "2025-06-30",
        "status": "in_stock"
    }
]

MOCK_ORDERS = [
    {
        "id": 1,
        "name": "Order #001",
        "date_order": "2025-07-03T10:30:00Z",
        "state": "paid",
        "amount_total": 24.50,
        "partner_name": "Table 5",
        "session_id": 1,
        "lines": [
            {
                "id": 1,
                "product_name": "Chicken Tacos",
                "qty": 2,
                "price_unit": 8.50,
                "price_subtotal": 17.00
            }
        ]
    }
]

MOCK_ANALYTICS = {
    "todaySummary": { 
        "totalSales": 2847.50, 
        "transactions": 127, 
        "averageOrder": 22.42,
        "totalRevenue": 2847.50,
        "totalOrders": 127,
        "averageOrderValue": 22.42
    },
    "weeklyLabor": { 
        "totalActualHours": 248, 
        "totalLaborCost": 3720.00, 
        "efficiency": 87.5,
        "scheduledHours": 280,
        "overtimeHours": 8
    },
    "topItemsToday": [
        { "name": "Chicken Tacos", "quantity": 45, "revenue": 675.00 },
        { "name": "Beef Burrito", "quantity": 38, "revenue": 570.00 },
        { "name": "Churros", "quantity": 32, "revenue": 192.00 },
        { "name": "Margarita", "quantity": 28, "revenue": 336.00 },
        { "name": "Quesadilla", "quantity": 25, "revenue": 375.00 }
    ],
    "topPerformersToday": [
        { "name": "Maria Garcia", "role": "Server", "orders": 18, "sales": 425.50 },
        { "name": "Jose Rodriguez", "role": "Chef", "orders": 16, "sales": 398.25 },
        { "name": "Ana Martinez", "role": "Bartender", "orders": 12, "sales": 286.75 },
        { "name": "Carlos Lopez", "role": "Server", "orders": 14, "sales": 315.80 },
        { "name": "Sofia Hernandez", "role": "Cashier", "orders": 11, "sales": 267.90 }
    ],
    "salesTrend": [
        { "period": "Mon", "sales": 1850.25 },
        { "period": "Tue", "sales": 2124.50 },
        { "period": "Wed", "sales": 1976.75 },
        { "period": "Thu", "sales": 2398.00 },
        { "period": "Fri", "sales": 3247.50 },
        { "period": "Sat", "sales": 3856.25 },
        { "period": "Sun", "sales": 2847.50 }
    ]
}

def success_response(data: Any, message: str = "Success") -> Dict[str, Any]:
    """Standard success response format"""
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }

def error_response(message: str, status_code: int = 400) -> Dict[str, Any]:
    """Standard error response format"""
    return {
        "success": False,
        "message": message,
        "data": None,
        "timestamp": datetime.now().isoformat()
    }

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "fynlo-pos-api", "timestamp": datetime.now().isoformat()}

# Employee endpoints
@app.get("/api/v1/employees")
def get_employees():
    return success_response(MOCK_EMPLOYEES, "Employees retrieved successfully")

@app.get("/api/v1/employees/{employee_id}")
def get_employee(employee_id: int):
    employee = next((emp for emp in MOCK_EMPLOYEES if emp["id"] == employee_id), None)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return success_response(employee, "Employee retrieved successfully")

# Inventory endpoints
@app.get("/api/v1/inventory")
def get_inventory():
    return success_response(MOCK_INVENTORY, "Inventory retrieved successfully")

# Orders endpoints
@app.get("/api/v1/orders/recent")
def get_recent_orders(limit: int = 20):
    return success_response(MOCK_ORDERS[:limit], "Recent orders retrieved successfully")

# Analytics/Reports endpoints
@app.get("/api/v1/analytics/dashboard")
def get_analytics_dashboard():
    return success_response(MOCK_ANALYTICS, "Analytics dashboard data retrieved successfully")

@app.get("/api/v1/reports/dashboard")
def get_reports_dashboard():
    """Alias for analytics dashboard for reports screen"""
    return success_response(MOCK_ANALYTICS, "Reports dashboard data retrieved successfully")

# Categories endpoints
@app.get("/api/v1/categories")
def get_categories():
    categories = [
        {"id": 1, "name": "Main Dishes", "active": True},
        {"id": 2, "name": "Appetizers", "active": True},
        {"id": 3, "name": "Beverages", "active": True},
        {"id": 4, "name": "Desserts", "active": True}
    ]
    return success_response(categories, "Categories retrieved successfully")

# Products endpoints
@app.get("/api/v1/products/mobile")
def get_products_mobile():
    products = [
        {
            "id": 1,
            "name": "Chicken Tacos",
            "price": 8.50,
            "category": "Main Dishes",
            "available_in_pos": True,
            "active": True
        },
        {
            "id": 2,
            "name": "Beef Burrito",
            "price": 12.00,
            "category": "Main Dishes", 
            "available_in_pos": True,
            "active": True
        }
    ]
    return success_response(products, "Products retrieved successfully")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)