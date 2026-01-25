// Database types
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Match {
  id: string;
  external_id: number;
  competition: string;
  competition_logo?: string;
  season: string;
  home_team: string;
  home_team_logo?: string;
  away_team: string;
  away_team_logo?: string;
  kickoff_utc: string;
  venue?: string;
  status: MatchStatus;
  home_score?: number;
  away_score?: number;
  home_score_halftime?: number;
  away_score_halftime?: number;
  created_at: string;
  updated_at: string;
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED';

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  home_score_halftime: number;
  away_score_halftime: number;
  points?: number;
  points_winner?: number;      // +1 for correct winner (1/X/2)
  points_halftime?: number;    // +2 for correct halftime score
  points_difference?: number;  // +3 for correct goal difference
  points_exact?: number;       // +4 for exact result
  created_at: string;
  updated_at: string;
}

export interface PredictionWithMatch extends Prediction {
  match: Match;
}

export interface PredictionWithUser extends Prediction {
  user: User;
}

export interface Standing {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  total_points: number;
  total_predictions: number;
  correct_predictions: number;
  accuracy: number;
  // Points breakdown by category
  points_winner?: number;      // +1 for correct winner (1/X/2)
  points_halftime?: number;    // +2 for correct halftime score
  points_difference?: number;  // +3 for correct goal difference
  points_exact?: number;       // +4 for exact result
}

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  winner_user_id?: string;
  winner_name?: string;
  winner_points?: number;
  created_at: string;
}

// API-Football types
export interface APIFootballMatch {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue: {
      id: number;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface APIFootballResponse {
  get: string;
  parameters: Record<string, string>;
  errors: string[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: APIFootballMatch[];
}

// UI types
export interface MatchWithPrediction extends Match {
  prediction?: Prediction;
}

export type TeamFilter = 'all' | 'real-madrid' | 'barcelona';
export type StatusFilter = 'upcoming' | 'finished' | 'all';
