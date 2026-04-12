"""
Football API integrations - ported from src/lib/football-api.ts and src/lib/api-football.ts.
Uses football-data.org (free tier) as primary and api-football as fallback.
"""

from typing import Optional

import httpx

from app.config import get_settings

settings = get_settings()

# ---------- football-data.org (primary) ----------

FOOTBALL_DATA_BASE = "https://api.football-data.org/v4"
FOOTBALL_DATA_TEAMS = {"REAL_MADRID": 86, "BARCELONA": 81}
COMPETITION_IDS = {"LA_LIGA": "PD", "SEGUNDA": "SD"}

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


def _get_current_season() -> int:
    from datetime import datetime
    now = datetime.utcnow()
    return now.year - 1 if now.month < 7 else now.year


async def _fd_fetch_team_matches(client: httpx.AsyncClient, team_id: int) -> list[dict]:
    key = settings.FOOTBALL_DATA_KEY
    if not key:
        raise ValueError("FOOTBALL_DATA_KEY not configured")

    resp = await client.get(
        f"{FOOTBALL_DATA_BASE}/teams/{team_id}/matches",
        params={"status": "SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED"},
        headers={"X-Auth-Token": key},
    )
    resp.raise_for_status()
    data = resp.json()

    out = []
    for m in data.get("matches", []):
        season_year = int(m["season"]["startDate"][:4])
        out.append({
            "external_id": m["id"],
            "competition": m["competition"]["name"],
            "competition_logo": m["competition"].get("emblem"),
            "season": f"{season_year}/{season_year + 1}",
            "home_team": m["homeTeam"]["name"],
            "home_team_logo": m["homeTeam"].get("crest"),
            "away_team": m["awayTeam"]["name"],
            "away_team_logo": m["awayTeam"].get("crest"),
            "kickoff_utc": m["utcDate"],
            "venue": m.get("venue"),
            "status": STATUS_MAP_FD.get(m["status"], "SCHEDULED"),
            "home_score": m["score"]["fullTime"]["home"],
            "away_score": m["score"]["fullTime"]["away"],
            "home_score_halftime": m["score"]["halfTime"]["home"] if m["score"].get("halfTime") else None,
            "away_score_halftime": m["score"]["halfTime"]["away"] if m["score"].get("halfTime") else None,
        })
    return out


async def fetch_all_tracked_matches() -> list[dict]:
    """Fetch all Real Madrid and Barcelona matches, deduplicating El Clasico."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        rm = await _fd_fetch_team_matches(client, FOOTBALL_DATA_TEAMS["REAL_MADRID"])
        barca = await _fd_fetch_team_matches(client, FOOTBALL_DATA_TEAMS["BARCELONA"])

    match_map: dict[int, dict] = {}
    for m in rm + barca:
        if m["external_id"]:
            match_map[m["external_id"]] = m
    return list(match_map.values())


async def fetch_competition_matches(competition_id: str) -> list[dict]:
    key = settings.FOOTBALL_DATA_KEY
    if not key:
        raise ValueError("FOOTBALL_DATA_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{FOOTBALL_DATA_BASE}/competitions/{competition_id}/matches",
            headers={"X-Auth-Token": key},
        )
        resp.raise_for_status()
        data = resp.json()

    out = []
    for m in data.get("matches", []):
        season_year = int(m["season"]["startDate"][:4])
        out.append({
            "external_id": m["id"],
            "competition": m["competition"]["name"],
            "competition_logo": m["competition"].get("emblem"),
            "season": f"{season_year}/{season_year + 1}",
            "home_team": m["homeTeam"]["name"],
            "home_team_logo": m["homeTeam"].get("crest"),
            "away_team": m["awayTeam"]["name"],
            "away_team_logo": m["awayTeam"].get("crest"),
            "kickoff_utc": m["utcDate"],
            "venue": m.get("venue"),
            "status": STATUS_MAP_FD.get(m["status"], "SCHEDULED"),
            "home_score": m["score"]["fullTime"]["home"],
            "away_score": m["score"]["fullTime"]["away"],
            "home_score_halftime": m["score"]["halfTime"]["home"] if m["score"].get("halfTime") else None,
            "away_score_halftime": m["score"]["halfTime"]["away"] if m["score"].get("halfTime") else None,
        })
    return out


async def fetch_competition_standings(competition_id: str) -> list[dict]:
    key = settings.FOOTBALL_DATA_KEY
    if not key:
        raise ValueError("FOOTBALL_DATA_KEY not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{FOOTBALL_DATA_BASE}/competitions/{competition_id}/standings",
            headers={"X-Auth-Token": key},
        )
        resp.raise_for_status()
        data = resp.json()

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
