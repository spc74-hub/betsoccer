"""Statistics derived from our own predictions - no external API involved.

Everything here is computed from `predictions` joined with `matches`. The data
set is small (a couple of hundred rows per season for a two-player league), so
we load it once and do the arithmetic in Python: it keeps the streak and
head-to-head logic readable, which raw SQL would not.
"""

from collections import Counter, defaultdict
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Match, Prediction, Season, User

# A match is only worth counting once it has been scored.
MAX_POINTS = 10


async def _scored_rows(db: AsyncSession, season_id: Optional[UUID]):
    """Scored predictions joined with their match, oldest first."""
    stmt = (
        select(Prediction, Match)
        .join(Match, Prediction.match_id == Match.id)
        .where(Prediction.points.isnot(None))
        .order_by(Match.kickoff_utc)
    )
    if season_id:
        stmt = stmt.where(Prediction.season_id == season_id)
    result = await db.execute(stmt)
    return result.all()


def _streaks(points_in_order: list[int]) -> tuple[int, int]:
    """(current, best) run of consecutive predictions that scored."""
    best = run = 0
    for p in points_in_order:
        run = run + 1 if p > 0 else 0
        best = max(best, run)
    current = 0
    for p in reversed(points_in_order):
        if p > 0:
            current += 1
        else:
            break
    return current, best


def _player_block(user: User, rows: list) -> dict:
    """Block A - how one player is doing."""
    points = [p.points or 0 for p, _ in rows]
    total = sum(points)
    n = len(points)
    scored = sum(1 for p in points if p > 0)
    current_streak, best_streak = _streaks(points)

    running = 0
    cumulative = []
    for pred, match in rows:
        running += pred.points or 0
        cumulative.append({
            "date": match.kickoff_utc.isoformat(),
            "label": f"{match.home_team} - {match.away_team}",
            "points": pred.points or 0,
            "total": running,
        })

    # Best and worst single call, so the page can name a match rather than a number.
    best_match = worst_match = None
    if rows:
        best_pred, best_m = max(rows, key=lambda r: r[0].points or 0)
        best_match = {
            "label": f"{best_m.home_team} - {best_m.away_team}",
            "points": best_pred.points or 0,
            "date": best_m.kickoff_utc.isoformat(),
        }
        # "Worst" is only interesting among matches actually predicted.
        worst_pred, worst_m = min(rows, key=lambda r: r[0].points or 0)
        worst_match = {
            "label": f"{worst_m.home_team} - {worst_m.away_team}",
            "points": worst_pred.points or 0,
            "date": worst_m.kickoff_utc.isoformat(),
        }

    # Best single day: matches are not tagged with a matchday, so we group by date.
    by_day: dict[str, int] = defaultdict(int)
    for pred, match in rows:
        by_day[match.kickoff_utc.date().isoformat()] += pred.points or 0
    best_day = None
    if by_day:
        day, pts = max(by_day.items(), key=lambda kv: kv[1])
        best_day = {"date": day, "points": pts}

    return {
        "user_id": str(user.id),
        "display_name": user.display_name,
        "total_points": total,
        "predictions": n,
        "avg_points": round(total / n, 2) if n else 0.0,
        "accuracy": round(scored / n * 100, 1) if n else 0.0,
        "perfect": sum(1 for p in points if p == MAX_POINTS),
        "blanks": sum(1 for p in points if p == 0),
        "breakdown": {
            "winner": sum(p.points_winner or 0 for p, _ in rows),
            "halftime": sum(p.points_halftime or 0 for p, _ in rows),
            "difference": sum(p.points_difference or 0 for p, _ in rows),
            "exact": sum(p.points_exact or 0 for p, _ in rows),
        },
        "hits": {
            "winner": sum(1 for p, _ in rows if (p.points_winner or 0) > 0),
            "halftime": sum(1 for p, _ in rows if (p.points_halftime or 0) > 0),
            "difference": sum(1 for p, _ in rows if (p.points_difference or 0) > 0),
            "exact": sum(1 for p, _ in rows if (p.points_exact or 0) > 0),
        },
        "current_streak": current_streak,
        "best_streak": best_streak,
        "best_match": best_match,
        "worst_match": worst_match,
        "best_day": best_day,
        "cumulative": cumulative,
    }


