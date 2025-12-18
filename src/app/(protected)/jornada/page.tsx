'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction, User } from '@/types';
import { formatMatchDate, formatMatchTime, isPredictionLocked, cn } from '@/lib/utils';
import { Loader2, Clock, Lock, Check, Eye, EyeOff } from 'lucide-react';

interface MatchWithAllPredictions extends Match {
  predictions: Record<string, Prediction>;
}

export default function JornadaPage() {
  const [matches, setMatches] = useState<MatchWithAllPredictions[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // Fetch all users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('display_name');

      if (usersData) {
        setUsers(usersData);
      }

      // Fetch upcoming matches (next 2 for each team)
      const { data: matchesData } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['SCHEDULED', 'LIVE'])
        .order('kickoff_utc', { ascending: true })
        .limit(10);

      if (matchesData && matchesData.length > 0) {
        // Fetch all predictions for these matches
        const matchIds = matchesData.map((m) => m.id);
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .in('match_id', matchIds);

        // Group predictions by match
        const matchesWithPredictions: MatchWithAllPredictions[] = matchesData.map((match) => {
          const matchPredictions: Record<string, Prediction> = {};
          predictionsData?.forEach((p) => {
            if (p.match_id === match.id) {
              matchPredictions[p.user_id] = p;
            }
          });
          return {
            ...match,
            predictions: matchPredictions,
          };
        });

        setMatches(matchesWithPredictions);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Proxima Jornada</h1>
          <p className="text-gray-400 mt-1">
            Comparativa de pronosticos de todos los jugadores
          </p>
        </div>
        <button
          onClick={() => setShowHidden(!showHidden)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            showHidden
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          )}
        >
          {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showHidden ? 'Mostrando ocultos' : 'Mostrar antes de tiempo'}
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No hay partidos proximos</p>
        </div>
      ) : (
        <div className="space-y-6">
          {matches.map((match) => {
            const isLocked = isPredictionLocked(match.kickoff_utc);
            const canShowPredictions = isLocked || showHidden;

            return (
              <div
                key={match.id}
                className={cn(
                  'bg-gray-800 rounded-xl p-5 border transition-all',
                  match.status === 'LIVE'
                    ? 'border-green-500 shadow-lg shadow-green-500/20'
                    : 'border-gray-700'
                )}
              >
                {/* Match header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {match.competition_logo && (
                      <img
                        src={match.competition_logo}
                        alt={match.competition}
                        className="w-5 h-5 rounded object-contain"
                      />
                    )}
                    <span className="text-sm text-gray-400">{match.competition}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {match.status === 'LIVE' ? (
                      <span className="flex items-center gap-1 text-green-400 font-medium">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        EN VIVO
                      </span>
                    ) : isLocked ? (
                      <span className="flex items-center gap-1 text-orange-400">
                        <Lock className="w-3 h-3" />
                        Bloqueado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatMatchTime(match.kickoff_utc)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <p className="text-xs text-gray-500 mb-4 capitalize">
                  {formatMatchDate(match.kickoff_utc)}
                </p>

                {/* Teams */}
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <span className="text-white font-medium text-right">{match.home_team}</span>
                    {match.home_team_logo && (
                      <img
                        src={match.home_team_logo}
                        alt={match.home_team}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                  </div>
                  <span className="text-2xl font-bold text-gray-500">vs</span>
                  <div className="flex items-center gap-3 flex-1">
                    {match.away_team_logo && (
                      <img
                        src={match.away_team_logo}
                        alt={match.away_team}
                        className="w-10 h-10 object-contain"
                      />
                    )}
                    <span className="text-white font-medium">{match.away_team}</span>
                  </div>
                </div>

                {/* Predictions comparison */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Pronosticos</h3>
                  <div className="space-y-2">
                    {users.map((user) => {
                      const prediction = match.predictions[user.id];
                      const hasPrediction = !!prediction;

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg"
                        >
                          <span className="text-sm font-medium text-white">
                            {user.display_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {hasPrediction ? (
                              canShowPredictions ? (
                                <span className="flex items-center gap-2">
                                  <span className="bg-indigo-600 px-3 py-1 rounded text-white font-bold text-sm">
                                    {prediction.home_score} - {prediction.away_score}
                                  </span>
                                  <Check className="w-4 h-4 text-green-400" />
                                </span>
                              ) : (
                                <span className="flex items-center gap-2 text-green-400 text-sm">
                                  <Check className="w-4 h-4" />
                                  Listo
                                </span>
                              )
                            ) : (
                              <span className="text-yellow-400 text-sm flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hidden predictions warning */}
                {!isLocked && !showHidden && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Los pronosticos se mostraran cuando empiece el partido
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
