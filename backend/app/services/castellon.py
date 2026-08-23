"""CD Castellon (LaLiga Hypermotion) — solo lectura, aislado de las apuestas.

Fuente: "Free API Live Football Data" (RapidAPI, datos de FotMob). El plan
gratuito da 100 peticiones AL MES, no al dia, asi que todo aqui gira alrededor
de gastar lo minimo:

  - La cache vive en Postgres (tabla api_cache), no en memoria ni en disco: cada
    deploy recrea el contenedor y una cache local se perderia, pagando cuota otra
    vez en cada despliegue.
  - Una fecha ya jugada no vuelve a cambiar -> se congela PARA SIEMPRE. Ese es el
    truco que hace viable el calendario: en regimen estacionario solo se pagan las
    fechas nuevas que entran en la ventana.
  - Tope mensual propio (RAPIDAPI_MONTHLY_BUDGET). Al agotarse se sirve el dato
    viejo en vez de llamar: preferimos datos rancios a un 429.

Tres trampas de esta API, descubiertas probandola el 2026-08-23. No revertir sin
volver a comprobarlas:

  1. /football-get-all-matches-by-league?leagueid=140 devuelve la temporada
     PASADA (el parametro &season= se ignora) y ademas su campo `home` es una
     copia literal de `opponent` en 468 de 468 filas — da al Castellon como local
     en partidos donde es visitante. Es dato corrupto. Por eso el calendario sale
     de /football-get-matches-by-date, que si trae local y visitante bien.
  2. El id de liga de la temporada en curso cambia cada año (938653 en 2026-27),
     asi que no se hardcodea en ningun sitio: se filtra por id de equipo.
  3. Existe un "Castellon B" (id 1784556) en Segunda Federacion. Filtrar por
     nombre lo cuela como si fuera el primer equipo; hay que filtrar por
     CASTELLON_TEAM_ID.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.models import ApiCache

logger = logging.getLogger(__name__)
settings = get_settings()

RAPIDAPI_HOST = "free-api-live-football-data.p.rapidapi.com"
BASE = f"https://{RAPIDAPI_HOST}"

# Ventana de fechas que se escanea. Hacia atras, para los ultimos resultados;
# hacia delante, para los proximos partidos.
PAST_DAYS = 10
FUTURE_DAYS = 17

_QUOTA_KEY = "rapidapi:quota"
_SCAN_KEY = "castellon:lastscan"
_STANDINGS_KEY = "castellon:standings"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(iso: Optional[str]) -> Optional[datetime]:
    """La API devuelve '2026-09-06T15:00:00.000Z'. Comparar eso con el isoformat
    de Python ('+00:00') como cadenas funciona casi siempre y falla justo cuando
    los instantes coinciden. Se compara como datetime."""
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _month() -> str:
    return _now().strftime("%Y-%m")


# ---------- cache en BD ----------

async def _cache_get(db: AsyncSession, key: str) -> Optional[dict]:
    row = await db.get(ApiCache, key)
    return row.payload if row else None


async def _cache_put(db: AsyncSession, key: str, payload: dict) -> None:
    row = await db.get(ApiCache, key)
    if row:
        row.payload = payload
        row.fetched_at = _now()
    else:
        db.add(ApiCache(key=key, payload=payload, fetched_at=_now()))
    await db.commit()


# ---------- presupuesto mensual ----------

async def quota_state(db: AsyncSession) -> dict:
    payload = await _cache_get(db, _QUOTA_KEY) or {}
    if payload.get("month") != _month():
        payload = {"month": _month(), "used": 0}
    payload["budget"] = settings.RAPIDAPI_MONTHLY_BUDGET
    return payload


async def _spend(db: AsyncSession, n: int = 1) -> None:
    state = await quota_state(db)
    await _cache_put(db, _QUOTA_KEY, {"month": state["month"], "used": state["used"] + n})


async def _can_spend(db: AsyncSession) -> bool:
    state = await quota_state(db)
    return state["used"] < settings.RAPIDAPI_MONTHLY_BUDGET


# ---------- cliente HTTP ----------

async def _rapid_get(db: AsyncSession, path: str) -> Optional[dict]:
    """Una llamada real a RapidAPI. Devuelve None si no hay cuota o si falla.

    Nunca lanza: el que llama decide si sirve dato cacheado o se rinde. Con una
    cuota de 100/mes, un error transitorio no debe tumbar la pagina entera.
    """
    if not settings.RAPIDAPI_KEY:
        logger.warning("castellon: RAPIDAPI_KEY sin configurar")
        return None
    if not await _can_spend(db):
        logger.warning("castellon: presupuesto mensual agotado, no se llama a la API")
        return None

    headers = {"x-rapidapi-key": settings.RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(f"{BASE}{path}", headers=headers)
        await _spend(db)
        res.raise_for_status()
        return res.json()
    except Exception as e:  # noqa: BLE001 — cualquier fallo degrada a cache
        logger.warning("castellon: fallo llamando a %s: %s", path, e)
        return None


# ---------- partidos ----------

def _mine(match: dict) -> bool:
    """El partido es del PRIMER equipo del Castellon (no del filial)."""
    return settings.CASTELLON_TEAM_ID in (
        match.get("home", {}).get("id"),
        match.get("away", {}).get("id"),
    )


def _slim(match: dict) -> dict:
    """Solo lo que pinta la vista. Mantiene las filas de cache pequeñas."""
    status = match.get("status") or {}
    return {
        "id": match.get("id"),
        "league_id": match.get("leagueId"),
        "utc_time": status.get("utcTime"),
        "home": {"id": match["home"]["id"], "name": match["home"].get("longName") or match["home"]["name"]},
        "away": {"id": match["away"]["id"], "name": match["away"].get("longName") or match["away"]["name"]},
        "home_score": match["home"].get("score"),
        "away_score": match["away"].get("score"),
        "started": bool(status.get("started")),
        "finished": bool(status.get("finished")),
        "cancelled": bool(status.get("cancelled")),
    }


async def _fetch_day(db: AsyncSession, day: date) -> Optional[dict]:
    data = await _rapid_get(db, f"/football-get-matches-by-date?date={day:%Y%m%d}")
    if data is None:
        return None
    matches = (data.get("response") or {}).get("matches") or []
    return {"matches": [_slim(m) for m in matches if _mine(m)]}


def _needs_fetch(day: date, today: date, cached: Optional[dict], now: datetime) -> bool:
    """Decide si una fecha merece gastar una llamada.

    La regla que hace barato todo esto: una fecha ya jugada esta congelada, y una
    fecha futura ya cacheada no se vuelve a mirar hasta que el partido esta
    encima. Asi solo se paga por fechas nuevas y por los dias de partido.
    """
    if cached is None:
        return True
    if day < today - timedelta(days=2):
        return False  # pasado consolidado: no cambia nunca mas
    if day > today + timedelta(days=2):
        return False  # ya lo tenemos; los calendarios no se mueven a 3 dias vista
    # Ventana caliente: solo si el Castellon juega, la hora del saque ya paso y
    # el partido sigue sin resultado. Antes del pitido inicial no hay nada nuevo
    # que traer, y refrescar "por si acaso" es tirar cuota de un plan de 100/mes.
    return any(
        not m["finished"]
        and not m["cancelled"]
        and (_parse(m["utc_time"]) or now) <= now
        for m in cached.get("matches", [])
    )


async def _should_scan(db: AsyncSession, force: bool) -> bool:
    if force:
        return True
    scan = await _cache_get(db, _SCAN_KEY) or {}
    last = scan.get("at")
    if not last:
        return True
    elapsed = _now() - datetime.fromisoformat(last)
    if elapsed >= timedelta(hours=settings.CASTELLON_SCAN_INTERVAL_HOURS):
        return True
    # Hay un partido cuya hora ya paso y sigue sin resultado -> merece mirar
    # antes del intervalo normal, pero no mas de una vez cada 3 horas.
    return bool(scan.get("pending")) and elapsed >= timedelta(hours=3)


async def get_matches(db: AsyncSession, force: bool = False) -> dict:
    today = _now().date()
    now = _now()
    days = [today + timedelta(days=d) for d in range(-PAST_DAYS, FUTURE_DAYS + 1)]

    if await _should_scan(db, force):
        # Las fechas mas cercanas a hoy primero: si el tope por escaneo corta,
        # corta por lo menos relevante.
        calls = 0
        for day in sorted(days, key=lambda d: abs((d - today).days)):
            if calls >= settings.CASTELLON_MAX_CALLS_PER_SCAN:
                break
            key = f"castellon:day:{day:%Y%m%d}"
            cached = await _cache_get(db, key)
            if not _needs_fetch(day, today, cached, now):
                continue
            fresh = await _fetch_day(db, day)
            if fresh is None:
                break  # sin cuota o API caida: se sirve lo que haya
            await _cache_put(db, key, fresh)
            calls += 1

    matches: list[dict] = []
    for day in days:
        cached = await _cache_get(db, f"castellon:day:{day:%Y%m%d}")
        if cached:
            matches.extend(cached.get("matches", []))

    matches.sort(key=lambda m: m["utc_time"] or "")
    played = [m for m in matches if m["finished"]]
    upcoming = [m for m in matches if not m["finished"] and not m["cancelled"]]

    # "pending" = un partido cuya hora ya paso y sigue sin resultado. Permite
    # adelantar el siguiente escaneo sin esperar el intervalo completo.
    pending = any((_parse(m["utc_time"]) or now) < now for m in upcoming)
    await _cache_put(db, _SCAN_KEY, {"at": now.isoformat(), "pending": pending})

    return {
        "results": list(reversed(played)),  # el mas reciente primero
        "upcoming": upcoming,
        "quota": await quota_state(db),
    }


# ---------- clasificacion ----------

async def get_standings(db: AsyncSession, force: bool = False) -> dict:
    cached = await _cache_get(db, _STANDINGS_KEY)
    row = await db.get(ApiCache, _STANDINGS_KEY)
    stale = (
        row is None
        or _now() - row.fetched_at >= timedelta(hours=settings.CASTELLON_STANDINGS_TTL_HOURS)
    )

    if force or stale:
        data = await _rapid_get(
            db, f"/football-get-standing-all?leagueid={settings.CASTELLON_LEAGUE_ID}"
        )
        if data is not None:
            table = (data.get("response") or {}).get("standing") or []
            cached = {
                "updated_at": _now().isoformat(),
                "table": [
                    {
                        "position": t.get("idx"),
                        "team_id": t.get("id"),
                        "name": t.get("name"),
                        "played": t.get("played"),
                        "won": t.get("wins"),
                        "draw": t.get("draws"),
                        "lost": t.get("losses"),
                        "goals": t.get("scoresStr"),
                        "points": t.get("pts"),
                        "zone": t.get("qualColor"),
                        "is_castellon": t.get("id") == settings.CASTELLON_TEAM_ID,
                    }
                    for t in table
                ],
            }
            await _cache_put(db, _STANDINGS_KEY, cached)

    return {
        "table": (cached or {}).get("table", []),
        "updated_at": (cached or {}).get("updated_at"),
        "quota": await quota_state(db),
    }
