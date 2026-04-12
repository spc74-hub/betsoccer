'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch, getUser } from '@/lib/api';
import { Match, Prediction, TeamFilter as TeamFilterType, User, Season } from '@/types';
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
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamFilter, setTeamFilter] = useState<TeamFilterType>('all');

  const fetchData = useCallback(async () => {
    const currentUser = getUser();
    if (currentUser) {
      setCurrentUserId(currentUser.id);
      if (!selectedUserId) {
        setSelectedUserId(currentUser.id);
      }
    }

    try {
      // Fetch active season
      const seasons = await apiFetch<Season[]>('/api/standings/seasons');
      const activeSeason = seasons.find((s) => s.is_active);
      if (activeSeason) {
        setActiveSeasonId(activeSeason.id);
      }

      // Fetch all users
      const usersData = await apiFetch<User[]>('/api/users');
      setUsers(usersData);

      // Fetch matches
      let url = '/api/matches?status=upcoming';
      if (teamFilter !== 'all') {
        url += `&team=${teamFilter}`;
      }
      const matchesData = await apiFetch<Match[]>(url);

      // Fetch predictions for selected user
      const targetUserId = selectedUserId || currentUser?.id;
      if (targetUserId && matchesData.length > 0) {
        const matchIds = matchesData.map((m) => m.id).join(',');
        const predictionsData = await apiFetch<Prediction[]>(
          `/api/predictions?user_id=${targetUserId}&match_ids=${matchIds}`
        );
        const predictionsMap: Record<string, Prediction> = {};
        predictionsData.forEach((p) => {
          predictionsMap[p.match_id] = p;
        });
        setPredictions(predictionsMap);
      }

      setMatches(matchesData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }, [teamFilter, selectedUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUserChange = async (userId: string) => {
    setSelectedUserId(userId);
    setLoading(true);

    try {
      const matchIds = matches.map((m) => m.id).join(',');
      const predictionsData = await apiFetch<Prediction[]>(
        `/api/predictions?user_id=${userId}&match_ids=${matchIds}`
      );
      const predictionsMap: Record<string, Prediction> = {};
      predictionsData.forEach((p) => {
        predictionsMap[p.match_id] = p;
      });
      setPredictions(predictionsMap);
    } catch (err) {
      console.error('Error fetching predictions:', err);
    }
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

    try {
      const data = await apiFetch<Prediction>('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          home_score_halftime: homeScoreHalftime,
          away_score_halftime: awayScoreHalftime,
        }),
      });

      setPredictions((prev) => ({
        ...prev,
        [matchId]: data,
      }));
    } catch (err) {
      console.error('Error saving prediction:', err);
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
            <h1 className="text-2xl font-bold">Proximos partidos</h1>
            <p className="text-gray-400 mt-1">
              Haz tu pronostico antes de que empiece el partido
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
            <span className="text-sm text-gray-400">Editando pronosticos de:</span>
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
                  {user.id === currentUserId && ' (tu)'}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUser && selectedUserId !== currentUserId && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              Estas editando los pronosticos de <strong>{selectedUser.display_name}</strong>
            </p>
          </div>
        )}
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No hay partidos proximos</p>
          <p className="text-gray-500 text-sm mt-1">
            Los partidos se cargaran automaticamente
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
