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

    # --- CD Castellon (LaLiga Hypermotion). Solo lectura, fuera de las apuestas.
    # El plan gratuito de RapidAPI son 100 peticiones AL MES: el presupuesto se
    # queda por debajo para dejar margen a pruebas manuales.
    RAPIDAPI_KEY: str = ""
    RAPIDAPI_MONTHLY_BUDGET: int = 85
    CASTELLON_TEAM_ID: int = 10279       # primer equipo (el filial es 1784556)
    CASTELLON_LEAGUE_ID: int = 140       # LaLiga2; estable entre temporadas
    CASTELLON_SCAN_INTERVAL_HOURS: int = 84   # ~2 escaneos por semana
    CASTELLON_MAX_CALLS_PER_SCAN: int = 6
    CASTELLON_STANDINGS_TTL_HOURS: int = 84

    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "changeme"
    ADMIN_DISPLAY_NAME: str = "Admin"

    # Cloudflare Access auto-login (Option B). When CF_ACCESS_AUD is set, the
    # /api/auth/cf-access endpoint trades a verified CF Access identity for a
    # betsoccer session (no password). AUD = the app's "AUD tag".
    CF_ACCESS_TEAM_DOMAIN: str = "https://spcapps.cloudflareaccess.com"
    CF_ACCESS_AUD: str = ""

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
