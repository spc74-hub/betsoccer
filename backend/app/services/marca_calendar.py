"""Calendario de la temporada del CD Castellon, leido de la pagina publica de Marca.

Por que no sale de la API: la de RapidAPI no tiene endpoint de "partidos de un
equipo", asi que el calendario obligaba a preguntar fecha por fecha (~30 llamadas
al mes de las 100 del plan) y aun asi solo cubria 17 dias vista. Marca publica la
temporada entera en **una** peticion que no gasta nada de esa cuota. Los
resultados y la clasificacion siguen viniendo de la API, que da dato estructurado
y distingue un aplazamiento de un partido sin jugar.

Se lee el bloque **JSON-LD de schema.org**, no la tabla HTML: es un formato
estandar y aguanta mucho mejor un rediseño. De la tabla solo se sacan los escudos.

Tres trampas verificadas el 2026-08-23. No quitar los comentarios sin volver a
comprobarlas:

  1. La pagina va en **iso-8859-15**, no UTF-8.
  2. **Marca escribe hora de Madrid con sufijo "Z"**, que significa UTC. El partido
     del 23/08 figura como `19:00Z` cuando su hora UTC real es 17:00 (contrastado
     con la API). Tomarse la Z al pie de la letra desplaza **todos** los horarios
     dos horas. Se interpreta como Europe/Madrid y se convierte.
  3. Los horarios que LaLiga aun no ha confirmado se rellenan con un hueco por
     defecto: **38 de los 42 partidos figuraban en domingo a las 18:00** al empezar
     la temporada. No es un fallo de Marca, es como funciona la liga. Se marcan
     como provisionales para no enseñarlos como firmes, y por eso el calendario se
     refresca cada semana en vez de bajarse una sola vez.
"""

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import httpx

logger = logging.getLogger(__name__)

CALENDAR_URL = "https://www.marca.com/futbol/segunda-division/calendario.html"
MADRID = ZoneInfo("Europe/Madrid")
TEAM_NAME = "Castellón"

# Margen a partir del cual el horario se considera sin confirmar. LaLiga los
# publica con unas 3 semanas de antelacion.
PROVISIONAL_DAYS = 21

_JSONLD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
_CREST = re.compile(
    r'<img src="(https://objetos\.estaticos-marca\.com/assets/sports/logos/[^"]+)" alt="([^"]+)"'
)


def _slug(dt: datetime, home: str, away: str) -> str:
    """Marca no da id de partido, asi que se compone uno estable."""
    limpio = re.sub(r"[^a-z0-9]+", "-", f"{home}-{away}".lower()).strip("-")
    return f"{dt:%Y%m%d}-{limpio}"


def _to_utc(marca_iso: str) -> Optional[datetime]:
    """'2026-08-23T19:00:00Z' (que en realidad es hora de Madrid) -> UTC real."""
    try:
        naive = datetime.fromisoformat(marca_iso.replace("Z", ""))
    except ValueError:
        return None
    return naive.replace(tzinfo=MADRID).astimezone(timezone.utc)


def _parse(html: str, now: datetime) -> list[dict]:
    eventos: list[dict] = []
    for bloque in _JSONLD.findall(html):
        try:
            data = json.loads(bloque)
        except json.JSONDecodeError:
            continue
        eventos.extend(data if isinstance(data, list) else [data])

    escudos = {alt: url for url, alt in _CREST.findall(html)}

    partidos = []
    for e in eventos:
        if e.get("@type") != "SportsEvent":
            continue
        home = (e.get("homeTeam") or {}).get("name")
        away = (e.get("awayTeam") or {}).get("name")
        if TEAM_NAME not in (home, away):
            continue
        kickoff = _to_utc(e.get("startDate", ""))
        if not kickoff:
            continue
        partidos.append(
            {
                "id": _slug(kickoff, home, away),
                "utc_time": kickoff.isoformat(),
                "home": {"name": home, "crest": escudos.get(home)},
                "away": {"name": away, "crest": escudos.get(away)},
                "provisional": kickoff > now + timedelta(days=PROVISIONAL_DAYS),
            }
        )

    partidos.sort(key=lambda m: m["utc_time"])
    return partidos


async def fetch_calendar(now: Optional[datetime] = None) -> Optional[list[dict]]:
    """Baja y parsea el calendario. Devuelve None si algo falla.

    Nunca lanza: si Marca cambia el HTML o no responde, el que llama sigue con el
    metodo antiguo (escanear fechas contra la API) en vez de dejar la pagina en
    blanco. Devolver una lista vacia tambien cuenta como fallo: significa que el
    parseo dejo de encontrar partidos.
    """
    now = now or datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            res = await client.get(
                CALENDAR_URL,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            )
        res.raise_for_status()
        # La pagina declara iso-8859-15; httpx acierta con el charset, pero se fuerza
        # por si el encabezado cambia.
        html = res.content.decode("iso-8859-15", errors="replace")
    except Exception as e:  # noqa: BLE001
        logger.warning("marca: no se pudo descargar el calendario: %s", e)
        return None

    partidos = _parse(html, now)
    if not partidos:
        logger.warning("marca: el calendario se descargo pero no se reconocio ningun partido")
        return None
    logger.info("marca: calendario con %d partidos del %s", len(partidos), TEAM_NAME)
    return partidos
