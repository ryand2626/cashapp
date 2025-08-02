#!/usr/bin/env python3
"""
Minimal Backend Server for Fynlo POS Testing
Provides essential endpoints without complex dependencies
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime

app = FastAPI(
    title="Fynlo POS - Minimal Server",
    description="Lightweight backend for testing",
    version="1.0.0"
)

# Enable CORS for frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Fynlo POS Minimal Server",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/v1/platform/service-charge")
async def get_service_charge():
    """Service charge configuration endpoint"""
    return {
        "success": True,
        "data": {
            "service_charge": {
                "enabled": True,
                "rate": 12.5,
                "description": "Platform service charge",
                "lastUpdated": datetime.now().isoformat()
            }
        }
    }

@app.post("/api/v1/platform/service-charge")
async def update_service_charge():
    """Update service charge configuration"""
    return {
        "success": True,
        "message": "Service charge updated successfully"
    }

@app.get("/api/v1/platform/payment-methods")
async def get_payment_methods():
    """Payment methods configuration endpoint"""
    return {
        "success": True,
        "data": {
            "payment_methods": [
                {
                    "id": "qr_code",
                    "name": "QR Code Payment",
                    "enabled": True,
                    "fee_percentage": 1.2
                },
                {
                    "id": "card",
                    "name": "Card Payment",
                    "enabled": True,
                    "fee_percentage": 2.9
                },
                {
                    "id": "cash",
                    "name": "Cash Payment",
                    "enabled": True,
                    "fee_percentage": 0.0
                }
            ]
        }
    }

@app.get("/api/v1/platform/settings")
async def get_platform_settings():
    """Platform settings endpoint"""
    return {
        "success": True,
        "data": {
            "platform": {
                "name": "Fynlo POS",
                "version": "1.0.0",
                "service_charge": {
                    "enabled": True,
                    "rate": 12.5
                },
                "payment_processing": {
                    "qr_enabled": True,
                    "card_enabled": True,
                    "cash_enabled": True
                }
            }
        }
    }

@app.post("/api/v1/auth/login")
async def login():
    """Authentication login endpoint"""
    return {
        "success": True,
        "data": {
            "access_token": "mock_jwt_token_123",
            "token_type": "bearer",
            "user": {
                "id": "1",
                "email": "demo@fynlopos.com",
                "role": "manager"
            }
        },
        "message": "Login successful"
    }

@app.post("/api/v1/auth/logout")
async def logout():
    """Authentication logout endpoint"""
    return {
        "success": True,
        "message": "Logout successful"
    }

@app.get("/api/v1/products/mobile")
async def get_products_mobile():
    """Mobile-optimized products endpoint"""
    return {
        "success": True,
        "data": [
            {
                "id": 1,
                "name": "Tacos al Pastor",
                "price": 8.50,
                "category": "Main Dishes",
                "image": "",
                "available_in_pos": True,
                "active": True
            },
            {
                "id": 2,
                "name": "Guacamole",
                "price": 6.00,
                "category": "Appetizers", 
                "image": "",
                "available_in_pos": True,
                "active": True
            }
        ]
    }

@app.get("/api/v1/categories")
async def get_categories():
    """Product categories endpoint"""
    return {
        "success": True,
        "data": [
            {"id": 1, "name": "Main Dishes", "active": True},
            {"id": 2, "name": "Appetizers", "active": True},
            {"id": 3, "name": "Beverages", "active": True}
        ]
    }

@app.post("/api/v1/orders")
async def create_order():
    """Create order endpoint"""
    return {
        "success": True,
        "data": {
            "id": 1001,
            "state": "draft",
            "amount_total": 14.50,
            "date_order": datetime.now().isoformat()
        },
        "message": "Order created successfully"
    }

@app.post("/api/v1/payments/process")
async def process_payment():
    """Payment processing endpoint"""
    return {
        "success": True,
        "data": {
            "payment_id": "pay_123",
            "provider": "stripe",
            "amount": 14.50,
            "fee": 0.42,
            "net_amount": 14.08,
            "status": "completed"
        },
        "message": "Payment processed successfully"
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Fynlo POS Backend Server...")
    print("📡 Network Configuration:")
    print("   • Host: 0.0.0.0 (accepting all network interfaces)")
    print("   • Port: 8000")
    print("   • LAN Access: http://192.168.68.101:8000")
    print("   • Local Access: http://localhost:8000")
    print("   • Health Check: /health")
    print("🔧 CORS: Enabled for all origins")
    
    # Bind to 0.0.0.0 to accept all connections
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000, 
        log_level="info",
        access_log=True
    )