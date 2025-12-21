'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction, TeamFilter as TeamFilterType, User } from '@/types';
import { MatchCard } from '@/components/MatchCard';
import { TeamFilter } from '@/components/TeamFilter';
import { Loader2, History } from 'lucide-react';

interface WinnerInfo {
  name: string;
  score: string;
}

export default function HistoryPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [winners, setWinners] = useState<Record<string, WinnerInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilterType>('all');

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Fetch all users first
    const { data: usersData } = await supabase
      .from('users')
      .select('*');

    const usersMap: Record<string, User> = {};
    usersData?.forEach((u) => {
      usersMap[u.id] = u;
    });

    // Fetch finished matches
    let matchQuery = supabase
      .from('matches')
      .select('*')
      .eq('status', 'FINISHED')
      .order('kickoff_utc', { ascending: false })
      .limit(50);

    if (teamFilter === 'real-madrid') {
      matchQuery = matchQuery.or(
        'home_team.ilike.%Real Madrid%,away_team.ilike.%Real Madrid%'
      );
    } else if (teamFilter === 'barcelona') {
      matchQuery = matchQuery.or(
        'home_team.ilike.%Barcelona%,away_team.ilike.%Barcelona%'
      );
    }

    const { data: matchesData } = await matchQuery;

    // Fetch user predictions
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && matchesData) {
      const matchIds = matchesData.map((m) => m.id);

      // Fetch current user's predictions
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .in('match_id', matchIds);

      const predictionsMap: Record<string, Prediction> = {};
      predictionsData?.forEach((p) => {
        predictionsMap[p.match_id] = p;
      });
      setPredictions(predictionsMap);

      // Fetch ALL predictions with points = 1 to find winners
      const { data: allWinningPredictions } = await supabase
        .from('predictions')
        .select('*')
        .in('match_id', matchIds)
        .eq('points', 1);

      // Build winners map
      const winnersMap: Record<string, WinnerInfo[]> = {};
      allWinningPredictions?.forEach((p) => {
        const userName = usersMap[p.user_id]?.display_name || 'Usuario';
        if (!winnersMap[p.match_id]) {
          winnersMap[p.match_id] = [];
        }
        winnersMap[p.match_id].push({
          name: userName,
          score: `${p.home_score} - ${p.away_score}`,
        });
      });
      setWinners(winnersMap);
    }

    setMatches(matchesData || []);
    setLoading(false);
  }, [teamFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const predictedMatches = Object.keys(predictions).length;
  const correctPredictions = Object.values(predictions).filter(
    (p) => p.points === 1
  ).length;
  const accuracy =
    predictedMatches > 0
      ? ((correctPredictions / predictedMatches) * 100).toFixed(1)
      : 0;

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
          <h1 className="text-2xl font-bold">Historial</h1>
          <p className="text-gray-400 mt-1">
            Revisa tus pronósticos pasados y resultados
          </p>
        </div>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {/* Personal stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-sm text-gray-400">Partidos pronosticados</p>
          <p className="text-2xl font-bold text-white mt-1">{predictedMatches}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-sm text-gray-400">Aciertos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">
            {correctPredictions}
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <p className="text-sm text-gray-400">Precisión</p>
          <p className="text-2xl font-bold text-white mt-1">{accuracy}%</p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No hay partidos finalizados</p>
          <p className="text-gray-500 text-sm mt-1">
            Aquí aparecerán los resultados de los partidos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id]}
              onSavePrediction={async () => {}}
              showResult
              winners={winners[match.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
