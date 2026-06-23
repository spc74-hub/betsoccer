"""Reset a user's password from the console (break-glass / admin reset).

This is the recovery path that does NOT depend on being able to log in: the
server owner can reset any account (including the admin's own). It also serves
as the admin's "reset a friend's password" tool — no email service needed.

Usage (on the VPS):
    docker exec betsoccer-backend python -m app.set_password <email> <new_password>
"""
import asyncio
import sys

from sqlalchemy import select

from app.auth import hash_password
from app.database import async_session
from app.models.models import User


async def _set_password(email: str, new_password: str) -> int:
    if len(new_password) < 6:
        print("La contraseña debe tener al menos 6 caracteres")
        return 1
    email = email.lower().strip()
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"No existe ningún usuario con email {email}")
            return 1
        user.hashed_password = hash_password(new_password)
        await db.commit()
        print(f"Contraseña actualizada para {email}")
        return 0


def main() -> None:
    if len(sys.argv) != 3:
        print("Uso: python -m app.set_password <email> <nueva_contraseña>")
        sys.exit(1)
    sys.exit(asyncio.run(_set_password(sys.argv[1], sys.argv[2])))


if __name__ == "__main__":
    main()
