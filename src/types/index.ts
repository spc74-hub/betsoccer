// Database types
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  is_admin?: boolean;
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

// Stats page (/api/stats) — everything is derived from our own predictions
export interface StatsPlayer {
  user_id: string;
  display_name: string;
  total_points: number;
  predictions: number;
  avg_points: number;
  accuracy: number;
  perfect: number;
  blanks: number;
  breakdown: { winner: number; halftime: number; difference: number; exact: number };
  hits: { winner: number; halftime: number; difference: number; exact: number };
  current_streak: number;
  best_streak: number;
  best_match: StatsMatchRef | null;
  worst_match: StatsMatchRef | null;
  best_day: { date: string; points: number } | null;
  cumulative: { date: string; label: string; points: number; total: number }[];
}

export interface StatsMatchRef {
  label: string;
  points: number;
  date: string;
}

export interface StatsTendencies {
  user_id: string;
  display_name: string;
  favourite_score: { score: string; count: number } | null;
  avg_goals_predicted: number;
  avg_goals_real: number;
  avg_goal_error: number;
  winner_accuracy: number;
  halftime_accuracy: number;
  by_team: { team: string; predictions: number; points: number; avg_points: number }[];
}

export interface StatsHeadToHead {
  player_a: { user_id: string; display_name: string };
  player_b: { user_id: string; display_name: string };
  shared_matches: number;
  a_wins: number;
  b_wins: number;
  draws: number;
  both_exact: number;
  both_blank: number;
  timeline: { date: string; label: string; diff: number }[];
}

export interface StatsRecords {
  seasons: {
    name: string;
    winner_name: string | null;
    winner_points: number | null;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  }[];
  titles: { player: string; count: number }[];
  best_single: { player: string; label: string; result: string; points: number; date: string } | null;
  best_day: { player: string; date: string; points: number } | null;
  hardest_match: { label: string; result: string; avg_points: number; date: string } | null;
  easiest_match: { label: string; result: string; avg_points: number; date: string } | null;
  total_predictions: number;
}

export interface StatsPayload {
  season: { id: string; name: string; is_active: boolean } | null;
  players: StatsPlayer[];
  head_to_head: StatsHeadToHead | null;
  tendencies: StatsTendencies[];
  records: StatsRecords;
}
