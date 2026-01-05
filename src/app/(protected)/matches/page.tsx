'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Match, Prediction, TeamFilter as TeamFilterType, User } from '@/types';
import { MatchCard } from '@/components/MatchCard';
import { TeamFilter } from '@/components/TeamFilter';
import { Loader2, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilterType>('all');

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);
      if (!selectedUserId) {
        setSelectedUserId(user.id);
      }
    }

    // Fetch all users
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
      .order('display_name');

    if (usersData) {
      setUsers(usersData);
    }

    // Fetch matches
    let matchQuery = supabase
      .from('matches')
      .select('*')
      .in('status', ['SCHEDULED', 'LIVE'])
      .order('kickoff_utc', { ascending: true });

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

    // Fetch predictions for selected user
    if (selectedUserId && matchesData) {
      const matchIds = matchesData.map((m) => m.id);
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', selectedUserId)
        .in('match_id', matchIds);

      const predictionsMap: Record<string, Prediction> = {};
      predictionsData?.forEach((p) => {
        predictionsMap[p.match_id] = p;
      });
      setPredictions(predictionsMap);
    }

    setMatches(matchesData || []);
    setLoading(false);
  }, [teamFilter, selectedUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUserChange = async (userId: string) => {
    setSelectedUserId(userId);
    setLoading(true);

    const supabase = createClient();
    const matchIds = matches.map((m) => m.id);

    const { data: predictionsData } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .in('match_id', matchIds);

    const predictionsMap: Record<string, Prediction> = {};
    predictionsData?.forEach((p) => {
      predictionsMap[p.match_id] = p;
    });
    setPredictions(predictionsMap);
    setLoading(false);
  };

  const handleSavePrediction = async (
    matchId: string,
    homeScore: number,
    awayScore: number,
    homeScoreHalftime: number,
    awayScoreHalftime: number
  ) => {
    if (!selectedUserId) return;

    const supabase = createClient();

    const { data, error } = await supabase
      .from('predictions')
      .upsert(
        {
          user_id: selectedUserId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          home_score_halftime: homeScoreHalftime,
          away_score_halftime: awayScoreHalftime,
        },
        { onConflict: 'user_id,match_id' }
      )
      .select()
      .single();

    if (!error && data) {
      setPredictions((prev) => ({
        ...prev,
        [matchId]: data,
      }));
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  if (loading && matches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Próximos partidos</h1>
            <p className="text-gray-400 mt-1">
              Haz tu pronóstico antes de que empiece el partido
            </p>
          </div>
          <div className="flex items-center gap-4">
            <TeamFilter value={teamFilter} onChange={setTeamFilter} />
            <button
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* User selector */}
        {users.length > 1 && (
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <Users className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-400">Editando pronósticos de:</span>
            <div className="flex gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserChange(user.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    selectedUserId === user.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  {user.display_name}
                  {user.id === currentUserId && ' (tú)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUser && selectedUserId !== currentUserId && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              Estás editando los pronósticos de <strong>{selectedUser.display_name}</strong>
            </p>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No hay partidos próximos</p>
          <p className="text-gray-500 text-sm mt-1">
            Los partidos se cargarán automáticamente
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id]}
              onSavePrediction={handleSavePrediction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
