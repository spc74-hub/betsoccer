'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Standing, Season } from '@/types';
import { Loader2, Trophy, Target, Percent, Info, History, Plus, ChevronDown, ChevronUp, ChevronRight, Award, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showScoring, setShowScoring] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewSeason, setShowNewSeason] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [closing, setClosing] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
      }

      // Fetch standings
      const { data: standingsData } = await supabase
        .from('standings')
        .select('*')
        .order('total_points', { ascending: false });

      setStandings(standingsData || []);

      // Fetch seasons
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('*')
        .order('start_date', { ascending: false });

      if (seasonsData) {
        setSeasons(seasonsData);
        const active = seasonsData.find((s) => s.is_active);
        setActiveSeason(active || null);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const handleCloseSeason = async () => {
    if (!newSeasonName.trim()) return;

    setClosing(true);
    const supabase = createClient();

    const { data, error } = await supabase.rpc('close_season_and_start_new', {
      new_season_name: newSeasonName.trim(),
    });

    if (!error && data) {
      // Refresh page
      window.location.reload();
    } else {
      alert('Error al cerrar temporada: ' + (error?.message || 'Unknown error'));
    }

    setClosing(false);
  };

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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const toggleUserExpansion = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clasificacion</h1>
            <p className="text-gray-400 mt-1">
              {activeSeason ? activeSeason.name : 'Ranking de puntos'}
            </p>
          </div>
          <button
            onClick={() => setShowScoring(!showScoring)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <Info className="w-4 h-4" />
            Puntuacion
          </button>
        </div>

        {/* Scoring explanation */}
        {showScoring && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <h3 className="font-semibold text-white mb-3">Sistema de puntuacion</h3>
            <p className="text-sm text-gray-400 mb-3">
              Los puntos son <span className="text-green-400 font-medium">acumulativos</span>.
              Puedes conseguir hasta 10 puntos por partido si aciertas todo.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                <div>
                  <span className="text-white font-medium">Acertar ganador (1/X/2)</span>
                  <p className="text-xs text-gray-500">Predecir quien gana o empate</p>
                </div>
                <span className="text-green-400 font-bold">+1 punto</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                <div>
                  <span className="text-white font-medium">Resultado al descanso</span>
                  <p className="text-xs text-gray-500">Acertar el marcador del primer tiempo</p>
                </div>
                <span className="text-green-400 font-bold">+2 puntos</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                <div>
                  <span className="text-white font-medium">Diferencia de goles</span>
                  <p className="text-xs text-gray-500">Acertar la diferencia (ej: +1, -2, 0)</p>
                </div>
                <span className="text-green-400 font-bold">+3 puntos</span>
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                <div>
                  <span className="text-white font-medium">Resultado exacto</span>
                  <p className="text-xs text-gray-500">Acertar el marcador final exacto</p>
                </div>
                <span className="text-green-400 font-bold">+4 puntos</span>
              </div>
            </div>
            <div className="mt-3 p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
              <p className="text-sm text-indigo-300">
                <strong>Ejemplo:</strong> Si predices 2-1 y el resultado es 2-1:
                <br />
                Ganador (+1) + Diferencia (+3) + Exacto (+4) = <strong>8 puntos</strong>
                <br />
                Si ademas aciertas el descanso: <strong>10 puntos</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {standings.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Aun no hay clasificacion</p>
          <p className="text-gray-500 text-sm mt-1">
            Los puntos se calcularan cuando finalicen los partidos
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {standings.map((standing, index) => {
            const isExpanded = expandedUsers.has(standing.user_id);
            const hasBreakdown = standing.total_points > 0;

            return (
              <div key={standing.user_id}>
                <div
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border transition-all',
                    getRankStyle(index),
                    currentUserId === standing.user_id &&
                    'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-950',
                    hasBreakdown && 'cursor-pointer hover:brightness-110'
                  )}
                  onClick={() => hasBreakdown && toggleUserExpansion(standing.user_id)}
                >
                  {/* Expand indicator */}
                  {hasBreakdown && (
                    <div className="w-6 flex items-center justify-center">
                      <ChevronRight
                        className={cn(
                          'w-5 h-5 text-gray-400 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    </div>
                  )}

                  {/* Rank */}
                  <div className={cn(
                    'w-10 h-10 flex items-center justify-center text-xl font-bold',
                    !hasBreakdown && 'ml-6'
                  )}>
                    {getRankEmoji(index)}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {standing.display_name}
                      {currentUserId === standing.user_id && (
                        <span className="ml-2 text-xs text-indigo-400">(tu)</span>
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

                {/* Points Breakdown - Expandable */}
                {isExpanded && hasBreakdown && (
                  <div className="mt-2 ml-6 p-4 bg-gray-900/80 rounded-lg border border-gray-700/50">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      Desglose de puntos
                    </h4>
                    <div className="space-y-3">
                      {/* Winner points */}
                      {(standing.points_winner || 0) > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <Trophy className="w-3.5 h-3.5 text-green-400" />
                              Ganador (1/X/2)
                            </span>
                            <span className="text-green-400 font-medium">
                              {standing.points_winner} pts
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(standing.points_winner! / standing.total_points) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Halftime points */}
                      {(standing.points_halftime || 0) > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-blue-400" />
                              Resultado descanso
                            </span>
                            <span className="text-blue-400 font-medium">
                              {standing.points_halftime} pts
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(standing.points_halftime! / standing.total_points) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Difference points */}
                      {(standing.points_difference || 0) > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
                              Diferencia de goles
                            </span>
                            <span className="text-yellow-400 font-medium">
                              {standing.points_difference} pts
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500 rounded-full"
                              style={{ width: `${(standing.points_difference! / standing.total_points) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Exact points */}
                      {(standing.points_exact || 0) > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                              Resultado exacto
                            </span>
                            <span className="text-purple-400 font-medium">
                              {standing.points_exact} pts
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${(standing.points_exact! / standing.total_points) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
            <p className="text-sm text-gray-400">Puntos del lider</p>
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

      {/* Season management */}
      <div className="mt-8 space-y-4">
        {/* History toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center justify-between w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-white">Historial de temporadas</span>
          </div>
          {showHistory ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showHistory && (
          <div className="space-y-2 pl-4">
            {seasons.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No hay temporadas registradas</p>
            ) : (
              seasons.map((season) => (
                <SeasonCard
                  key={season.id}
                  season={season}
                />
              ))
            )}\n          </div>
        )}

        {/* New season button */}
        <button
          onClick={() => setShowNewSeason(!showNewSeason)}
          className="flex items-center justify-between w-full p-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5" />
            <span className="font-medium">Cerrar temporada y crear nueva</span>
          </div>
          {showNewSeason ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {showNewSeason && (
          <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 space-y-4">
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-400">
                <strong>Atencion:</strong> Esto cerrara la temporada actual, asignara un ganador
                y comenzara una nueva temporada con todos los puntos a cero.
              </p>
            </div>

            {activeSeason && (
              <div className="text-sm text-gray-400">
                <p>
                  Temporada actual: <strong className="text-white">{activeSeason.name}</strong>
                </p>
                {standings[0] && (
                  <p>
                    Ganador actual: <strong className="text-yellow-400">{standings[0].display_name}</strong>
                    {' '}con {standings[0].total_points} puntos
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Nombre de la nueva temporada
              </label>
              <input
                type="text"
                value={newSeasonName}
                onChange={(e) => setNewSeasonName(e.target.value)}
                placeholder="Ej: Temporada 2025/26"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleCloseSeason}
              disabled={!newSeasonName.trim() || closing}
              className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {closing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cerrando...
                </>
              ) : (
                'Cerrar temporada y crear nueva'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Season card component with expandable standings
function SeasonCard({ season }: { season: Season }) {
  const [expanded, setExpanded] = useState(false);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(false);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const loadStandings = async () => {
    if (standings.length > 0) return; // Already loaded

    setLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from('standings_by_season')
      .select('*')
      .eq('season_id', season.id)
      .gt('total_predictions', 0)
      .order('total_points', { ascending: false });

    setStandings(data || []);
    setLoading(false);
  };

  const handleToggle = async () => {
    if (!expanded) {
      await loadStandings();
    }
    setExpanded(!expanded);
  };

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        season.is_active
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-gray-900/50 border-gray-700'
      )}
    >
      <div
        className="p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{season.name}</span>
              {season.is_active && (
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                  Activa
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formatDate(season.start_date)}
              {season.end_date && ` - ${formatDate(season.end_date)}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {season.winner_user_id && !season.is_active && (
              <span className="text-sm text-yellow-400 font-medium">
                🏆 {season.winner_name}
              </span>
            )}
            <span className="text-gray-400">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700 p-3 bg-gray-950/50">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          ) : standings.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              No hay predicciones en esta temporada
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-2">Clasificación final:</p>
              {standings.map((standing, idx) => (
                <div
                  key={standing.user_id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded',
                    idx === 0 ? 'bg-yellow-500/10' : 'bg-gray-800/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-bold w-5',
                      idx === 0 ? 'text-yellow-400' : 'text-gray-400'
                    )}>
                      {idx === 0 ? '🥇' : `${idx + 1}.`}
                    </span>
                    <span className="text-sm text-white">{standing.display_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">
                      {standing.correct_predictions}/{standing.total_predictions}
                    </span>
                    <span className={cn(
                      'font-bold',
                      idx === 0 ? 'text-yellow-400' : 'text-white'
                    )}>
                      {standing.total_points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
