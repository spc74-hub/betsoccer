import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    avatar_url = Column(Text, nullable=True)
    hashed_password = Column(String, nullable=False)
    initial_points = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    predictions = relationship("Prediction", back_populates="user")


class Match(Base):
    __tablename__ = "matches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(Integer, unique=True, nullable=False)
    competition = Column(String, nullable=False)
    competition_logo = Column(Text, nullable=True)
    season = Column(String, nullable=False)
    home_team = Column(String, nullable=False)
    home_team_logo = Column(Text, nullable=True)
    away_team = Column(String, nullable=False)
    away_team_logo = Column(Text, nullable=True)
    kickoff_utc = Column(DateTime(timezone=True), nullable=False)
    venue = Column(Text, nullable=True)
    status = Column(
        String,
        nullable=False,
        default="SCHEDULED",
    )
    home_score = Column(Integer, nullable=True)
    away_score = Column(Integer, nullable=True)
    home_score_halftime = Column(Integer, nullable=True)
    away_score_halftime = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED')",
            name="ck_match_status",
        ),
    )

    predictions = relationship("Prediction", back_populates="match")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    season_id = Column(UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=True)
    home_score = Column(Integer, nullable=False)
    away_score = Column(Integer, nullable=False)
    home_score_halftime = Column(Integer, default=0)
    away_score_halftime = Column(Integer, default=0)
    points = Column(Integer, nullable=True)
    points_winner = Column(Integer, default=0)
    points_halftime = Column(Integer, default=0)
    points_difference = Column(Integer, default=0)
    points_exact = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "match_id", name="uq_user_match"),
        CheckConstraint("home_score >= 0", name="ck_pred_home_score"),
        CheckConstraint("away_score >= 0", name="ck_pred_away_score"),
    )

    user = relationship("User", back_populates="predictions")
    match = relationship("Match", back_populates="predictions")


class Season(Base):
    __tablename__ = "seasons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    winner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    winner_name = Column(String, nullable=True)
    winner_points = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
