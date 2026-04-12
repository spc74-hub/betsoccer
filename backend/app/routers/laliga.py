from fastapi import APIRouter, Query

from app.services.football_api import (
    COMPETITION_IDS,
    fetch_competition_matches,
    fetch_competition_standings,
)

router = APIRouter(prefix="/api/laliga", tags=["laliga"])


@router.get("")
async def get_laliga(
    division: str = Query("primera"),
    type: str = Query("matches"),
):
    comp_id = COMPETITION_IDS["SEGUNDA"] if division == "segunda" else COMPETITION_IDS["LA_LIGA"]

    if type == "standings":
        standings = await fetch_competition_standings(comp_id)
        return {"standings": standings}
    else:
        matches = await fetch_competition_matches(comp_id)
        return {"matches": matches}
