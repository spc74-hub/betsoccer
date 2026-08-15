'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Season, StatsPayload, StatsPlayer, StatsTendencies } from '@/types';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Flame,
  Target,
  Crosshair,
  Trophy,
  Medal,
  Swords,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';

// One colour per player, reused across every chart so a line is always the same person.
const SERIES = [
  { stroke: '#818cf8', fill: 'rgba(129,140,248,0.15)', text: 'text-indigo-400', bg: 'bg-indigo-500' },
  { stroke: '#34d399', fill: 'rgba(52,211,153,0.15)', text: 'text-emerald-400', bg: 'bg-emerald-500' },
  { stroke: '#fbbf24', fill: 'rgba(251,191,36,0.15)', text: 'text-amber-400', bg: 'bg-amber-500' },
  { stroke: '#f472b6', fill: 'rgba(244,114,182,0.15)', text: 'text-pink-400', bg: 'bg-pink-500' },
];

export default function StatsPage() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const url = seasonId ? `/api/stats?season_id=${seasonId}` : '/api/stats';
      const stats = await apiFetch<StatsPayload>(url);
      setData(stats);
      if (!seasonId && stats.season) setSeasonId(stats.season.id);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    apiFetch<Season[]>('/api/standings/seasons')
      .then(setSeasons)
      .catch((err) => console.error('Error fetching seasons:', err));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!data || data.players.length === 0) {
    return (
      <div>
        <Header seasons={seasons} seasonId={seasonId} onSeasonChange={setSeasonId} />
        <div className="text-center py-12">
          <p className="text-gray-400">Todavia no hay pronosticos puntuados en esta temporada</p>
          <p className="text-gray-500 text-sm mt-1">
            Las estadisticas apareceran cuando se juegue el primer partido
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <Header seasons={seasons} seasonId={seasonId} onSeasonChange={setSeasonId} />

      <SectionTitle icon={TrendingUp} title="Tu rendimiento" />
      <PlayersBlock players={data.players} />

      <SectionTitle icon={Swords} title="Cara a cara" />
      <HeadToHeadBlock h2h={data.head_to_head} />

      <SectionTitle icon={Crosshair} title="Tus manias" />
      <TendenciesBlock tendencies={data.tendencies} />

      <SectionTitle icon={Trophy} title="Palmares y records" />
      <RecordsBlock records={data.records} />
    </div>
  );
}

