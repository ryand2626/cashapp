"""
Simplified Fynlo POS Backend for debugging DigitalOcean deployment
Minimal version to isolate the health check issue
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Simple logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create minimal FastAPI app
app = FastAPI(
    title="Fynlo POS Backend",
    description="Simplified version for deployment debugging",
    version="1.0.0"
)

# Add basic CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Simple health check endpoint"""
    return {
        "status": "success",
        "service": "Fynlo POS Backend API (Simplified)",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "unknown"),
        "port": os.getenv("PORT", "unknown"),
        "resend_configured": bool(os.getenv("RESEND_API_KEY"))
    }

@app.get("/health")
async def health_check():
    """Dedicated health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": "2025-01-08T10:15:00Z"
    }

@app.get("/debug/env")
async def debug_env():
    """Debug endpoint to check environment variables"""
    return {
        "environment_vars": {
            "ENVIRONMENT": os.getenv("ENVIRONMENT"),
            "PORT": os.getenv("PORT"),
            "DEBUG": os.getenv("DEBUG"),
            "RESEND_API_KEY_SET": bool(os.getenv("RESEND_API_KEY")),
            "DATABASE_URL_SET": bool(os.getenv("DATABASE_URL")),
            "REDIS_URL_SET": bool(os.getenv("REDIS_URL"))
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting simplified server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)