from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import Season, User
from app.schemas import (
    CloseSeasonRequest,
    CloseSeasonResponse,
    SeasonOut,
    StandingOut,
)
from app.services.seasons import (
    close_season_and_start_new,
    get_seasons_history,
    get_standings_for_season,
)

router = APIRouter(prefix="/api/standings", tags=["standings"])


@router.get("", response_model=list[StandingOut])
async def get_standings(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get active season
    result = await db.execute(select(Season).where(Season.is_active == True))
    active_season = result.scalar_one_or_none()
    if not active_season:
        return []

    standings = await get_standings_for_season(db, active_season.id)
    return standings


@router.get("/by-season", response_model=list[StandingOut])
async def get_standings_by_season(
    season_id: UUID = Query(...),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    standings = await get_standings_for_season(db, season_id)
    return standings


@router.get("/seasons", response_model=list[SeasonOut])
async def get_seasons(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Season).order_by(Season.start_date.desc()))
    return [SeasonOut.model_validate(s) for s in result.scalars().all()]


@router.post("/close-season")
async def close_season(
    body: CloseSeasonRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await close_season_and_start_new(db, body.new_season_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