function Header({
  seasons,
  seasonId,
  onSeasonChange,
}: {
  seasons: Season[];
  seasonId: string | null;
  onSeasonChange: (id: string) => void;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold">Estadisticas</h1>
      <p className="text-gray-400 mt-1">Todo sale de vuestros propios pronosticos</p>
      {seasons.length > 0 && (
        <select
          value={seasonId ?? ''}
          onChange={(e) => onSeasonChange(e.target.value)}
          className="mt-4 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.is_active ? ' (actual)' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mt-10 mb-4">
      <Icon className="w-5 h-5 text-indigo-400" />
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-gray-800 rounded-xl p-4 border border-gray-700', className)}>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn('text-xl font-bold', accent ?? 'text-white')}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

/* ---------- Block A: per-player performance ---------- */

function PlayersBlock({ players }: { players: StatsPlayer[] }) {
  return (
    <>
      <Card className="mb-4">
        <p className="text-xs text-gray-400 mb-3">Puntos acumulados</p>
        <CumulativeChart players={players} />
        <div className="flex flex-wrap gap-4 mt-3">
          {players.map((p, i) => (
            <div key={p.user_id} className="flex items-center gap-2 text-xs">
              <span
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: SERIES[i % SERIES.length].stroke }}
              />
              <span className="text-gray-300">{p.display_name}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {players.map((p, i) => {
          const s = SERIES[i % SERIES.length];
          return (
            <Card key={p.user_id}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={cn('font-bold', s.text)}>{p.display_name}</h3>
                <span className="text-2xl font-bold">{p.total_points} pts</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Media" value={p.avg_points} hint="de 10" />
                <Stat label="Precision" value={`${p.accuracy}%`} hint={`${p.predictions} pronosticos`} />
                <Stat label="Plenos" value={p.perfect} hint={`${p.blanks} en blanco`} accent="text-yellow-400" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Stat
                  label="Racha actual"
                  value={
                    <span className="flex items-center gap-1">
                      {p.current_streak > 0 && <Flame className="w-4 h-4 text-orange-400" />}
                      {p.current_streak}
                    </span>
                  }
                  hint="partidos puntuando"
                />
                <Stat label="Mejor racha" value={p.best_streak} hint="historico de la temporada" />
              </div>

              <p className="text-xs text-gray-400 mb-2">De donde salen los puntos</p>
              <BreakdownBars breakdown={p.breakdown} hits={p.hits} />

              <div className="mt-4 pt-3 border-t border-gray-700 space-y-1 text-xs">
                {p.best_match && (
                  <p className="text-gray-400">
                    Mejor acierto:{' '}
                    <span className="text-white">{p.best_match.label}</span>{' '}
                    <span className="text-green-400 font-medium">+{p.best_match.points}</span>
                  </p>
                )}
                {p.best_day && (
                  <p className="text-gray-400">
                    Mejor dia:{' '}
                    <span className="text-white">
                      {new Date(p.best_day.date).toLocaleDateString('es-ES')}
                    </span>{' '}
                    <span className="text-green-400 font-medium">+{p.best_day.points}</span>
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function BreakdownBars({
  breakdown,
  hits,
}: {
  breakdown: StatsPlayer['breakdown'];
  hits: StatsPlayer['hits'];
}) {
  const items = [
    { key: 'winner' as const, label: 'Ganador', color: 'bg-blue-500' },
    { key: 'halftime' as const, label: 'Descanso', color: 'bg-purple-500' },
    { key: 'difference' as const, label: 'Diferencia', color: 'bg-yellow-500' },
    { key: 'exact' as const, label: 'Exacto', color: 'bg-green-500' },
  ];
  const max = Math.max(...items.map((i) => breakdown[i.key]), 1);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-20 shrink-0">{item.label}</span>
          <div className="flex-1 bg-gray-900 rounded-full h-2 overflow-hidden">
            <div
              className={cn('h-full rounded-full', item.color)}
              style={{ width: `${(breakdown[item.key] / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-white font-medium w-16 text-right shrink-0">
            {breakdown[item.key]} pts
          </span>
          <span className="text-xs text-gray-500 w-12 text-right shrink-0">×{hits[item.key]}</span>
        </div>
      ))}
    </div>
  );
}

function CumulativeChart({ players }: { players: StatsPlayer[] }) {
  const W = 600;
  const H = 160;
  const PAD = 4;
  const maxLen = Math.max(...players.map((p) => p.cumulative.length), 1);
  const maxVal = Math.max(...players.flatMap((p) => p.cumulative.map((c) => c.total)), 1);

  if (maxLen < 2) {
    return <p className="text-xs text-gray-500 py-8 text-center">Aun no hay suficientes partidos</p>;
  }

  const x = (i: number) => PAD + (i / (maxLen - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / maxVal) * (H - PAD * 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {players.map((p, i) => {
          const s = SERIES[i % SERIES.length];
          const d = p.cumulative
            .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${x(idx)} ${y(c.total)}`)
            .join(' ');
          return (
            <path
              key={p.user_id}
              d={d}
              fill="none"
              stroke={s.stroke}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Block B: head to head ---------- */

function HeadToHeadBlock({ h2h }: { h2h: StatsPayload['head_to_head'] }) {
  if (!h2h) {
    return (
      <Card>
        <p className="text-sm text-gray-400">
          Hacen falta dos jugadores con pronosticos en los mismos partidos
        </p>
      </Card>
    );
  }

  const total = h2h.a_wins + h2h.b_wins + h2h.draws;
  const pctA = total ? (h2h.a_wins / total) * 100 : 0;
  const pctDraw = total ? (h2h.draws / total) * 100 : 0;
  const pctB = total ? (h2h.b_wins / total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <p className="text-xs text-gray-400 mb-3">
          Duelos ganados · {h2h.shared_matches} partidos en comun
        </p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-indigo-400 font-bold">{h2h.player_a.display_name}</span>
          <span className="text-emerald-400 font-bold">{h2h.player_b.display_name}</span>
        </div>

        <div className="flex h-8 rounded-lg overflow-hidden mb-2">
          <div
            className="bg-indigo-500 flex items-center justify-center text-xs font-bold"
            style={{ width: `${pctA}%` }}
          >
            {h2h.a_wins > 0 && h2h.a_wins}
          </div>
          <div
            className="bg-gray-600 flex items-center justify-center text-xs"
            style={{ width: `${pctDraw}%` }}
          >
            {h2h.draws > 0 && h2h.draws}
          </div>
          <div
            className="bg-emerald-500 flex items-center justify-center text-xs font-bold"
            style={{ width: `${pctB}%` }}
          >
            {h2h.b_wins > 0 && h2h.b_wins}
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          {h2h.draws} empatados
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-700">
          <Stat
            label="Ambos clavaron el exacto"
            value={h2h.both_exact}
            accent="text-green-400"
          />
          <Stat label="Ninguno puntuo" value={h2h.both_blank} accent="text-red-400" />
        </div>
      </Card>

      <Card>
        <p className="text-xs text-gray-400 mb-1">Diferencia acumulada</p>
        <p className="text-xs text-gray-500 mb-3">
          Por encima de la linea gana{' '}
          <span className="text-indigo-400">{h2h.player_a.display_name}</span>, por debajo{' '}
          <span className="text-emerald-400">{h2h.player_b.display_name}</span>
        </p>
        <DiffChart timeline={h2h.timeline} />
      </Card>
    </div>
  );
}

function DiffChart({ timeline }: { timeline: { diff: number }[] }) {
  const W = 600;
  const H = 160;
  const PAD = 4;

  if (timeline.length < 2) {
    return <p className="text-xs text-gray-500 py-8 text-center">Aun no hay suficientes partidos</p>;
  }

  const maxAbs = Math.max(...timeline.map((t) => Math.abs(t.diff)), 1);
  const x = (i: number) => PAD + (i / (timeline.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - PAD);

  const line = timeline.map((t, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(t.diff)}`).join(' ');
  const area = `${line} L ${x(timeline.length - 1)} ${H / 2} L ${x(0)} ${H / 2} Z`;
  const last = timeline[timeline.length - 1].diff;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none">
        <path d={area} fill={last >= 0 ? 'rgba(129,140,248,0.15)' : 'rgba(52,211,153,0.15)'} />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#4b5563" strokeWidth={1} />
        <path
          d={line}
          fill="none"
          stroke={last >= 0 ? '#818cf8' : '#34d399'}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="text-xs text-center mt-2">
        <span className={last >= 0 ? 'text-indigo-400' : 'text-emerald-400'}>
          {last === 0 ? 'Empate absoluto' : `${Math.abs(last)} puntos de ventaja`}
        </span>
      </p>
      {/* This only adds up the shared matches, so it can differ from the standings gap. */}
      <p className="text-xs text-center text-gray-500 mt-1">
        contando solo los partidos que pronosticaron los dos
      </p>
    </div>
  );
}

/* ---------- Block C: tendencies ---------- */

function TendenciesBlock({ tendencies }: { tendencies: StatsTendencies[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tendencies.map((t, i) => {
        const s = SERIES[i % SERIES.length];
        const optimist = t.avg_goals_predicted - t.avg_goals_real;
        return (
          <Card key={t.user_id}>
            <h3 className={cn('font-bold mb-4', s.text)}>{t.display_name}</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat
                label="Marcador favorito"
                value={t.favourite_score?.score ?? '—'}
                hint={t.favourite_score ? `${t.favourite_score.count} veces` : undefined}
              />
              <Stat
                label="Error medio"
                value={`${t.avg_goal_error} goles`}
                hint="de desviacion por partido"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Acierta el 1X2" value={`${t.winner_accuracy}%`} />
              <Stat label="Acierta el descanso" value={`${t.halftime_accuracy}%`} />
            </div>

            <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">Goles que pronostica vs goles reales</p>
              <p className="text-sm">
                <span className="text-white font-bold">{t.avg_goals_predicted}</span>
                <span className="text-gray-500"> vs </span>
                <span className="text-white font-bold">{t.avg_goals_real}</span>
                <span
                  className={cn(
                    'ml-2 text-xs',
                    Math.abs(optimist) < 0.15
                      ? 'text-gray-400'
                      : optimist > 0
                      ? 'text-orange-400'
                      : 'text-blue-400'
                  )}
                >
                  {Math.abs(optimist) < 0.15
                    ? 'clavado'
                    : optimist > 0
                    ? `optimista (+${optimist.toFixed(2)})`
                    : `conservador (${optimist.toFixed(2)})`}
                </span>
              </p>
            </div>

            {t.by_team.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mb-2">Donde mas puntua</p>
                <div className="space-y-1">
                  {t.by_team.map((team) => (
                    <div key={team.team} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300 truncate pr-2">{team.team}</span>
                      <span className="text-gray-500 shrink-0">
                        <span className="text-white font-medium">{team.avg_points}</span> pts/partido
                        <span className="text-gray-600"> ({team.predictions})</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Block D: all-time records ---------- */

function RecordsBlock({ records }: { records: StatsPayload['records'] }) {
  const medals = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Los records son historicos: cuentan todas las temporadas ({records.total_predictions}{' '}
        pronosticos puntuados)
      </p>

      {records.titles.length > 0 && (
        <Card>
          <p className="text-xs text-gray-400 mb-3">Palmares</p>
          <div className="space-y-2">
            {records.titles.map((t, i) => (
              <div key={t.player} className="flex items-center gap-2">
                <Medal className={cn('w-4 h-4', medals[i] ?? 'text-gray-500')} />
                <span className="text-white font-medium">{t.player}</span>
                <span className="text-gray-400 text-sm">
                  {t.count} {t.count === 1 ? 'temporada' : 'temporadas'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {records.best_single && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-green-400" />
              <p className="text-xs text-gray-400">Mejor pronostico</p>
            </div>
            <p className="text-lg font-bold">{records.best_single.points} puntos</p>
            <p className="text-sm text-white">{records.best_single.label}</p>
            <p className="text-xs text-gray-500">
              {records.best_single.player} · resultado {records.best_single.result}
            </p>
          </Card>
        )}

        {records.best_day && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <p className="text-xs text-gray-400">Mejor dia</p>
            </div>
            <p className="text-lg font-bold">{records.best_day.points} puntos</p>
            <p className="text-sm text-white">{records.best_day.player}</p>
            <p className="text-xs text-gray-500">
              {new Date(records.best_day.date).toLocaleDateString('es-ES')}
            </p>
          </Card>
        )}

        {records.hardest_match && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="w-4 h-4 text-red-400" />
              <p className="text-xs text-gray-400">El partido mas traicionero</p>
            </div>
            <p className="text-sm text-white">{records.hardest_match.label}</p>
            <p className="text-xs text-gray-500">
              Acabo {records.hardest_match.result} · media de{' '}
              {records.hardest_match.avg_points} pts
            </p>
          </Card>
        )}

        {records.easiest_match && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-gray-400">El mas cantado</p>
            </div>
            <p className="text-sm text-white">{records.easiest_match.label}</p>
            <p className="text-xs text-gray-500">
              Acabo {records.easiest_match.result} · media de{' '}
              {records.easiest_match.avg_points} pts
            </p>
          </Card>
        )}
      </div>

      {records.seasons.length > 0 && (
        <Card>
          <p className="text-xs text-gray-400 mb-3">Temporadas</p>
          <div className="space-y-2">
            {records.seasons.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between text-sm py-1 border-b border-gray-700/50 last:border-0"
              >
                <span className="text-white">
                  {s.name}
                  {s.is_active && (
                    <span className="ml-2 text-xs text-green-400">en curso</span>
                  )}
                </span>
                <span className="text-gray-400 text-xs">
                  {s.winner_name ? (
                    <>
                      <Trophy className="w-3 h-3 inline mr-1 text-yellow-400" />
                      {s.winner_name} ({s.winner_points} pts)
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
