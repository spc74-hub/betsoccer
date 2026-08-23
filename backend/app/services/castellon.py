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
from app.services import marca_calendar

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


async def _sync_quota(db: AsyncSession, headers) -> None:
    """Cuadra el contador con lo que dice RapidAPI en cada respuesta.

    Contarlas por nuestra cuenta se desincroniza: la ventana de RapidAPI no es el
    mes natural, se renueva a los 31 dias de la suscripcion. Con un contador
    propio que se reinicia el dia 1, la app se creeria con cuota que no tiene y
    empezaria a comerse 429 reales. La cabecera viene en cada respuesta y es
    gratis, asi que manda ella; contar a mano queda solo de respaldo.
    """
    try:
        limit = int(headers["X-RateLimit-Requests-Limit"])
        remaining = int(headers["X-RateLimit-Requests-Remaining"])
    except (KeyError, TypeError, ValueError):
        await _spend(db)
        return
    await _cache_put(
        db, _QUOTA_KEY, {"month": _month(), "used": max(0, limit - remaining), "limit": limit}
    )


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
        # Antes de raise_for_status: un 4xx/5xx tambien consume cuota en RapidAPI.
        await _sync_quota(db, res.headers)
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


async def _legacy_scan(db: AsyncSession, force: bool = False) -> dict:
    """Metodo antiguo: escanear fechas a ciegas contra la API.

    Queda como **respaldo** para cuando el calendario de Marca no se pueda leer.
    Es correcto pero caro (~30 llamadas/mes de las 100) y solo alcanza 17 dias
    vista, porque pregunta fecha a fecha sin saber cuales tienen partido.
    """
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
        "source": "api-scan",
        "quota": await quota_state(db),
    }


# ---------- motor principal: calendario de Marca + resultados de la API ----------

_CALENDAR_KEY = "castellon:calendar"
CALENDAR_TTL_DAYS = 7

# Cuanto se sigue intentando traer el resultado de un partido ya jugado. Pasado
# ese plazo se muestra sin marcador en vez de reintentar para siempre (un partido
# aplazado no aparecera nunca con resultado).
RESULT_CHASE_DAYS = 10


async def get_calendar(db: AsyncSession, force: bool = False) -> Optional[dict]:
    """Calendario de la temporada. No gasta cuota de la API: sale de Marca.

    Se refresca cada semana, no una sola vez: los horarios que LaLiga aun no ha
    confirmado vienen con un hueco por defecto (domingo 18:00) y se van
    concretando con unas 3 semanas de antelacion.
    """
    row = await db.get(ApiCache, _CALENDAR_KEY)
    guardado = (row.payload or {}) if row else {}
    caducado = (
        row is None
        or _now() - row.fetched_at >= timedelta(days=CALENDAR_TTL_DAYS)
        # Cache escrita antes de que existieran los escudos: se rebaja sola en vez
        # de esperar una semana a tenerlos (bajarla no cuesta cuota de la API).
        or "crests" not in guardado
    )

    if force or caducado:
        fresco = await marca_calendar.fetch_calendar(_now())
        if fresco:
            await _cache_put(db, _CALENDAR_KEY, fresco)
            return fresco
        logger.warning("castellon: calendario no disponible, se usa el cacheado si lo hay")

    return guardado or None


def _day_key(iso: str) -> str:
    return f"castellon:day:{(_parse(iso) or _now()):%Y%m%d}"


