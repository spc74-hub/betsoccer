from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.models import User
from app.services.points import recalculate_all_points

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/recalculate-points")
async def recalculate_points(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    results = await recalculate_all_points(db)
    return {"success": True, "results": results}
