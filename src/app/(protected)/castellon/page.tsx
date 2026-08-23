'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Trophy, Calendar, RefreshCw, AlertTriangle } from 'lucide-react';

// Vista personal del CD Castellon. No tiene nada que ver con las apuestas: no
// hay pronosticos ni puntos, es solo consulta. El backend la limita al usuario
// administrador, asi que el resto del grupo ni ve el enlace ni puede llamarla.

interface CastellonMatch {
  id: number;
  utc_time: string | null;
  home: { id: number; name: string };
  away: { id: number; name: string };
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
}

interface Quota {
  used: number;
  budget: number;
}

interface TeamRow {
  position: number;
  team_id: number;
  name: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals: string;
  points: number;
  is_castellon: boolean;
}

type ViewMode = 'matches' | 'standings';

const CASTELLON_ID = 10279;

function formatKickoff(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MatchRow({ match }: { match: CastellonMatch }) {
  const local = match.home.id === CASTELLON_ID;
  const golesFavor = local ? match.home_score : match.away_score;
  const golesContra = local ? match.away_score : match.home_score;
  const resultado = !match.finished
    ? null
    : golesFavor! > golesContra!
    ? 'win'
    : golesFavor! < golesContra!
    ? 'loss'
    : 'draw';

  return (
    <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3">
      <div
        className={cn(
          'w-1.5 h-10 rounded-full shrink-0',
          resultado === 'win' && 'bg-green-500',
          resultado === 'loss' && 'bg-red-500',
          resultado === 'draw' && 'bg-gray-500',
          !resultado && 'bg-indigo-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('truncate', local && 'font-semibold')}>{match.home.name}</span>
          <span className="text-gray-500 shrink-0">
            {match.finished ? `${match.home_score} - ${match.away_score}` : 'vs'}
          </span>
          <span className={cn('truncate', !local && 'font-semibold')}>{match.away.name}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{formatKickoff(match.utc_time)}</p>
      </div>
    </div>
  );
}

export default function CastellonPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('matches');
  const [upcoming, setUpcoming] = useState<CastellonMatch[]>([]);
  const [results, setResults] = useState<CastellonMatch[]>([]);
  const [table, setTable] = useState<TeamRow[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([
        apiFetch<{ upcoming: CastellonMatch[]; results: CastellonMatch[]; quota: Quota }>(
          '/api/castellon/matches'
        ),
        apiFetch<{ table: TeamRow[]; quota: Quota }>('/api/castellon/standings'),
      ]);
      setUpcoming(m.upcoming || []);
      setResults(m.results || []);
      setTable(s.table || []);
      setQuota(s.quota || m.quota || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await apiFetch('/api/castellon/refresh', { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error refrescando');
    }
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CD Castellon</h1>
          <p className="text-gray-400 mt-1">LaLiga Hypermotion — solo consulta</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-800 text-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex bg-gray-800 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setViewMode('matches')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            viewMode === 'matches' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          )}
        >
          <Calendar className="w-4 h-4" />
          Partidos
        </button>
        <button
          onClick={() => setViewMode('standings')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            viewMode === 'standings' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
          )}
        >
          <Trophy className="w-4 h-4" />
          Clasificacion
        </button>
      </div>

      {viewMode === 'matches' ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-3">
              Proximos partidos
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay partidos programados en las proximas semanas.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-3">
              Ultimos resultados
            </h2>
            {results.length === 0 ? (
              <p className="text-gray-500 text-sm">Todavia no hay resultados recientes.</p>
            ) : (
              <div className="space-y-2">
                {results.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="py-2 pr-2 font-medium">#</th>
                <th className="py-2 pr-2 font-medium">Equipo</th>
                <th className="py-2 px-2 font-medium text-center">PJ</th>
                <th className="py-2 px-2 font-medium text-center">G</th>
                <th className="py-2 px-2 font-medium text-center">E</th>
                <th className="py-2 px-2 font-medium text-center">P</th>
                <th className="py-2 px-2 font-medium text-center">Goles</th>
                <th className="py-2 pl-2 font-medium text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((t) => (
                <tr
                  key={t.team_id}
                  className={cn(
                    'border-t border-gray-800',
                    t.is_castellon && 'bg-indigo-900/30 font-semibold'
                  )}
                >
                  <td className="py-2 pr-2 text-gray-400">{t.position}</td>
                  <td className="py-2 pr-2">{t.name}</td>
                  <td className="py-2 px-2 text-center">{t.played}</td>
                  <td className="py-2 px-2 text-center">{t.won}</td>
                  <td className="py-2 px-2 text-center">{t.draw}</td>
                  <td className="py-2 px-2 text-center">{t.lost}</td>
                  <td className="py-2 px-2 text-center text-gray-400">{t.goals}</td>
                  <td className="py-2 pl-2 text-center">{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {table.length === 0 && (
            <p className="text-gray-500 text-sm">Sin datos de clasificacion.</p>
          )}
        </div>
      )}

      {quota && (
        <p className="text-xs text-gray-600 mt-8">
          Cuota de la API este mes: {quota.used}/{quota.budget}. Los datos se refrescan
          automaticamente cada pocos dias para no agotarla.
        </p>
      )}
    </div>
  );
}
