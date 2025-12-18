'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Match, Prediction } from '@/types';
import {
  formatMatchDate,
  formatMatchTime,
  isPredictionLocked,
  cn,
} from '@/lib/utils';
import { Clock, Lock, Check, X, Loader2 } from 'lucide-react';

interface MatchCardProps {
  match: Match;
  prediction?: Prediction;
  onSavePrediction: (
    matchId: string,
    homeScore: number,
    awayScore: number
  ) => Promise<void>;
  showResult?: boolean;
}

export function MatchCard({
  match,
  prediction,
  onSavePrediction,
  showResult = false,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState(prediction?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(prediction?.away_score ?? 0);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isLocked = isPredictionLocked(match.kickoff_utc);
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';

  const handleScoreChange = (
    team: 'home' | 'away',
    delta: number
  ) => {
    if (isLocked) return;

    if (team === 'home') {
      const newScore = Math.max(0, homeScore + delta);
      setHomeScore(newScore);
      setHasChanges(
        newScore !== (prediction?.home_score ?? 0) ||
          awayScore !== (prediction?.away_score ?? 0)
      );
    } else {
      const newScore = Math.max(0, awayScore + delta);
      setAwayScore(newScore);
      setHasChanges(
        homeScore !== (prediction?.home_score ?? 0) ||
          newScore !== (prediction?.away_score ?? 0)
      );
    }
  };

  const handleSave = async () => {
    if (isLocked || !hasChanges) return;
    setSaving(true);
    try {
      await onSavePrediction(match.id, homeScore, awayScore);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const didWin =
    isFinished &&
    prediction?.points === 1;

  return (
    <div
      className={cn(
        'bg-gray-800 rounded-xl p-4 border transition-all',
        isLive
          ? 'border-green-500 shadow-lg shadow-green-500/20'
          : 'border-gray-700',
        didWin && 'border-yellow-500 shadow-lg shadow-yellow-500/20'
      )}
    >
      {/* Competition & Time */}
      <div className="flex items-center justify-between text-sm mb-3">
        <div className="flex items-center gap-2">
          {match.competition_logo && (
            <Image
              src={match.competition_logo}
              alt={match.competition}
              width={20}
              height={20}
              className="rounded"
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
              <Image
                src={match.home_team_logo}
                alt={match.home_team}
                width={48}
                height={48}
                className="object-contain max-w-full max-h-full"
              />
            )}
          </div>
          <p className="text-xs font-medium text-white truncate px-1">
            {match.home_team}
          </p>
        </div>

        {/* Score / Prediction */}
        <div className="flex flex-col items-center gap-2">
          {showResult && isFinished && (
            <div className="text-2xl font-bold text-white mb-1">
              {match.home_score} - {match.away_score}
            </div>
          )}

          {/* Prediction input */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              {!isLocked && (
                <button
                  onClick={() => handleScoreChange('home', 1)}
                  className="text-gray-400 hover:text-white text-lg leading-none"
                >
                  +
                </button>
              )}
              <span
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold',
                  isLocked
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-indigo-600 text-white'
                )}
              >
                {homeScore}
              </span>
              {!isLocked && (
                <button
                  onClick={() => handleScoreChange('home', -1)}
                  className="text-gray-400 hover:text-white text-lg leading-none"
                >
                  -
                </button>
              )}
            </div>
            <span className="text-gray-500 font-bold">-</span>
            <div className="flex flex-col items-center">
              {!isLocked && (
                <button
                  onClick={() => handleScoreChange('away', 1)}
                  className="text-gray-400 hover:text-white text-lg leading-none"
                >
                  +
                </button>
              )}
              <span
                className={cn(
                  'w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold',
                  isLocked
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-indigo-600 text-white'
                )}
              >
                {awayScore}
              </span>
              {!isLocked && (
                <button
                  onClick={() => handleScoreChange('away', -1)}
                  className="text-gray-400 hover:text-white text-lg leading-none"
                >
                  -
                </button>
              )}
            </div>
          </div>

          {/* Result indicator */}
          {isFinished && prediction && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
                didWin
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              )}
            >
              {didWin ? (
                <>
                  <Check className="w-3 h-3" />
                  +1 punto
                </>
              ) : (
                <>
                  <X className="w-3 h-3" />
                  Fallaste
                </>
              )}
            </div>
          )}
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center min-w-0">
          <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center">
            {match.away_team_logo && (
              <Image
                src={match.away_team_logo}
                alt={match.away_team}
                width={48}
                height={48}
                className="object-contain max-w-full max-h-full"
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
    </div>
  );
}
