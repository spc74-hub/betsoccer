from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ---------- User ----------
class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Match ----------
class MatchOut(BaseModel):
    id: UUID
    external_id: int
    competition: str
    competition_logo: Optional[str] = None
    season: str
    home_team: str
    home_team_logo: Optional[str] = None
    away_team: str
    away_team_logo: Optional[str] = None
    kickoff_utc: datetime
    venue: Optional[str] = None
    status: str
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    home_score_halftime: Optional[int] = None
    away_score_halftime: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Prediction ----------
class PredictionCreate(BaseModel):
    match_id: UUID
    home_score: int
    away_score: int
    home_score_halftime: int = 0
    away_score_halftime: int = 0
    # NOTE: no user_id here — a prediction is always saved for the authenticated
    # user (server-side), never one supplied by the client (avoids impersonation).


class PredictionOut(BaseModel):
    id: UUID
    user_id: UUID
    match_id: UUID
    season_id: Optional[UUID] = None
    home_score: int
    away_score: int
    home_score_halftime: Optional[int] = 0
    away_score_halftime: Optional[int] = 0
    points: Optional[int] = None
    points_winner: Optional[int] = 0
    points_halftime: Optional[int] = 0
    points_difference: Optional[int] = 0
    points_exact: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PredictionWithMatch(PredictionOut):
    match: Optional[MatchOut] = None


class PredictionWithUser(PredictionOut):
    user: Optional[UserOut] = None


# ---------- Standing ----------
class StandingOut(BaseModel):
    user_id: UUID
    display_name: str
    avatar_url: Optional[str] = None
    total_points: int
    total_predictions: int
    correct_predictions: int
    accuracy: float
    points_winner: Optional[int] = 0
    points_halftime: Optional[int] = 0
    points_difference: Optional[int] = 0
    points_exact: Optional[int] = 0


# ---------- Season ----------
class SeasonOut(BaseModel):
    id: UUID
    name: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool
    winner_user_id: Optional[UUID] = None
    winner_name: Optional[str] = None
    winner_points: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CloseSeasonRequest(BaseModel):
    new_season_name: str


class CloseSeasonResponse(BaseModel):
    closed_season_id: UUID
    winner_id: Optional[UUID] = None
    winner_name: Optional[str] = None
    winner_points: int
    new_season_id: UUID
    new_season_name: str


# ---------- Sync ----------
class SyncStats(BaseModel):
    total: int
    created: int
    updated: int
    errors: int
    timestamp: str


class SyncResponse(BaseModel):
    success: bool
    message: str
    stats: SyncStats
