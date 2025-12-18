'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Standing } from '@/types';
import { Loader2, Trophy, Target, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStandings() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
      }

      const { data } = await supabase
        .from('standings')
        .select('*')
        .order('total_points', { ascending: false });

      setStandings(data || []);
      setLoading(false);
    }

    fetchStandings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const getRankStyle = (index: number) => {
    if (index === 0) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (index === 1) return 'bg-gray-400/20 text-gray-300 border-gray-400/50';
    if (index === 2) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    return 'bg-gray-800 text-gray-400 border-gray-700';
  };

  const getRankEmoji = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Clasificación</h1>
        <p className="text-gray-400 mt-1">
          Ranking de puntos de la temporada actual
        </p>
      </div>

      {standings.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aún no hay clasificación</p>
          <p className="text-gray-500 text-sm mt-1">
            Los puntos se calcularán cuando finalicen los partidos
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {standings.map((standing, index) => (
            <div
              key={standing.user_id}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border transition-all',
                getRankStyle(index),
                currentUserId === standing.user_id &&
                  'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950'
              )}
            >
              {/* Rank */}
              <div className="w-10 h-10 flex items-center justify-center text-xl font-bold">
                {getRankEmoji(index)}
              </div>

              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {standing.display_name}
                  {currentUserId === standing.user_id && (
                    <span className="ml-2 text-xs text-indigo-400">(tú)</span>
                  )}
                </p>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {standing.correct_predictions}/{standing.total_predictions} aciertos
                  </span>
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    {standing.accuracy}%
                  </span>
                </div>
              </div>

              {/* Points */}
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {standing.total_points}
                </p>
                <p className="text-xs text-gray-400">puntos</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats summary */}
      {standings.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Total participantes</p>
            <p className="text-2xl font-bold text-white mt-1">
              {standings.length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Puntos del líder</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">
              {standings[0]?.total_points || 0}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Media de aciertos</p>
            <p className="text-2xl font-bold text-white mt-1">
              {standings.length > 0
                ? (
                    standings.reduce((acc, s) => acc + Number(s.accuracy), 0) /
                    standings.length
                  ).toFixed(1)
                : 0}
              %
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
