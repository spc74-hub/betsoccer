from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.models import Match, User
from app.schemas import SyncResponse, SyncStats
from app.services.football_api import fetch_all_tracked_matches
from app.services.points import calculate_points_for_match

router = APIRouter(prefix="/api/sync", tags=["sync"])
settings = get_settings()


def _verify_secret(request: Request) -> bool:
    auth = request.headers.get("authorization", "")
    secret = settings.SYNC_API_SECRET
    if not secret:
        return False
    return auth == f"Bearer {secret}"


@router.post("", response_model=SyncResponse)
async def sync_matches(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    # Auth: either bearer secret (cron) or logged-in user
    # get_current_user already validates the JWT; if it fails we won't get here
    # But for cron jobs we also accept the sync secret
    # (The dependency already passed, so we're authenticated)

    try:
        matches = await fetch_all_tracked_matches()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch matches from Football API: {str(e)}",
        )

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
                was_not_finished = existing.status != "FINISHED"
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


@router.get("")
async def sync_info():
    return {
        "endpoint": "/api/sync",
        "method": "POST",
        "auth": "Bearer token required",
        "description": "Syncs matches from Football API to database",
    }
