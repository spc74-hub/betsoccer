'use client';

import { useState, useEffect } from 'react';
import { Match, Prediction } from '@/types';
import {
  formatMatchDate,
  formatMatchTime,
  isPredictionLocked,
  cn,
} from '@/lib/utils';
import { Clock, Lock, Check, X, Loader2, Trophy } from 'lucide-react';

interface WinnerInfo {
  name: string;
  points: number;
}

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  onSavePrediction: (
    matchId: string,
    homeScore: number,
    awayScore: number,
    homeScoreHalftime: number,
    awayScoreHalftime: number
  ) => Promise<void>;
  showResult?: boolean;
  winners?: WinnerInfo[];
}

export function MatchCard({
  match,
  prediction,
  onSavePrediction,
  showResult = false,
  winners,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState(prediction?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.away_score ?? 0);
  const [homeScoreHT, setHomeScoreHT] = useState(prediction?.home_score_halftime ?? 0);
  const [awayScoreHT, setAwayScoreHT] = useState(prediction?.away_score_halftime ?? 0);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when prediction prop changes
  useEffect(() => {
    setHomeScore(prediction?.home_score ?? 0);
    setAwayScore(prediction?.away_score ?? 0);
    setHomeScoreHT(prediction?.home_score_halftime ?? 0);
    setAwayScoreHT(prediction?.away_score_halftime ?? 0);
    setHasChanges(false);
  }, [prediction]);

  const isLocked = isPredictionLocked(match.kickoff_utc);
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';

  const checkChanges = (newHomeScore: number, newAwayScore: number, newHomeHT: number, newAwayHT: number) => {
    return (
      newHomeScore !== (prediction?.home_score ?? 0) ||
      newAwayScore !== (prediction?.away_score ?? 0) ||
      newHomeHT !== (prediction?.home_score_halftime ?? 0) ||
      newAwayHT !== (prediction?.away_score_halftime ?? 0)
    );
  };

  const handleScoreChange = (type: 'full' | 'half', team: 'home' | 'away', delta: number) => {
    if (isLocked) return;

    if (type === 'full') {
      if (team === 'home') {
        const newScore = Math.max(0, homeScore + delta);
        setHomeScore(newScore);
        setHasChanges(checkChanges(newScore, awayScore, homeScoreHT, awayScoreHT));
      } else {
        const newScore = Math.max(0, awayScore + delta);
        setAwayScore(newScore);
        setHasChanges(checkChanges(homeScore, newScore, homeScoreHT, awayScoreHT));
      }
    } else {
      if (team === 'home') {
        const newScore = Math.max(0, homeScoreHT + delta);
        setHomeScoreHT(newScore);
        setHasChanges(checkChanges(homeScore, awayScore, newScore, awayScoreHT));
      } else {
        const newScore = Math.max(0, awayScoreHT + delta);
        setAwayScoreHT(newScore);
        setHasChanges(checkChanges(homeScore, awayScore, homeScoreHT, newScore));
      }
    }
  };

  const handleSave = async () => {
    if (isLocked || !hasChanges) return;
    setSaving(true);
    try {
      await onSavePrediction(match.id, homeScore, awayScore, homeScoreHT, awayScoreHT);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  // Calculate total points from prediction
  const totalPoints = prediction?.points ?? 0;
  const hasPoints = isFinished && totalPoints > 0;

  return (
    <div
      className={cn(
        'bg-gray-800 rounded-xl p-4 border transition-all',
        isLive
          ? 'border-green-500 shadow-lg shadow-green-500/20'
          : 'border-gray-700',
        hasPoints && 'border-yellow-500 shadow-lg shadow-yellow-500/20'
      )}
    >
      {/* Competition & Time */}
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="flex items-center gap-2">
          {match.competition_logo && (
            <img
              src={match.competition_logo}
              alt={match.competition}
              className="w-5 h-5 rounded object-contain"
            />
          )}
          <span className="text-gray-400">{match.competition}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          {isLive ? (
            <span className="flex items-center gap-1 text-green-400 font-medium">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              EN VIVO
            </span>
          ) : isFinished ? (
            <span className="text-gray-500">Finalizado</span>
          ) : isLocked ? (
            <span className="flex items-center gap-1 text-orange-400">
              <Lock className="w-3 h-3" />
              Bloqueado
            </span>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              {formatMatchTime(match.kickoff_utc)}
            </>
          )}
        </div>
      </div>

      {/* Date */}
      <p className="text-xs text-gray-500 mb-4 capitalize">
        {formatMatchDate(match.kickoff_utc)}
      </p>

      {/* Teams & Score */}
      <div className="flex items-center justify-between gap-2">
        {/* Home Team */}
        <div className="flex-1 text-center min-w-0">
          <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            {match.home_team_logo && (
              <img
                src={match.home_team_logo}
                alt={match.home_team}
                className="w-12 h-12 object-contain"
              />
            )}
          </div>
          <p className="text-xs font-medium text-white truncate px-1">
            {match.home_team}
          </p>
        </div>

        {/* Score / Prediction */}
        <div className="flex flex-col items-center gap-3">
          {showResult && isFinished && (
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {match.home_score} - {match.away_score}
              </div>
              {match.home_score_halftime != null && match.away_score_halftime != null && (
                <div className="text-xs text-gray-500">
                  (Descanso: {match.home_score_halftime} - {match.away_score_halftime})
                </div>
              )}
            </div>
          )}

          {/* Final score prediction */}
          <div>
            <p className="text-xs text-gray-400 text-center mb-1">Final</p>
            <div className="flex items-center gap-2">
              <ScoreInput
                value={homeScore}
                onChange={(delta) => handleScoreChange('full', 'home', delta)}
                locked={isLocked}
                color="indigo"
              />
              <span className="text-gray-500 font-bold">-</span>
              <ScoreInput
                value={awayScore}
                onChange={(delta) => handleScoreChange('full', 'away', delta)}
                locked={isLocked}
                color="indigo"
              />
            </div>
          </div>

          {/* Halftime score prediction */}
          <div>
            <p className="text-xs text-gray-400 text-center mb-1">Descanso</p>
            <div className="flex items-center gap-2">
              <ScoreInput
                value={homeScoreHT}
                onChange={(delta) => handleScoreChange('half', 'home', delta)}
                locked={isLocked}
                color="purple"
                small
              />
              <span className="text-gray-500 font-bold text-sm">-</span>
              <ScoreInput
                value={awayScoreHT}
                onChange={(delta) => handleScoreChange('half', 'away', delta)}
                locked={isLocked}
                color="purple"
                small
              />
            </div>
          </div>

          {/* Points breakdown */}
          {isFinished && prediction && (
            <PointsBreakdown prediction={prediction} />
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center min-w-0">
          <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            {match.away_team_logo && (
              <img
                src={match.away_team_logo}
                alt={match.away_team}
                className="w-12 h-12 object-contain"
              />
            )}
          </div>
          <p className="text-xs font-medium text-white truncate px-1">
            {match.away_team}
          </p>
        </div>
      </div>

      {/* Save button */}
      {!isLocked && hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar pronóstico'
          )}
        </button>
      )}

      {/* Prediction saved indicator */}
      {!isLocked && prediction && !hasChanges && (
        <p className="text-center text-xs text-green-400 mt-3 flex items-center justify-center gap-1">
          <Check className="w-3 h-3" />
          Pronóstico guardado
        </p>
      )}

      {/* Winners section */}
      {isFinished && winners && winners.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-1 text-xs text-green-400 mb-2">
            <Trophy className="w-3 h-3" />
            <span className="font-medium">Puntuaciones:</span>
          </div>
          <div className="space-y-1">
            {winners.map((winner, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-green-500/10 rounded px-2 py-1"
              >
                <span className="text-green-400 font-medium">{winner.name}</span>
                <span className="text-green-300">+{winner.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Score input component
function ScoreInput({
  value,
  onChange,
  locked,
  color,
  small = false,
}: {
  value: number;
  onChange: (delta: number) => void;
  locked: boolean;
  color: 'indigo' | 'purple';
  small?: boolean;
}) {
  const bgColor = color === 'indigo' ? 'bg-indigo-600' : 'bg-purple-600';
  const lockedBg = 'bg-gray-700';

  return (
    <div className="flex flex-col items-center">
      {!locked && (
        <button
          onClick={() => onChange(1)}
          className={cn(
            'text-gray-400 hover:text-white leading-none',
            small ? 'text-sm' : 'text-lg'
          )}
        >
          +
        </button>
      )}
      <span
        className={cn(
          'flex items-center justify-center rounded-lg font-bold',
          locked ? `${lockedBg} text-gray-400` : `${bgColor} text-white`,
          small ? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'
        )}
      >
        {value}
      </span>
      {!locked && (
        <button
          onClick={() => onChange(-1)}
          className={cn(
            'text-gray-400 hover:text-white leading-none',
            small ? 'text-sm' : 'text-lg'
          )}
        >
          -
        </button>
      )}
    </div>
  );
}

// Points breakdown component
function PointsBreakdown({ prediction }: { prediction: Prediction }) {
  const points = [
    { label: 'Ganador', value: prediction.points_winner, max: 1 },
    { label: 'Descanso', value: prediction.points_halftime, max: 2 },
    { label: 'Diferencia', value: prediction.points_difference, max: 3 },
    { label: 'Exacto', value: prediction.points_exact, max: 4 },
  ];

  const total = prediction.points ?? 0;

  if (total === 0) {
    return (
      <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-500/20 text-red-400">
        <X className="w-3 h-3" />
        0 puntos
      </div>
    );
  }

  return (
    <div className="bg-green-500/10 rounded-lg p-2 w-full">
      <div className="grid grid-cols-2 gap-1 text-xs">
        {points.map(
          (p) =>
            p.value != null &&
            p.value > 0 && (
              <div key={p.label} className="flex items-center justify-between">
                <span className="text-gray-400">{p.label}</span>
                <span className="text-green-400 font-medium">+{p.value}</span>
              </div>
            )
        )}
      </div>
      <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-green-500/20">
        <Check className="w-3 h-3 text-green-400" />
        <span className="text-green-400 font-bold">{total} puntos</span>
      </div>
    </div>
  );
}
