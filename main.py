from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings

from routers import agencies, restaurants, customers, campaigns, webhooks, sms, twilio, stats, transactions, admin

settings = get_settings()

from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title="SMS Marketing API",
    description="SMS marketing platform with Twilio integration",
    version="1.0.0"
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — browser requests are proxied via Next.js (/api/*)
# so this only needs to allow the Next.js dev server origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agencies.router, prefix="/agencies", tags=["Agencies"])
app.include_router(restaurants.router, prefix="/restaurants", tags=["Restaurants"])
app.include_router(customers.router, prefix="/customers", tags=["Customers"])
app.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks"])
app.include_router(sms.router, prefix="/sms", tags=["SMS"])
app.include_router(twilio.router, prefix="/twilio", tags=["Twilio"])
app.include_router(stats.router, prefix="/stats", tags=["Stats"])
app.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
app.include_router(admin.router, tags=["Admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "env": settings.env}