"""
Points calculation logic - replaces Supabase triggers.

Sistema de puntuacion (acumulativo, max 10 por partido):
  +1 acertar el ganador (1/X/2)
  +4 acertar el resultado exacto
  y, segun la fecha del partido:
                       descanso   diferencia
  hasta el 2026-08-25     +2          +3      (reglas originales)
  desde el 2026-08-25     +3          +2      (acordado el 2026-08-23)

**El reparto depende de la fecha del partido, no es una constante global.** Tiene
que ser asi: `POST /api/admin/recalculate-points` recalcula TODAS las
predicciones de TODOS los partidos terminados desde cero. Con constantes globales,
la primera vez que alguien lo pulsara reescribiria la historia — cambiaria los
puntos ya obtenidos en partidos jugados e incluso las clasificaciones de
temporadas cerradas. Al depender de `kickoff_utc`, recalcular es idempotente:
cada partido se vuelve a puntuar con las reglas que estaban vigentes cuando se
jugo.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Match, Prediction

# Frontera entre los dos sistemas. Elegida entre el ultimo partido jugado con las
# reglas viejas (Elche-Barcelona, 2026-08-23 19:30 UTC) y el primero con las
# nuevas (Real Madrid-Real Sociedad, 2026-08-26 19:00 UTC).
SCORING_V2_FROM = datetime(2026, 8, 25, tzinfo=timezone.utc)

_REGLAS_V1 = {"halftime": 2, "difference": 3}
_REGLAS_V2 = {"halftime": 3, "difference": 2}


def reglas_para(kickoff: Optional[datetime]) -> dict:
    """Puntos vigentes para un partido segun cuando se juega.

    Sin fecha se asumen las reglas actuales: es lo que corresponde a un partido
    nuevo, y los caminos que puntuan de verdad siempre pasan el kickoff.
    """
    if kickoff is None:
        return _REGLAS_V2
    if kickoff.tzinfo is None:
        kickoff = kickoff.replace(tzinfo=timezone.utc)
    return _REGLAS_V2 if kickoff >= SCORING_V2_FROM else _REGLAS_V1


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
    kickoff: Optional[datetime] = None,
) -> dict:
    reglas = reglas_para(kickoff)
    p_winner = 1 if _winner(pred_home, pred_away) == _winner(match_home, match_away) else 0
    p_halftime = (
        reglas["halftime"] if (pred_home_ht == match_home_ht and pred_away_ht == match_away_ht) else 0
    )
    p_difference = (
        reglas["difference"] if (pred_home - pred_away) == (match_home - match_away) else 0
    )
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
            match.kickoff_utc,
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
                match.kickoff_utc,
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
