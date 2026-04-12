from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://spcadmin:PASSWORD@spcapps-postgres:5432/betsoccer"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 10080  # 7 days

    API_FOOTBALL_KEY: str = ""
    FOOTBALL_DATA_KEY: str = ""
    SYNC_API_SECRET: str = ""

    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "changeme"
    ADMIN_DISPLAY_NAME: str = "Admin"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