async def get_matches(db: AsyncSession, force: bool = False) -> dict:
    """Proximos partidos y resultados.

    El calendario manda: sabiendo que dias juega el Castellon, la API solo se
    llama para los partidos ya jugados de los que aun no tenemos marcador — una
    llamada por jornada en vez de escanear 28 fechas a ciegas.
    """
    now = _now()
    payload = await get_calendar(db, force=force)
    calendario = (payload or {}).get("matches") or []
    if not calendario:
        return await _legacy_scan(db, force)

    jugados = [m for m in calendario if (_parse(m["utc_time"]) or now) < now]
    futuros = [m for m in calendario if (_parse(m["utc_time"]) or now) >= now]

    # Del mas reciente hacia atras: si el tope por escaneo corta, corta por lo mas viejo.
    calls = 0
    for m in reversed(jugados):
        if calls >= settings.CASTELLON_MAX_CALLS_PER_SCAN:
            break
        kickoff = _parse(m["utc_time"])
        if not kickoff or kickoff < now - timedelta(days=RESULT_CHASE_DAYS):
            break  # demasiado viejo: se deja sin marcador y no se persigue mas
        key = _day_key(m["utc_time"])
        row = await db.get(ApiCache, key)
        cached = row.payload if row else None
        if cached and any(x["finished"] for x in cached.get("matches", [])):
            continue  # ya tenemos el resultado
        if row and not force and _now() - row.fetched_at < timedelta(hours=3):
            continue  # se intento hace poco; no insistir cada visita a la pagina
        fresh = await _fetch_day(db, kickoff.date())
        if fresh is None:
            break  # sin cuota o API caida: se sirve lo que haya
        await _cache_put(db, key, fresh)
        calls += 1

    async def _con_resultado(m: dict) -> dict:
        cached = await _cache_get(db, _day_key(m["utc_time"])) or {}
        api = next(iter(cached.get("matches", [])), None)
        return {
            **m,
            "home_score": api["home_score"] if api and api["finished"] else None,
            "away_score": api["away_score"] if api and api["finished"] else None,
            "finished": bool(api and api["finished"]),
        }

    resultados = [await _con_resultado(m) for m in reversed(jugados)]
    proximos = [{**m, "home_score": None, "away_score": None, "finished": False} for m in futuros]

    return {
        "results": resultados,
        "upcoming": proximos,
        "source": "marca+api",
        "quota": await quota_state(db),
    }


# ---------- clasificacion ----------

async def _standings_stale(db: AsyncSession, fetched_at: datetime) -> bool:
    """La clasificacion solo cambia cuando se juega.

    Antes se refrescaba cada 84 h aunque no hubiera pasado nada. Ahora se mira el
    calendario: si desde la ultima vez se ha disputado algun partido, toca
    refrescar; si no, la tabla guardada sigue siendo valida por definicion. El TTL
    largo queda de red de seguridad (jornadas de otros equipos, sanciones).
    """
    now = _now()
    if now - fetched_at >= timedelta(hours=settings.CASTELLON_STANDINGS_TTL_HOURS):
        return True
    calendario = (await _cache_get(db, _CALENDAR_KEY) or {}).get("matches") or []
    return any(
        fetched_at < (_parse(m["utc_time"]) or now) + timedelta(hours=2) < now
        for m in calendario
    )


async def get_standings(db: AsyncSession, force: bool = False) -> dict:
    cached = await _cache_get(db, _STANDINGS_KEY)
    row = await db.get(ApiCache, _STANDINGS_KEY)
    # Tabla guardada antes de que existieran los escudos: se rehace sola en vez de
    # esperar a la siguiente jornada, o el usuario no los veria hasta entonces.
    sin_escudos = bool((cached or {}).get("table")) and "crest" not in cached["table"][0]
    stale = row is None or sin_escudos or await _standings_stale(db, row.fetched_at)

    if force or stale:
        data = await _rapid_get(
            db, f"/football-get-standing-all?leagueid={settings.CASTELLON_LEAGUE_ID}"
        )
        if data is not None:
            table = (data.get("response") or {}).get("standing") or []
            # Los escudos salen del calendario ya cacheado: la API no los da y
            # bajarlos aparte no costaria cuota, pero tampoco hace falta.
            escudos = (await _cache_get(db, _CALENDAR_KEY) or {}).get("crests") or {}
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
                        "crest": marca_calendar.match_crest(t.get("name") or "", escudos),
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
