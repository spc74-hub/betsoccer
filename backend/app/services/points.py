"""
Points calculation logic - replaces Supabase triggers.

Scoring system (cumulative, max 10 per match):
  +1 for correct winner (1/X/2)
  +2 for correct halftime score
  +3 for correct goal difference
  +4 for exact result
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Match, Prediction


def _winner(home: int, away: int) -> int:
    """1 = home, 0 = draw, -1 = away"""
    if home > away:
        return 1
    elif home < away:
        return -1
    return 0


def calculate_points_for_prediction(
    pred_home: int,
    pred_away: int,
    pred_home_ht: int,
    pred_away_ht: int,
    match_home: int,
    match_away: int,
    match_home_ht: int,
    match_away_ht: int,
) -> dict:
    p_winner = 1 if _winner(pred_home, pred_away) == _winner(match_home, match_away) else 0
    p_halftime = 2 if (pred_home_ht == match_home_ht and pred_away_ht == match_away_ht) else 0
    p_difference = 3 if (pred_home - pred_away) == (match_home - match_away) else 0
    p_exact = 4 if (pred_home == match_home and pred_away == match_away) else 0
    total = p_winner + p_halftime + p_difference + p_exact

    return {
        "points": total,
        "points_winner": p_winner,
        "points_halftime": p_halftime,
        "points_difference": p_difference,
        "points_exact": p_exact,
    }


async def calculate_points_for_match(db: AsyncSession, match: Match):
    """Calculate points for all predictions of a finished match."""
    if match.status != "FINISHED" or match.home_score is None or match.away_score is None:
        return

    result = await db.execute(
        select(Prediction).where(Prediction.match_id == match.id)
    )
    predictions = result.scalars().all()

    m_home_ht = match.home_score_halftime or 0
    m_away_ht = match.away_score_halftime or 0

    for pred in predictions:
        pts = calculate_points_for_prediction(
            pred.home_score,
            pred.away_score,
            pred.home_score_halftime or 0,
            pred.away_score_halftime or 0,
            match.home_score,
            match.away_score,
            m_home_ht,
            m_away_ht,
        )
        pred.points = pts["points"]
        pred.points_winner = pts["points_winner"]
        pred.points_halftime = pts["points_halftime"]
        pred.points_difference = pts["points_difference"]
        pred.points_exact = pts["points_exact"]

    await db.commit()


async def recalculate_all_points(db: AsyncSession) -> list[dict]:
    """Recalculate all points for all finished matches (replaces RPC recalculate_all_points)."""
    result = await db.execute(
        select(Match).where(
            Match.status == "FINISHED",
            Match.home_score.isnot(None),
            Match.away_score.isnot(None),
        )
    )
    matches = result.scalars().all()

    results = []
    for match in matches:
        pred_result = await db.execute(
            select(Prediction).where(Prediction.match_id == match.id)
        )
        predictions = pred_result.scalars().all()

        m_home_ht = match.home_score_halftime or 0
        m_away_ht = match.away_score_halftime or 0
        count = 0

        for pred in predictions:
            pts = calculate_points_for_prediction(
                pred.home_score,
                pred.away_score,
                pred.home_score_halftime or 0,
                pred.away_score_halftime or 0,
                match.home_score,
                match.away_score,
                m_home_ht,
                m_away_ht,
            )
            pred.points = pts["points"]
            pred.points_winner = pts["points_winner"]
            pred.points_halftime = pts["points_halftime"]
            pred.points_difference = pts["points_difference"]
            pred.points_exact = pts["points_exact"]
            count += 1

        results.append({"match_id": str(match.id), "predictions_updated": count})

    await db.commit()
    return results
