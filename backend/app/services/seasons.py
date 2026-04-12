"""
Season management - replaces Supabase RPCs:
  - close_season_and_start_new
  - get_seasons_history
  - create_player
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Prediction, Season, User


async def close_season_and_start_new(
    db: AsyncSession, new_season_name: str
) -> dict:
    # Get active season
    result = await db.execute(select(Season).where(Season.is_active == True))
    current_season = result.scalar_one_or_none()
    if not current_season:
        raise ValueError("No active season found")

    # Find the winner
    standings = await get_standings_for_season(db, current_season.id)
    winner = standings[0] if standings else None

    # Close current season
    current_season.is_active = False
    current_season.end_date = datetime.now(timezone.utc)
    if winner:
        current_season.winner_user_id = winner["user_id"]
        current_season.winner_name = winner["display_name"]
        current_season.winner_points = winner["total_points"]

    # Create new season
    new_season = Season(
        name=new_season_name,
        start_date=datetime.now(timezone.utc),
        is_active=True,
    )
    db.add(new_season)
    await db.commit()
    await db.refresh(new_season)

    return {
        "closed_season_id": str(current_season.id),
        "winner_id": str(winner["user_id"]) if winner else None,
        "winner_name": winner["display_name"] if winner else None,
        "winner_points": winner["total_points"] if winner else 0,
        "new_season_id": str(new_season.id),
        "new_season_name": new_season_name,
    }


async def get_standings_for_season(
    db: AsyncSession, season_id: UUID
) -> list[dict]:
    stmt = (
        select(
            User.id.label("user_id"),
            User.display_name,
            User.avatar_url,
            func.coalesce(func.sum(Prediction.points), 0).label("total_points"),
            func.count(Prediction.id).label("total_predictions"),
            func.count(case((Prediction.points > 0, 1))).label("correct_predictions"),
            func.coalesce(func.sum(Prediction.points_winner), 0).label("points_winner"),
            func.coalesce(func.sum(Prediction.points_halftime), 0).label("points_halftime"),
            func.coalesce(func.sum(Prediction.points_difference), 0).label("points_difference"),
            func.coalesce(func.sum(Prediction.points_exact), 0).label("points_exact"),
        )
        .outerjoin(
            Prediction,
            (Prediction.user_id == User.id)
            & (Prediction.season_id == season_id)
            & (Prediction.points.isnot(None)),
        )
        .group_by(User.id, User.display_name, User.avatar_url)
        .order_by(func.coalesce(func.sum(Prediction.points), 0).desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    standings = []
    for row in rows:
        total_pred = int(row.total_predictions)
        correct = int(row.correct_predictions)
        accuracy = round((correct / total_pred) * 100, 1) if total_pred > 0 else 0.0
        standings.append({
            "user_id": row.user_id,
            "display_name": row.display_name,
            "avatar_url": row.avatar_url,
            "total_points": int(row.total_points),
            "total_predictions": total_pred,
            "correct_predictions": correct,
            "accuracy": accuracy,
            "points_winner": int(row.points_winner),
            "points_halftime": int(row.points_halftime),
            "points_difference": int(row.points_difference),
            "points_exact": int(row.points_exact),
        })
    return standings


async def get_seasons_history(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Season).order_by(Season.start_date.desc())
    )
    seasons = result.scalars().all()
    out = []
    for s in seasons:
        winner_name = s.winner_name
        winner_points = s.winner_points or 0
        # If winner_user_id exists but name not stored, look it up
        if s.winner_user_id and not winner_name:
            user_result = await db.execute(
                select(User.display_name).where(User.id == s.winner_user_id)
            )
            winner_name = user_result.scalar_one_or_none()
        out.append({
            "id": str(s.id),
            "name": s.name,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "end_date": s.end_date.isoformat() if s.end_date else None,
            "is_active": s.is_active,
            "winner_name": winner_name,
            "winner_points": winner_points,
            "winner_user_id": str(s.winner_user_id) if s.winner_user_id else None,
        })
    return out


async def create_player(
    db: AsyncSession,
    email: str,
    display_name: str,
    hashed_password: str,
    initial_points: int = 0,
) -> User:
    user = User(
        email=email,
        display_name=display_name,
        hashed_password=hashed_password,
        initial_points=initial_points,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
