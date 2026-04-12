from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import Match, Prediction, Season, User
from app.schemas import PredictionCreate, PredictionOut

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("", response_model=list[PredictionOut])
async def get_predictions(
    match_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    match_ids: str | None = Query(None),
    season_id: UUID | None = Query(None),
    has_points: bool | None = Query(None),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Prediction).order_by(Prediction.created_at.desc())

    if match_id:
        stmt = stmt.where(Prediction.match_id == match_id)

    if user_id:
        stmt = stmt.where(Prediction.user_id == user_id)

    if match_ids:
        ids = [UUID(mid.strip()) for mid in match_ids.split(",") if mid.strip()]
        if ids:
            stmt = stmt.where(Prediction.match_id.in_(ids))

    if season_id:
        stmt = stmt.where(Prediction.season_id == season_id)

    if has_points is True:
        stmt = stmt.where(Prediction.points > 0)

    result = await db.execute(stmt)
    return [PredictionOut.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=PredictionOut)
async def create_or_update_prediction(
    body: PredictionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check match exists and is open
    match_result = await db.execute(
        select(Match).where(Match.id == body.match_id)
    )
    match = match_result.scalar_one_or_none()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    if match.kickoff_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Predictions are closed for this match")

    # Determine which user to save for (cross-user predictions allowed)
    target_user_id = body.user_id or current_user.id

    # Get active season
    season_result = await db.execute(
        select(Season).where(Season.is_active == True)
    )
    active_season = season_result.scalar_one_or_none()

    # Upsert
    existing_result = await db.execute(
        select(Prediction).where(
            Prediction.user_id == target_user_id,
            Prediction.match_id == body.match_id,
        )
    )
    prediction = existing_result.scalar_one_or_none()

    if prediction:
        prediction.home_score = body.home_score
        prediction.away_score = body.away_score
        prediction.home_score_halftime = body.home_score_halftime
        prediction.away_score_halftime = body.away_score_halftime
        if active_season:
            prediction.season_id = active_season.id
    else:
        prediction = Prediction(
            user_id=target_user_id,
            match_id=body.match_id,
            home_score=body.home_score,
            away_score=body.away_score,
            home_score_halftime=body.home_score_halftime,
            away_score_halftime=body.away_score_halftime,
            season_id=active_season.id if active_season else None,
        )
        db.add(prediction)

    await db.commit()
    await db.refresh(prediction)
    return PredictionOut.model_validate(prediction)


@router.delete("")
async def delete_prediction(
    id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Prediction).where(
            Prediction.id == id,
            Prediction.user_id == current_user.id,
        )
    )
    prediction = result.scalar_one_or_none()
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    await db.delete(prediction)
    await db.commit()
    return {"success": True}