def _tendencies_block(user: User, rows: list) -> dict:
    """Block C - the habits a player cannot see from the standings."""
    scores = Counter(f"{p.home_score}-{p.away_score}" for p, _ in rows)
    most_common = scores.most_common(1)[0] if scores else None

    goals_pred = [(p.home_score + p.away_score) for p, _ in rows]
    goals_real = [
        (m.home_score + m.away_score)
        for _, m in rows
        if m.home_score is not None and m.away_score is not None
    ]

    # Average how far off the scoreline was, in goals.
    errors = [
        abs(p.home_score - m.home_score) + abs(p.away_score - m.away_score)
        for p, m in rows
        if m.home_score is not None and m.away_score is not None
    ]

    # Per-team performance, generic enough to also cover World Cup sides.
    per_team_points: dict[str, int] = defaultdict(int)
    per_team_count: dict[str, int] = defaultdict(int)
    for pred, match in rows:
        for team in (match.home_team, match.away_team):
            per_team_points[team] += pred.points or 0
            per_team_count[team] += 1
    by_team = [
        {
            "team": team,
            "predictions": per_team_count[team],
            "points": per_team_points[team],
            "avg_points": round(per_team_points[team] / per_team_count[team], 2),
        }
        for team in per_team_count
        if per_team_count[team] >= 3
    ]
    by_team.sort(key=lambda t: (-t["avg_points"], -t["predictions"]))

    n = len(rows)
    return {
        "user_id": str(user.id),
        "display_name": user.display_name,
        "favourite_score": (
            {"score": most_common[0], "count": most_common[1]} if most_common else None
        ),
        "avg_goals_predicted": round(sum(goals_pred) / len(goals_pred), 2) if goals_pred else 0.0,
        "avg_goals_real": round(sum(goals_real) / len(goals_real), 2) if goals_real else 0.0,
        "avg_goal_error": round(sum(errors) / len(errors), 2) if errors else 0.0,
        "winner_accuracy": (
            round(sum(1 for p, _ in rows if (p.points_winner or 0) > 0) / n * 100, 1)
            if n else 0.0
        ),
        "halftime_accuracy": (
            round(sum(1 for p, _ in rows if (p.points_halftime or 0) > 0) / n * 100, 1)
            if n else 0.0
        ),
        "by_team": by_team[:6],
    }


def _head_to_head(players: list[dict], rows_by_user: dict, users_by_id: dict) -> Optional[dict]:
    """Block B - the duel. Uses the top two players when there are more."""
    if len(players) < 2:
        return None
    a_id, b_id = players[0]["user_id"], players[1]["user_id"]
    a_rows = {str(m.id): p for p, m in rows_by_user.get(a_id, [])}
    b_rows = {str(m.id): p for p, m in rows_by_user.get(b_id, [])}
    shared = set(a_rows) & set(b_rows)
    if not shared:
        return None

    # Order shared matches chronologically for the running-difference chart.
    match_dates = {
        str(m.id): m
        for _, m in rows_by_user.get(a_id, [])
    }
    ordered = sorted(shared, key=lambda mid: match_dates[mid].kickoff_utc)

    a_wins = b_wins = draws = both_exact = both_blank = 0
    running = 0
    timeline = []
    for mid in ordered:
        pa, pb = a_rows[mid].points or 0, b_rows[mid].points or 0
        if pa > pb:
            a_wins += 1
        elif pb > pa:
            b_wins += 1
        else:
            draws += 1
        if (a_rows[mid].points_exact or 0) > 0 and (b_rows[mid].points_exact or 0) > 0:
            both_exact += 1
        if pa == 0 and pb == 0:
            both_blank += 1
        running += pa - pb
        m = match_dates[mid]
        timeline.append({
            "date": m.kickoff_utc.isoformat(),
            "label": f"{m.home_team} - {m.away_team}",
            "diff": running,
        })

    return {
        "player_a": {"user_id": a_id, "display_name": users_by_id[a_id].display_name},
        "player_b": {"user_id": b_id, "display_name": users_by_id[b_id].display_name},
        "shared_matches": len(shared),
        "a_wins": a_wins,
        "b_wins": b_wins,
        "draws": draws,
        "both_exact": both_exact,
        "both_blank": both_blank,
        "timeline": timeline,
    }


