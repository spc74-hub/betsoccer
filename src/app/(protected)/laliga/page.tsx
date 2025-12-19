'use client';

import { useEffect, useState, useMemo } from 'react';
import { Match } from '@/types';
import { TeamStanding } from '@/lib/football-api';
import { formatMatchDate, formatMatchTime, cn } from '@/lib/utils';
import {
  Loader2,
  Star,
  Search,
  Trophy,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Division = 'primera' | 'segunda';
type ViewMode = 'matches' | 'standings';

export default function LaLigaPage() {
  const [division, setDivision] = useState<Division>('primera');
  const [viewMode, setViewMode] = useState<ViewMode>('matches');
  const [matches, setMatches] = useState<Partial<Match>[]>([]);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [expandedMatchday, setExpandedMatchday] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('laliga-favorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // Save favorites to localStorage
  const toggleFavorite = (teamId: number) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId];
      localStorage.setItem('laliga-favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (viewMode === 'matches') {
          const res = await fetch(`/api/laliga?division=${division}&type=matches`);
          const data = await res.json();
          setMatches(data.matches || []);
        } else {
          const res = await fetch(`/api/laliga?division=${division}&type=standings`);
          const data = await res.json();
          setStandings(data.standings || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setLoading(false);
    }
    fetchData();
  }, [division, viewMode]);

  // Group matches by matchday and sort
  const groupedMatches = useMemo(() => {
    const now = new Date();

    // Filter matches
    let filtered = matches;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.home_team?.toLowerCase().includes(query) ||
          m.away_team?.toLowerCase().includes(query)
      );
    }

    if (showFavoritesOnly && favorites.length > 0) {
      filtered = filtered.filter((m) => {
        // We need team IDs, but we only have names. Let's match by checking standings
        const homeTeam = standings.find(s => s.team.name === m.home_team);
        const awayTeam = standings.find(s => s.team.name === m.away_team);
        return (homeTeam && favorites.includes(homeTeam.team.id)) ||
               (awayTeam && favorites.includes(awayTeam.team.id));
      });
    }

    // Group by date
    const groups: Record<string, Partial<Match>[]> = {};
    filtered.forEach((match) => {
      if (match.kickoff_utc) {
        const date = new Date(match.kickoff_utc).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        if (!groups[date]) groups[date] = [];
        groups[date].push(match);
      }
    });

    // Sort groups: closest to today first
    const sortedEntries = Object.entries(groups).sort(([, a], [, b]) => {
      const dateA = new Date(a[0]?.kickoff_utc || '');
      const dateB = new Date(b[0]?.kickoff_utc || '');

      // Calculate distance from now
      const distA = Math.abs(dateA.getTime() - now.getTime());
      const distB = Math.abs(dateB.getTime() - now.getTime());

      return distA - distB;
    });

    return sortedEntries;
  }, [matches, searchQuery, showFavoritesOnly, favorites, standings]);

  // Find current matchday (closest to today)
  useEffect(() => {
    if (groupedMatches.length > 0 && !expandedMatchday) {
      setExpandedMatchday(groupedMatches[0][0]);
    }
  }, [groupedMatches, expandedMatchday]);

  // Filter standings
  const filteredStandings = useMemo(() => {
    let filtered = standings;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) =>
        s.team.name.toLowerCase().includes(query) ||
        s.team.shortName.toLowerCase().includes(query)
      );
    }

    if (showFavoritesOnly && favorites.length > 0) {
      filtered = filtered.filter((s) => favorites.includes(s.team.id));
    }

    return filtered;
  }, [standings, searchQuery, showFavoritesOnly, favorites]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">LaLiga 24/25</h1>
        <p className="text-gray-400 mt-1">
          Partidos y clasificacion de la liga espanola
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Division & View toggles */}
        <div className="flex flex-wrap gap-3">
          {/* Division selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setDivision('primera')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                division === 'primera'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              Primera
            </button>
            <button
              onClick={() => setDivision('segunda')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                division === 'segunda'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              Segunda
            </button>
          </div>

          {/* View mode selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('matches')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                viewMode === 'matches'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Calendar className="w-4 h-4" />
              Partidos
            </button>
            <button
              onClick={() => setViewMode('standings')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                viewMode === 'standings'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Trophy className="w-4 h-4" />
              Clasificacion
            </button>
          </div>

          {/* Favorites filter */}
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              showFavoritesOnly
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            )}
          >
            <Star className={cn('w-4 h-4', showFavoritesOnly && 'fill-current')} />
            Favoritos
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar equipo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Matches view */}
      {!loading && viewMode === 'matches' && (
        <div className="space-y-4">
          {groupedMatches.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No se encontraron partidos</p>
          ) : (
            groupedMatches.map(([date, dayMatches]) => (
              <div key={date} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                <button
                  onClick={() => setExpandedMatchday(expandedMatchday === date ? null : date)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-750 transition-colors"
                >
                  <span className="font-medium capitalize">{date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{dayMatches.length} partidos</span>
                    {expandedMatchday === date ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedMatchday === date && (
                  <div className="border-t border-gray-700 divide-y divide-gray-700">
                    {dayMatches.map((match) => {
                      const isFinished = match.status === 'FINISHED';
                      const isLive = match.status === 'LIVE';

                      return (
                        <div key={match.external_id} className="p-4">
                          <div className="flex items-center justify-between">
                            {/* Home team */}
                            <div className="flex items-center gap-2 flex-1">
                              {match.home_team_logo && (
                                <img
                                  src={match.home_team_logo}
                                  alt={match.home_team}
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                              <span className="text-sm truncate">{match.home_team}</span>
                            </div>

                            {/* Score or time */}
                            <div className="px-4 text-center min-w-[80px]">
                              {isFinished || isLive ? (
                                <span className={cn(
                                  'font-bold',
                                  isLive && 'text-green-400'
                                )}>
                                  {match.home_score} - {match.away_score}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  {formatMatchTime(match.kickoff_utc!)}
                                </span>
                              )}
                              {isLive && (
                                <span className="block text-xs text-green-400">EN VIVO</span>
                              )}
                            </div>

                            {/* Away team */}
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-sm truncate text-right">{match.away_team}</span>
                              {match.away_team_logo && (
                                <img
                                  src={match.away_team_logo}
                                  alt={match.away_team}
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Standings view */}
      {!loading && viewMode === 'standings' && (
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="p-4 w-12">#</th>
                  <th className="p-4">Equipo</th>
                  <th className="p-4 text-center">PJ</th>
                  <th className="p-4 text-center">G</th>
                  <th className="p-4 text-center">E</th>
                  <th className="p-4 text-center">P</th>
                  <th className="p-4 text-center">GF</th>
                  <th className="p-4 text-center">GC</th>
                  <th className="p-4 text-center">DG</th>
                  <th className="p-4 text-center font-bold">Pts</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredStandings.map((team) => {
                  const isFavorite = favorites.includes(team.team.id);

                  return (
                    <tr
                      key={team.team.id}
                      className={cn(
                        'border-b border-gray-700 hover:bg-gray-750 transition-colors',
                        isFavorite && 'bg-yellow-500/5'
                      )}
                    >
                      <td className="p-4 text-sm">
                        <span className={cn(
                          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                          team.position <= 4 && 'bg-green-600 text-white',
                          team.position === 5 && 'bg-blue-600 text-white',
                          team.position === 6 && 'bg-orange-600 text-white',
                          team.position >= 18 && 'bg-red-600 text-white'
                        )}>
                          {team.position}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={team.team.crest}
                            alt={team.team.name}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="font-medium text-sm">{team.team.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm">{team.playedGames}</td>
                      <td className="p-4 text-center text-sm text-green-400">{team.won}</td>
                      <td className="p-4 text-center text-sm text-gray-400">{team.draw}</td>
                      <td className="p-4 text-center text-sm text-red-400">{team.lost}</td>
                      <td className="p-4 text-center text-sm">{team.goalsFor}</td>
                      <td className="p-4 text-center text-sm">{team.goalsAgainst}</td>
                      <td className="p-4 text-center text-sm">
                        <span className={cn(
                          team.goalDifference > 0 && 'text-green-400',
                          team.goalDifference < 0 && 'text-red-400'
                        )}>
                          {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold">{team.points}</td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleFavorite(team.team.id)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                        >
                          <Star
                            className={cn(
                              'w-5 h-5',
                              isFavorite
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-500'
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-gray-700 flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-600"></span> Champions League
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-600"></span> Europa League
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-orange-600"></span> Conference League
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-600"></span> Descenso
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
