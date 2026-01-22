'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction, User } from '@/types';
import { formatMatchDate, formatMatchTime, isPredictionLocked, cn } from '@/lib/utils';
import { Loader2, Clock, Lock, Check, RefreshCw, X, Trophy } from 'lucide-react';

interface MatchWithAllPredictions extends Match {
  predictions: Record<string, Prediction>;
}

export default function JornadaPage() {
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithAllPredictions[]>([]);
  const [finishedMatches, setFinishedMatches] = useState<MatchWithAllPredictions[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setSyncResult({
          success: true,
          message: `Sincronizado: ${data.stats.updated} actualizados, ${data.stats.created} nuevos`,
        });
        // Refresh the page data
        window.location.reload();
      } else {
        setSyncResult({ success: false, message: data.error || 'Error al sincronizar' });
      }
    } catch {
      setSyncResult({ success: false, message: 'Error de conexion' });
    } finally {
      setSyncing(false);
    }
  };

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

      // Fetch upcoming matches
      const { data: upcomingData } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['SCHEDULED', 'LIVE'])
        .order('kickoff_utc', { ascending: true })
        .limit(10);

      // Fetch recently finished matches (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: finishedData } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FINISHED')
        .gte('kickoff_utc', sevenDaysAgo.toISOString())
        .order('kickoff_utc', { ascending: false })
        .limit(10);

      const allMatches = [...(upcomingData || []), ...(finishedData || [])];

      if (allMatches.length > 0) {
        // Fetch all predictions for these matches
        const matchIds = allMatches.map((m) => m.id);
        const { data: predictionsData } = await supabase
          .from('predictions')
          .select('*')
          .in('match_id', matchIds);

        // Process upcoming matches
        const upcoming: MatchWithAllPredictions[] = (upcomingData || []).map((match) => {
          const matchPredictions: Record<string, Prediction> = {};
          predictionsData?.forEach((p) => {
            if (p.match_id === match.id) {
              matchPredictions[p.user_id] = p;
            }
          });
          return { ...match, predictions: matchPredictions };
        });

        // Process finished matches
        const finished: MatchWithAllPredictions[] = (finishedData || []).map((match) => {
          const matchPredictions: Record<string, Prediction> = {};
          predictionsData?.forEach((p) => {
            if (p.match_id === match.id) {
              matchPredictions[p.user_id] = p;
            }
          });
          return { ...match, predictions: matchPredictions };
        });

        setUpcomingMatches(upcoming);
        setFinishedMatches(finished);
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

  // Helper to get total points
  const getTotalPoints = (prediction: Prediction): number => {
    return (prediction.points_winner ?? 0) +
           (prediction.points_halftime ?? 0) +
           (prediction.points_difference ?? 0) +
           (prediction.points_exact ?? 0);
  };

  return (
    <div>
      {/* Header with sync button */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Jornada</h1>
          <p className="text-gray-400 mt-1">
            Comparativa de pronosticos de todos los jugadores
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', syncing && 'animate-spin')} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      {/* Sync result message */}
      {syncResult && (
        <div
          className={cn(
            'mb-6 p-3 rounded-lg flex items-center justify-between',
            syncResult.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          )}
        >
          <span>{syncResult.message}</span>
          <button onClick={() => setSyncResult(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upcoming matches section */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Proximos partidos
        </h2>
        {upcomingMatches.length === 0 ? (
          <div className="text-center py-8 bg-gray-800/50 rounded-xl">
            <p className="text-gray-400">No hay partidos proximos</p>
          </div>
        ) : (
          <div className="space-y-6">
            {upcomingMatches.map((match) => {
              const isLocked = isPredictionLocked(match.kickoff_utc);

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
                                <span className="flex items-center gap-2">
                                  <span className="bg-purple-600 px-2 py-1 rounded text-white font-medium text-xs" title="Descanso">
                                    {prediction.home_score_halftime ?? 0} - {prediction.away_score_halftime ?? 0}
                                  </span>
                                  <span className="bg-indigo-600 px-3 py-1 rounded text-white font-bold text-sm" title="Final">
                                    {prediction.home_score} - {prediction.away_score}
                                  </span>
                                  <Check className="w-4 h-4 text-green-400" />
                                </span>
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Finished matches section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Partidos finalizados
        </h2>
        {finishedMatches.length === 0 ? (
          <div className="text-center py-8 bg-gray-800/50 rounded-xl">
            <p className="text-gray-400">No hay partidos finalizados recientes</p>
          </div>
        ) : (
          <div className="space-y-6">
            {finishedMatches.map((match) => (
              <div
                key={match.id}
                className="bg-gray-800/70 rounded-xl p-5 border border-gray-700"
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
                  <span className="text-sm text-gray-500">Finalizado</span>
                </div>

                {/* Date */}
                <p className="text-xs text-gray-500 mb-4 capitalize">
                  {formatMatchDate(match.kickoff_utc)}
                </p>

                {/* Teams with result */}
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
                  <div className="text-center">
                    {match.home_score_halftime !== null && match.away_score_halftime !== null && (
                      <div className="text-xs text-gray-500 mb-1">
                        (Descanso: {match.home_score_halftime} - {match.away_score_halftime})
                      </div>
                    )}
                    <div className="bg-gray-700 px-4 py-2 rounded-lg">
                      <span className="text-2xl font-bold text-white">
                        {match.home_score} - {match.away_score}
                      </span>
                    </div>
                  </div>
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

                {/* Predictions with results */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Resultados</h3>
                  <div className="space-y-3">
                    {users.map((user) => {
                      const prediction = match.predictions[user.id];
                      const hasPrediction = !!prediction;
                      const totalPoints = hasPrediction ? getTotalPoints(prediction) : 0;
                      const hasPoints = totalPoints > 0;

                      // Calculate what user got right/wrong
                      const getWinnerType = (home: number, away: number) => home > away ? '1' : home < away ? '2' : 'X';
                      const matchWinner = match.home_score != null && match.away_score != null
                        ? getWinnerType(match.home_score as number, match.away_score as number) : null;
                      const predWinner = hasPrediction
                        ? getWinnerType(prediction.home_score, prediction.away_score) : null;
                      const matchDiff = match.home_score != null && match.away_score != null
                        ? (match.home_score as number) - (match.away_score as number) : null;
                      const predDiff = hasPrediction
                        ? prediction.home_score - prediction.away_score : null;

                      return (
                        <div
                          key={user.id}
                          className={cn(
                            'py-3 px-3 rounded-lg',
                            hasPoints
                              ? 'bg-green-900/30 border border-green-700'
                              : 'bg-gray-900/50'
                          )}
                        >
                          {/* Header with name and total points */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {user.display_name}
                              </span>
                              {hasPoints && (
                                <span className="bg-green-600 text-xs px-2 py-0.5 rounded font-bold">
                                  +{totalPoints} pts
                                </span>
                              )}
                            </div>
                            {hasPrediction && (
                              <div className="flex items-center gap-2">
                                <span className="bg-purple-600/80 px-2 py-1 rounded text-white font-medium text-xs">
                                  {prediction.home_score_halftime ?? 0} - {prediction.away_score_halftime ?? 0}
                                </span>
                                <span className="bg-indigo-600 px-2 py-1 rounded text-white font-bold text-sm">
                                  {prediction.home_score} - {prediction.away_score}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Points breakdown */}
                          {hasPrediction ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px]">
                              <div className={cn(
                                'px-2 py-1 rounded flex items-center justify-between',
                                prediction.points_winner ? 'bg-blue-600/30 text-blue-300' : 'bg-gray-800/50 text-gray-500'
                              )}>
                                <span>1X2: {predWinner}</span>
                                <span>{prediction.points_winner ? '+1' : matchWinner !== predWinner ? `(${matchWinner})` : ''}</span>
                              </div>
                              <div className={cn(
                                'px-2 py-1 rounded flex items-center justify-between',
                                prediction.points_halftime ? 'bg-purple-600/30 text-purple-300' : 'bg-gray-800/50 text-gray-500'
                              )}>
                                <span>HT: {prediction.home_score_halftime ?? 0}-{prediction.away_score_halftime ?? 0}</span>
                                <span>{prediction.points_halftime ? '+2' : `(${match.home_score_halftime ?? '?'}-${match.away_score_halftime ?? '?'})`}</span>
                              </div>
                              <div className={cn(
                                'px-2 py-1 rounded flex items-center justify-between',
                                prediction.points_difference ? 'bg-orange-600/30 text-orange-300' : 'bg-gray-800/50 text-gray-500'
                              )}>
                                <span>DIF: {predDiff !== null ? (predDiff > 0 ? `+${predDiff}` : predDiff) : '?'}</span>
                                <span>{prediction.points_difference ? '+3' : matchDiff !== null ? `(${matchDiff > 0 ? `+${matchDiff}` : matchDiff})` : ''}</span>
                              </div>
                              <div className={cn(
                                'px-2 py-1 rounded flex items-center justify-between',
                                prediction.points_exact ? 'bg-green-600/30 text-green-300' : 'bg-gray-800/50 text-gray-500'
                              )}>
                                <span>EXACTO</span>
                                <span>{prediction.points_exact ? '+4' : '✗'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs">Sin pronóstico</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
