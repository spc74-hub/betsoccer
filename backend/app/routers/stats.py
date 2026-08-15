from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import User
from app.services.stats import get_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])


# No response_model here: the payload is a deep, mostly-numeric tree and
# mirroring it in Pydantic would add a lot of schema for no validation value.
@router.get("")
async def read_stats(
    season_id: UUID | None = Query(None),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Blocks A-D for the given season (active season when omitted)."""
    return await get_stats(db, season_id)
