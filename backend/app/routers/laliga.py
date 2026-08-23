from fastapi import APIRouter, Query

from app.services.football_api import (
    COMPETITION_IDS,
    fetch_competition_matches,
    fetch_competition_standings,
)

router = APIRouter(prefix="/api/laliga", tags=["laliga"])


@router.get("")
async def get_laliga(type: str = Query("matches")):
    # Solo Primera. La Segunda (codigo SD) NO esta en el plan gratuito de
    # football-data.org: devuelve 403 "resource restricted". Existia aqui un
    # parametro division=segunda que el frontend nunca llamaba y que habria
    # reventado al primer clic. Para el Castellon se usa /api/castellon, que
    # tira de otra fuente. Verificado el 2026-08-23.
    comp_id = COMPETITION_IDS["LA_LIGA"]

    if type == "standings":
        standings = await fetch_competition_standings(comp_id)
        return {"standings": standings}
    else:
        matches = await fetch_competition_matches(comp_id)
        return {"matches": matches}
