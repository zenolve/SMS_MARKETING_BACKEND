from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import get_settings

from routers import agencies, restaurants, customers, campaigns, webhooks, sms, twilio, stats

settings = get_settings()

app = FastAPI(
    title="SMS Marketing API",
    description="SMS marketing platform with Twilio integration",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/health")
async def health_check():
    return {"status": "healthy", "env": settings.env}