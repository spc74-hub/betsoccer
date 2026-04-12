from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import User
from app.services.points import recalculate_all_points

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/recalculate-points")
async def recalculate_points(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    results = await recalculate_all_points(db)
    return {"success": True, "results": results}
