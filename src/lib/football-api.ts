import { Match, MatchStatus } from '@/types';

const API_BASE_URL = 'https://api.football-data.org/v4';

// Team IDs in football-data.org
const TEAM_IDS = {
  REAL_MADRID: 86,
  BARCELONA: 81,
};

// Competition IDs
const COMPETITION_IDS = {
  LA_LIGA: 'PD',      // Primera División
  SEGUNDA: 'SD',      // Segunda División
};

// Map football-data.org status to our status
function mapStatus(apiStatus: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    SCHEDULED: 'SCHEDULED',
    TIMED: 'SCHEDULED',
    IN_PLAY: 'LIVE',
    PAUSED: 'LIVE',
    FINISHED: 'FINISHED',
    POSTPONED: 'POSTPONED',
    CANCELLED: 'CANCELLED',
    SUSPENDED: 'LIVE',
    AWARDED: 'FINISHED',
  };
  return statusMap[apiStatus] || 'SCHEDULED';
}

interface FootballDataMatch {
  id: number;
  competition: {
    id: number;
    name: string;
    emblem: string;
  };
  season: {
    id: number;
    startDate: string;
    endDate: string;
  };
  utcDate: string;
  status: string;
  venue: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

export async function fetchTeamMatches(teamId: number): Promise<Partial<Match>[]> {
  const apiKey = process.env.FOOTBALL_DATA_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_KEY not configured');
  }

  const response = await fetch(
    `${API_BASE_URL}/teams/${teamId}/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED`,
    {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`football-data.org error: ${response.status} - ${error}`);
  }

  const data: FootballDataResponse = await response.json();

  return data.matches.map((match) => {
    const seasonYear = new Date(match.season.startDate).getFullYear();
    return {
      external_id: match.id,
      competition: match.competition.name,
      competition_logo: match.competition.emblem,
      season: `${seasonYear}/${seasonYear + 1}`,
      home_team: match.homeTeam.name,
      home_team_logo: match.homeTeam.crest,
      away_team: match.awayTeam.name,
      away_team_logo: match.awayTeam.crest,
      kickoff_utc: match.utcDate,
      venue: match.venue || undefined,
      status: mapStatus(match.status),
      home_score: match.score.fullTime.home ?? undefined,
      away_score: match.score.fullTime.away ?? undefined,
    };
  });
}

export async function fetchAllTrackedMatches(): Promise<Partial<Match>[]> {
  const [realMadridMatches, barcelonaMatches] = await Promise.all([
    fetchTeamMatches(TEAM_IDS.REAL_MADRID),
    fetchTeamMatches(TEAM_IDS.BARCELONA),
  ]);

  // Combine and deduplicate (El Clásico appears in both)
  const matchMap = new Map<number, Partial<Match>>();

  [...realMadridMatches, ...barcelonaMatches].forEach((match) => {
    if (match.external_id) {
      matchMap.set(match.external_id, match);
    }
  });

  return Array.from(matchMap.values());
}

export async function fetchMatchById(matchId: number): Promise<Partial<Match> | null> {
  const apiKey = process.env.FOOTBALL_DATA_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_KEY not configured');
  }

  const response = await fetch(`${API_BASE_URL}/matches/${matchId}`, {
    headers: {
      'X-Auth-Token': apiKey,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`football-data.org error: ${response.status}`);
  }

  const match: FootballDataMatch = await response.json();
  const seasonYear = new Date(match.season.startDate).getFullYear();

  return {
    external_id: match.id,
    competition: match.competition.name,
    competition_logo: match.competition.emblem,
    season: `${seasonYear}/${seasonYear + 1}`,
    home_team: match.homeTeam.name,
    home_team_logo: match.homeTeam.crest,
    away_team: match.awayTeam.name,
    away_team_logo: match.awayTeam.crest,
    kickoff_utc: match.utcDate,
    venue: match.venue || undefined,
    status: mapStatus(match.status),
    home_score: match.score.fullTime.home ?? undefined,
    away_score: match.score.fullTime.away ?? undefined,
  };
}

// Fetch all matches for a competition
export async function fetchCompetitionMatches(competitionId: string): Promise<Partial<Match>[]> {
  const apiKey = process.env.FOOTBALL_DATA_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_KEY not configured');
  }

  const response = await fetch(
    `${API_BASE_URL}/competitions/${competitionId}/matches`,
    {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`football-data.org error: ${response.status} - ${error}`);
  }

  const data: FootballDataResponse = await response.json();

  return data.matches.map((match) => {
    const seasonYear = new Date(match.season.startDate).getFullYear();
    return {
      external_id: match.id,
      competition: match.competition.name,
      competition_logo: match.competition.emblem,
      season: `${seasonYear}/${seasonYear + 1}`,
      home_team: match.homeTeam.name,
      home_team_logo: match.homeTeam.crest,
      away_team: match.awayTeam.name,
      away_team_logo: match.awayTeam.crest,
      kickoff_utc: match.utcDate,
      venue: match.venue || undefined,
      status: mapStatus(match.status),
      home_score: match.score.fullTime.home ?? undefined,
      away_score: match.score.fullTime.away ?? undefined,
    };
  });
}

// Standings types
export interface TeamStanding {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface StandingsResponse {
  standings: {
    type: string;
    table: TeamStanding[];
  }[];
}

// Fetch standings for a competition
export async function fetchCompetitionStandings(competitionId: string): Promise<TeamStanding[]> {
  const apiKey = process.env.FOOTBALL_DATA_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_KEY not configured');
  }

  const response = await fetch(
    `${API_BASE_URL}/competitions/${competitionId}/standings`,
    {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`football-data.org error: ${response.status} - ${error}`);
  }

  const data: StandingsResponse = await response.json();

  // Return TOTAL standings (not HOME or AWAY)
  const totalStandings = data.standings.find(s => s.type === 'TOTAL');
  return totalStandings?.table || [];
}

export { TEAM_IDS, COMPETITION_IDS };
