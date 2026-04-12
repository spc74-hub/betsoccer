from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Match
from app.schemas import MatchOut

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("", response_model=list[MatchOut])
async def get_matches(
    status: str | None = Query(None),
    team: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Match).order_by(Match.kickoff_utc.asc())

    if status == "upcoming":
        stmt = stmt.where(Match.status.in_(["SCHEDULED", "LIVE"]))
    elif status == "finished":
        stmt = stmt.where(Match.status == "FINISHED")

    if team == "real-madrid":
        stmt = stmt.where(
            or_(
                Match.home_team.ilike("%Real Madrid%"),
                Match.away_team.ilike("%Real Madrid%"),
            )
        )
    elif team == "barcelona":
        stmt = stmt.where(
            or_(
                Match.home_team.ilike("%Barcelona%"),
                Match.away_team.ilike("%Barcelona%"),
            )
        )

    result = await db.execute(stmt)
    return [MatchOut.model_validate(m) for m in result.scalars().all()]
