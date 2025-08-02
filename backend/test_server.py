#!/usr/bin/env python3
"""
Simple test server to diagnose network connectivity issues
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from datetime import datetime

app = FastAPI(title="Network Test Server")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Network test server is running", "timestamp": datetime.now().isoformat()}

@app.get("/health")
async def health():
    return {"status": "healthy", "server": "test", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    print("🧪 Starting Network Test Server...")
    print("🌐 Testing network binding to 0.0.0.0:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="debug")