import { APIFootballResponse, Match, MatchStatus } from '@/types';

const API_BASE_URL = 'https://v3.football.api-sports.io';

// Team IDs in API-Football
const TEAM_IDS = {
  REAL_MADRID: 541,
  BARCELONA: 529,
};

// Map API-Football status to our status
function mapStatus(apiStatus: string): MatchStatus {
  const statusMap: Record<string, MatchStatus> = {
    TBD: 'SCHEDULED',
    NS: 'SCHEDULED',
    '1H': 'LIVE',
    HT: 'LIVE',
    '2H': 'LIVE',
    ET: 'LIVE',
    BT: 'LIVE',
    P: 'LIVE',
    SUSP: 'LIVE',
    INT: 'LIVE',
    FT: 'FINISHED',
    AET: 'FINISHED',
    PEN: 'FINISHED',
    PST: 'POSTPONED',
    CANC: 'CANCELLED',
    ABD: 'CANCELLED',
    AWD: 'FINISHED',
    WO: 'FINISHED',
    LIVE: 'LIVE',
  };
  return statusMap[apiStatus] || 'SCHEDULED';
}

// Get current season (Aug-Jul cycle)
function getCurrentSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // If we're in Jan-Jul, the season started last year
  return month < 7 ? year - 1 : year;
}

export async function fetchTeamMatches(
  teamId: number,
  season?: number
): Promise<Partial<Match>[]> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY not configured');
  }

  const currentSeason = season || getCurrentSeason();

  const response = await fetch(
    `${API_BASE_URL}/fixtures?team=${teamId}&season=${currentSeason}`,
    {
      headers: {
        'x-apisports-key': apiKey,
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    }
  );

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }

  const data: APIFootballResponse = await response.json();

  if (data.errors && data.errors.length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(data.errors)}`);
  }

  return data.response.map((match) => ({
    external_id: match.fixture.id,
    competition: match.league.name,
    competition_logo: match.league.logo,
    season: `${match.league.season}/${match.league.season + 1}`,
    home_team: match.teams.home.name,
    home_team_logo: match.teams.home.logo,
    away_team: match.teams.away.name,
    away_team_logo: match.teams.away.logo,
    kickoff_utc: match.fixture.date,
    venue: match.fixture.venue?.name,
    status: mapStatus(match.fixture.status.short),
    home_score: match.goals.home ?? undefined,
    away_score: match.goals.away ?? undefined,
  }));
}

export async function fetchAllTrackedMatches(
  season?: number
): Promise<Partial<Match>[]> {
  const [realMadridMatches, barcelonaMatches] = await Promise.all([
    fetchTeamMatches(TEAM_IDS.REAL_MADRID, season),
    fetchTeamMatches(TEAM_IDS.BARCELONA, season),
  ]);

  // Combine and deduplicate (in case of El Clásico)
  const matchMap = new Map<number, Partial<Match>>();

  [...realMadridMatches, ...barcelonaMatches].forEach((match) => {
    if (match.external_id) {
      matchMap.set(match.external_id, match);
    }
  });

  return Array.from(matchMap.values());
}

export async function fetchMatchById(
  fixtureId: number
): Promise<Partial<Match> | null> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY not configured');
  }

  const response = await fetch(`${API_BASE_URL}/fixtures?id=${fixtureId}`, {
    headers: {
      'x-apisports-key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }

  const data: APIFootballResponse = await response.json();

  if (data.response.length === 0) {
    return null;
  }

  const match = data.response[0];
  return {
    external_id: match.fixture.id,
    competition: match.league.name,
    competition_logo: match.league.logo,
    season: `${match.league.season}/${match.league.season + 1}`,
    home_team: match.teams.home.name,
    home_team_logo: match.teams.home.logo,
    away_team: match.teams.away.name,
    away_team_logo: match.teams.away.logo,
    kickoff_utc: match.fixture.date,
    venue: match.fixture.venue?.name,
    status: mapStatus(match.fixture.status.short),
    home_score: match.goals.home ?? undefined,
    away_score: match.goals.away ?? undefined,
  };
}

// Check if a team is one we track
export function isTrackedTeam(teamName: string): boolean {
  const trackedNames = [
    'Real Madrid',
    'Barcelona',
    'FC Barcelona',
    'Real Madrid CF',
  ];
  return trackedNames.some((name) =>
    teamName.toLowerCase().includes(name.toLowerCase())
  );
}

export { TEAM_IDS, getCurrentSeason };
