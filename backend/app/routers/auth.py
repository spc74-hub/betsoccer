import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt as cf_jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import get_settings
from app.database import get_db
from app.models.models import User
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_cf_settings = get_settings()
_cf_jwks: dict | None = None


async def _cloudflare_jwks() -> dict:
    global _cf_jwks
    if _cf_jwks is None:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.get(f"{_cf_settings.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs")
            res.raise_for_status()
            _cf_jwks = res.json()
    return _cf_jwks


@router.post("/cf-access", response_model=TokenResponse)
async def cf_access_login(request: Request, db: AsyncSession = Depends(get_db)):
    """Auto-login from a Cloudflare Access identity (no password). Validates the
    signed Cf-Access-Jwt-Assertion against the team's keys + this app's AUD, then
    matches the user by email. Only works behind Cloudflare Access."""
    if not _cf_settings.CF_ACCESS_AUD:
        raise HTTPException(status_code=503, detail="Cloudflare Access login not configured")
    assertion = request.headers.get("Cf-Access-Jwt-Assertion")
    if not assertion:
        raise HTTPException(status_code=401, detail="No Cloudflare Access assertion present")
    try:
        jwks = await _cloudflare_jwks()
        claims = cf_jwt.decode(
            assertion,
            jwks,
            algorithms=["RS256"],
            audience=_cf_settings.CF_ACCESS_AUD,
            issuer=_cf_settings.CF_ACCESS_TEAM_DOMAIN,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Cloudflare Access assertion")
    email = (claims.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=401, detail="Cloudflare Access assertion has no email")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=403, detail="No betsoccer account for this identity")
    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contrasena incorrectos")

    token = create_access_token(str(user.id), user.email)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="La contrasena actual no es correcta")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 6 caracteres")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Contrasena actualizada"}
