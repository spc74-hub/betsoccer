"""Seed script: creates initial admin user and default season."""

import asyncio
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.config import get_settings
from app.database import async_session, init_db
from app.models.models import Season, User

settings = get_settings()


async def seed():
    await init_db()

    async with async_session() as db:
        # Create admin user if not exists
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        admin = result.scalar_one_or_none()

        if not admin:
            admin = User(
                email=settings.ADMIN_EMAIL,
                display_name=settings.ADMIN_DISPLAY_NAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
            )
            db.add(admin)
            await db.commit()
            print(f"Admin user created: {settings.ADMIN_EMAIL}")
        else:
            print(f"Admin user already exists: {settings.ADMIN_EMAIL}")

        # Create default season if none exists
        result = await db.execute(select(Season).where(Season.is_active == True))
        active_season = result.scalar_one_or_none()

        if not active_season:
            season = Season(name="Temporada 2024/25", is_active=True)
            db.add(season)
            await db.commit()
            print("Default season created: Temporada 2024/25")
        else:
            print(f"Active season already exists: {active_season.name}")


if __name__ == "__main__":
    asyncio.run(seed())
