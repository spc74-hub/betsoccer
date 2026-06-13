from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_token
from app.config import get_settings
from app.database import get_db
from app.models.models import Match, User
from app.schemas import SyncResponse, SyncStats
from app.services.football_api import (
    COMPETITION_IDS,
    fetch_all_tracked_matches,
    fetch_competition_matches,
)
from app.services.points import calculate_points_for_match

router = APIRouter(prefix="/api/sync", tags=["sync"])
settings = get_settings()


async def require_sync_auth(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Allow either a valid user JWT or the SYNC_API_SECRET bearer token.

    The secret path is what unattended cron jobs use, since a JWT expires
    after JWT_EXPIRATION_MINUTES and can't be kept fresh by a scheduler.
    """
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[len("Bearer "):]

    # Cron path: shared secret
    secret = settings.SYNC_API_SECRET
    if secret and token == secret:
        return

    # User path: valid JWT belonging to an existing user
    payload = decode_token(token)  # raises 401 if invalid
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=401, detail="User not found")


async def _upsert_matches(db: AsyncSession, matches: list[dict]) -> tuple[int, int, int]:
    """Insert/update matches and recalculate points for finished ones.

    Shared by the team-based sync (Real Madrid / Barcelona) and the
    competition-based sync (World Cup). Returns (created, updated, errors).
    """
    created = 0
    updated = 0
    errors = 0

    for m in matches:
        result = await db.execute(
            select(Match).where(Match.external_id == m["external_id"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            needs_update = (
                existing.status != m["status"]
                or existing.home_score != m["home_score"]
                or existing.away_score != m["away_score"]
                or existing.home_score_halftime != m["home_score_halftime"]
                or existing.away_score_halftime != m["away_score_halftime"]
                or existing.kickoff_utc != m["kickoff_utc"]
            )
            if needs_update:
                existing.status = m["status"]
                existing.home_score = m["home_score"]
                existing.away_score = m["away_score"]
                existing.home_score_halftime = m["home_score_halftime"]
                existing.away_score_halftime = m["away_score_halftime"]
                existing.kickoff_utc = m["kickoff_utc"]
                existing.venue = m["venue"]
                try:
                    await db.commit()
                    # Calculate points if match just finished
                    if existing.status == "FINISHED":
                        await calculate_points_for_match(db, existing)
                    updated += 1
                except Exception:
                    await db.rollback()
                    errors += 1
        else:
            new_match = Match(
                external_id=m["external_id"],
                competition=m["competition"],
                competition_logo=m["competition_logo"],
                season=m["season"],
                home_team=m["home_team"],
                home_team_logo=m["home_team_logo"],
                away_team=m["away_team"],
                away_team_logo=m["away_team_logo"],
                kickoff_utc=m["kickoff_utc"],
                venue=m["venue"],
                status=m["status"],
                home_score=m["home_score"],
                away_score=m["away_score"],
                home_score_halftime=m["home_score_halftime"],
                away_score_halftime=m["away_score_halftime"],
            )
            db.add(new_match)
            try:
                await db.commit()
                # Calculate points if inserted already finished
                if new_match.status == "FINISHED":
                    await db.refresh(new_match)
                    await calculate_points_for_match(db, new_match)
                created += 1
            except Exception:
                await db.rollback()
                errors += 1

    return created, updated, errors


@router.post("", response_model=SyncResponse)
async def sync_matches(
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(require_sync_auth),
):
    try:
        matches = await fetch_all_tracked_matches()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch matches from Football API: {str(e)}",
        )

    created, updated, errors = await _upsert_matches(db, matches)

    return SyncResponse(
        success=True,
        message="Matches synced successfully",
        stats=SyncStats(
            total=len(matches),
            created=created,
            updated=updated,
            errors=errors,
            timestamp=datetime.now(timezone.utc).isoformat(),
        ),
    )


@router.post("/worldcup", response_model=SyncResponse)
async def sync_worldcup(
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(require_sync_auth),
):
    """Sync all FIFA World Cup matches from football-data.org into the matches table.

    Uses the same upsert + points logic as the team-based sync. Intended to be
    run while the 'Mundial 2026' season is active so predictions and standings
    attach to it.
    """
    try:
        matches = await fetch_competition_matches(COMPETITION_IDS["WORLD_CUP"])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch World Cup matches from Football API: {str(e)}",
        )

    created, updated, errors = await _upsert_matches(db, matches)

    return SyncResponse(
        success=True,
        message="World Cup matches synced successfully",
        stats=SyncStats(
            total=len(matches),
            created=created,
            updated=updated,
            errors=errors,
            timestamp=datetime.now(timezone.utc).isoformat(),
        ),
    )


@router.get("")
async def sync_info():
    return {
        "endpoint": "/api/sync",
        "method": "POST",
        "auth": "Bearer token required",
        "description": "Syncs matches from Football API to database",
    }