async def _records_block(db: AsyncSession) -> dict:
    """Block D - all-time records, deliberately across every season."""
    all_rows = await _scored_rows(db, season_id=None)
    users = {str(u.id): u for u in (await db.execute(select(User))).scalars().all()}

    best_single = None
    if all_rows:
        pred, match = max(all_rows, key=lambda r: r[0].points or 0)
        best_single = {
            "player": users[str(pred.user_id)].display_name if str(pred.user_id) in users else "?",
            "label": f"{match.home_team} - {match.away_team}",
            "result": f"{match.home_score}-{match.away_score}",
            "points": pred.points or 0,
            "date": match.kickoff_utc.isoformat(),
        }

    # Per-match aggregates: which games fooled everyone, and which were a gift.
    per_match: dict[str, dict] = defaultdict(lambda: {"points": [], "match": None})
    for pred, match in all_rows:
        entry = per_match[str(match.id)]
        entry["points"].append(pred.points or 0)
        entry["match"] = match

    contested = [e for e in per_match.values() if len(e["points"]) >= 2]
    hardest = easiest = None
    if contested:
        h = min(contested, key=lambda e: sum(e["points"]) / len(e["points"]))
        e_ = max(contested, key=lambda e: sum(e["points"]) / len(e["points"]))
        hardest = {
            "label": f"{h['match'].home_team} - {h['match'].away_team}",
            "result": f"{h['match'].home_score}-{h['match'].away_score}",
            "avg_points": round(sum(h["points"]) / len(h["points"]), 2),
            "date": h["match"].kickoff_utc.isoformat(),
        }
        easiest = {
            "label": f"{e_['match'].home_team} - {e_['match'].away_team}",
            "result": f"{e_['match'].home_score}-{e_['match'].away_score}",
            "avg_points": round(sum(e_["points"]) / len(e_["points"]), 2),
            "date": e_["match"].kickoff_utc.isoformat(),
        }

    # Best single day by a single player.
    by_player_day: dict[tuple, int] = defaultdict(int)
    for pred, match in all_rows:
        by_player_day[(str(pred.user_id), match.kickoff_utc.date().isoformat())] += pred.points or 0
    best_day = None
    if by_player_day:
        (uid, day), pts = max(by_player_day.items(), key=lambda kv: kv[1])
        best_day = {
            "player": users[uid].display_name if uid in users else "?",
            "date": day,
            "points": pts,
        }

    seasons = (
        await db.execute(select(Season).order_by(Season.start_date.desc()))
    ).scalars().all()
    palmares = [
        {
            "name": s.name,
            "winner_name": s.winner_name,
            "winner_points": s.winner_points,
            "is_active": s.is_active,
            "start_date": s.start_date.isoformat() if s.start_date else None,
            "end_date": s.end_date.isoformat() if s.end_date else None,
        }
        for s in seasons
    ]

    titles = Counter(s.winner_name for s in seasons if s.winner_name)

    return {
        "seasons": palmares,
        "titles": [{"player": name, "count": n} for name, n in titles.most_common()],
        "best_single": best_single,
        "best_day": best_day,
        "hardest_match": hardest,
        "easiest_match": easiest,
        "total_predictions": len(all_rows),
    }


async def get_stats(db: AsyncSession, season_id: Optional[UUID] = None) -> dict:
    """The whole /stats payload: blocks A-D in one round trip."""
    if season_id is None:
        active = (
            await db.execute(select(Season).where(Season.is_active == True))
        ).scalar_one_or_none()
        season_id = active.id if active else None
        season = active
    else:
        season = (
            await db.execute(select(Season).where(Season.id == season_id))
        ).scalar_one_or_none()

    users = (await db.execute(select(User))).scalars().all()
    users_by_id = {str(u.id): u for u in users}

    rows = await _scored_rows(db, season_id)
    rows_by_user: dict[str, list] = defaultdict(list)
    for pred, match in rows:
        rows_by_user[str(pred.user_id)].append((pred, match))

    players = [
        _player_block(u, rows_by_user.get(str(u.id), []))
        for u in users
        if rows_by_user.get(str(u.id))
    ]
    players.sort(key=lambda p: -p["total_points"])

    tendencies = [
        _tendencies_block(users_by_id[p["user_id"]], rows_by_user[p["user_id"]])
        for p in players
    ]

    return {
        "season": (
            {"id": str(season.id), "name": season.name, "is_active": season.is_active}
            if season else None
        ),
        "players": players,
        "head_to_head": _head_to_head(players, rows_by_user, users_by_id),
        "tendencies": tendencies,
        "records": await _records_block(db),
    }
