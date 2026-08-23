"""Endpoints del CD Castellon. Solo para el usuario administrador.

Aislado a proposito de las apuestas: no toca `matches`, `predictions` ni
`points`, y no escribe nada en la tabla de partidos. El `external_id` de
`matches` es el id de football-data.org y meter ahi ids de otra fuente seria
pedir una colision que contaminaria el calculo de puntos. Aqui todo es lectura
sobre la cache de `api_cache`.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import require_admin
from app.database import get_db
from app.models.models import User
from app.services import castellon

router = APIRouter(prefix="/api/castellon", tags=["castellon"])


@router.get("/matches")
async def matches(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Proximos partidos y ultimos resultados del Castellon."""
    return await castellon.get_matches(db)


@router.get("/standings")
async def standings(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Clasificacion completa de LaLiga Hypermotion."""
    return await castellon.get_standings(db)


@router.post("/refresh")
async def refresh(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Fuerza un refresco saltandose el intervalo de escaneo.

    Sigue respetando el presupuesto mensual y el tope de llamadas por escaneo:
    pulsar el boton muchas veces no puede vaciar la cuota del mes.
    """
    partidos = await castellon.get_matches(db, force=True)
    tabla = await castellon.get_standings(db, force=True)
    return {"matches": partidos, "standings": tabla}
