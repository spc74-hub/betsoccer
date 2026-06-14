"""
Football API integrations - ported from src/lib/football-api.ts and src/lib/api-football.ts.
Uses football-data.org (free tier) as primary and api-football as fallback.
"""

import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import get_settings

settings = get_settings()

# ---------- football-data.org (primary) ----------

FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
FOOTBALL_DATA_TEAMS = {"REAL_MADRID": 86, "BARCELONA": 81}
COMPETITION_IDS = {"LA_LIGA": "PD", "SEGUNDA": "SD", "WORLD_CUP": "WC", "CHAMPIONS": "CL"}

STATUS_MAP_FD = {
    "SCHEDULED": "SCHEDULED",
    "TIMED": "SCHEDULED",
    "IN_PLAY": "LIVE",
    "PAUSED": "LIVE",
    "FINISHED": "FINISHED",
    "POSTPONED": "POSTPONED",
    "CANCELLED": "CANCELLED",
    "SUSPENDED": "LIVE",
    "AWARDED": "FINISHED",
}

# ---------- api-football (fallback) ----------

API_FOOTBALL_BASE = "https://v3.football.api-sports.io"
API_FOOTBALL_TEAMS = {"REAL_MADRID": 541, "BARCELONA": 529}

STATUS_MAP_AF = {
    "TBD": "SCHEDULED", "NS": "SCHEDULED",
    "1H": "LIVE", "HT": "LIVE", "2H": "LIVE", "ET": "LIVE",
    "BT": "LIVE", "P": "LIVE", "SUSP": "LIVE", "INT": "LIVE", "LIVE": "LIVE",
    "FT": "FINISHED", "AET": "FINISHED", "PEN": "FINISHED",
    "AWD": "FINISHED", "WO": "FINISHED",
    "PST": "POSTPONED", "CANC": "CANCELLED", "ABD": "CANCELLED",
}


def _parse_utc(date_str: str) -> datetime:
    """Parse ISO date string to timezone-aware datetime."""
    dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _get_current_season() -> int:
    now = datetime.utcnow()
    return now.year - 1 if now.month < 7 else now.year


async def _fd_get(
    client: httpx.AsyncClient,
    path: str,
    params: Optional[dict] = None,
    retries: int = 3,
) -> dict:
    """GET against football-data.org with retries.

    The free tier intermittently drops the connection ("Server disconnected
    without sending a response"), which previously caused the sync to silently
    miss updates (e.g. a match going FINISHED). Retry transient request errors
    with a short backoff.
    """
    key = settings.FOOTBALL_DATA_KEY
    if not key:
        raise ValueError("FOOTBALL_DATA_KEY not configured")

    last_exc: Optional[Exception] = None
    for attempt in range(retries):
        try:
            resp = await client.get(
                f"{FOOTBALL_DATA_BASE}{path}",
                params=params,
                headers={"X-Auth-Token": key},
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.RequestError as e:
            # Network/transport errors (incl. RemoteProtocolError) -> retry
            last_exc = e
            if attempt < retries - 1:
                await asyncio.sleep(2 * (attempt + 1))
    raise last_exc


def _map_fd_match(m: dict) -> dict:
    """Map a football-data.org match object to our internal match dict."""
    season_year = int(m["season"]["startDate"][:4])
    return {
        "external_id": m["id"],
        "competition": m["competition"]["name"],
        "competition_logo": m["competition"].get("emblem"),
        "season": f"{season_year}/{season_year + 1}",
        "home_team": m["homeTeam"]["name"],
        "home_team_logo": m["homeTeam"].get("crest"),
        "away_team": m["awayTeam"]["name"],
        "away_team_logo": m["awayTeam"].get("crest"),
        "kickoff_utc": _parse_utc(m["utcDate"]),
        "venue": m.get("venue"),
        "status": STATUS_MAP_FD.get(m["status"], "SCHEDULED"),
        "home_score": m["score"]["fullTime"]["home"],
        "away_score": m["score"]["fullTime"]["away"],
        "home_score_halftime": m["score"]["halfTime"]["home"] if m["score"].get("halfTime") else None,
        "away_score_halftime": m["score"]["halfTime"]["away"] if m["score"].get("halfTime") else None,
    }


# Free-tier competitions scanned for tracked-team (Real Madrid / Barcelona)
# matches. The /teams/{id}/matches endpoint is restricted on the free tier
# (403), so we pull these competitions and filter by team id. Copa del Rey is
# not available on the free tier.
TRACKED_COMPETITIONS = [COMPETITION_IDS["LA_LIGA"], COMPETITION_IDS["CHAMPIONS"]]


async def fetch_all_tracked_matches() -> list[dict]:
    """Fetch all Real Madrid and Barcelona matches across free-tier competitions.

    Filters each competition's match list by team id and deduplicates (e.g. El
    Clasico appears once). Replaces the restricted /teams/{id}/matches endpoint.
    """
    tracked_team_ids = set(FOOTBALL_DATA_TEAMS.values())
    match_map: dict[int, dict] = {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        for comp_id in TRACKED_COMPETITIONS:
            try:
                data = await _fd_get(client, f"/competitions/{comp_id}/matches")
            except httpx.HTTPStatusError:
                # Competition out of season / unavailable on the plan -> skip.
                continue
            for m in data.get("matches", []):
                if (
                    m["homeTeam"].get("id") in tracked_team_ids
                    or m["awayTeam"].get("id") in tracked_team_ids
                ) and m.get("id"):
                    match_map[m["id"]] = _map_fd_match(m)

    return list(match_map.values())


async def fetch_competition_matches(competition_id: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        data = await _fd_get(client, f"/competitions/{competition_id}/matches")

    return [_map_fd_match(m) for m in data.get("matches", [])]


async def fetch_competition_standings(competition_id: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        data = await _fd_get(client, f"/competitions/{competition_id}/standings")

    total = next((s for s in data.get("standings", []) if s["type"] == "TOTAL"), None)
    if not total:
        return []

    return [
        {
            "position": t["position"],
            "team": {
                "id": t["team"]["id"],
                "name": t["team"]["name"],
                "shortName": t["team"]["shortName"],
                "crest": t["team"]["crest"],
            },
            "playedGames": t["playedGames"],
            "won": t["won"],
            "draw": t["draw"],
            "lost": t["lost"],
            "points": t["points"],
            "goalsFor": t["goalsFor"],
            "goalsAgainst": t["goalsAgainst"],
            "goalDifference": t["goalDifference"],
        }
        for t in total["table"]
    ]
