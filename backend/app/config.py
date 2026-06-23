from pydantic_settings import BaseSettings
from pydantic import model_validator
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

    @model_validator(mode="after")
    def _no_weak_secrets(self):
        # Fail closed: refuse to start with the known weak defaults. Production
        # MUST set strong JWT_SECRET and ADMIN_PASSWORD in the environment (.env).
        if self.JWT_SECRET in ("", "change-me"):
            raise ValueError("JWT_SECRET is unset or weak — set a strong value in the environment")
        if self.ADMIN_PASSWORD in ("", "changeme"):
            raise ValueError("ADMIN_PASSWORD is unset or weak — set a strong value in the environment")
        return self


@lru_cache()
def get_settings() -> Settings:
    return Settings()
