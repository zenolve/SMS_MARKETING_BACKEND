from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Environment
    env: str = "dev"
    
    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_service_key: str
    
    # Twilio
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_messaging_service_sid: str = ""
    twilio_phone_number: str = ""  # Direct phone number (use this if messaging service fails)
    
    # API
    api_base_url: str = "http://localhost:8000"
    secret_key: str = "dev-secret-key"
    encryption_key: str = ""
    
    # SMTP Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"
    
    @property
    def is_dev(self) -> bool:
        return self.env.lower() == "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
