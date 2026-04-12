from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.models import User
from app.schemas import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def get_users(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.display_name))
    return [UserOut.model_validate(u) for u in result.scalars().all()]
