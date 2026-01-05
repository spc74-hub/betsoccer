-- Migration: Seasons/Leagues system
-- Run this in Supabase SQL Editor

-- 1. Create seasons table
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  is_active boolean DEFAULT true,
  winner_user_id uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Add season_id to predictions table
ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id);

-- 3. Create a default active season if none exists
INSERT INTO public.seasons (name, start_date, is_active)
SELECT 'Temporada 2024/25', '2024-08-01'::timestamp with time zone, true
WHERE NOT EXISTS (SELECT 1 FROM public.seasons WHERE is_active = true);

-- 4. Update existing predictions to belong to the active season
UPDATE public.predictions
SET season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
WHERE season_id IS NULL;

-- 5. Create view for standings by season
CREATE OR REPLACE VIEW public.standings_by_season AS
SELECT
  s.id as season_id,
  s.name as season_name,
  s.is_active,
  u.id as user_id,
  u.display_name,
  u.avatar_url,
  COALESCE(SUM(p.points), 0)::integer as total_points,
  COUNT(p.id)::integer as total_predictions,
  COUNT(CASE WHEN p.points > 0 THEN 1 END)::integer as correct_predictions,
  CASE
    WHEN COUNT(p.id) > 0
    THEN ROUND((COUNT(CASE WHEN p.points > 0 THEN 1 END)::numeric / COUNT(p.id)::numeric) * 100, 1)
    ELSE 0
  END as accuracy
FROM public.users u
CROSS JOIN public.seasons s
LEFT JOIN public.predictions p ON p.user_id = u.id AND p.season_id = s.id
GROUP BY s.id, s.name, s.is_active, u.id, u.display_name, u.avatar_url
ORDER BY s.is_active DESC, total_points DESC;

-- 6. Update the original standings view to only show active season
DROP VIEW IF EXISTS public.standings;
CREATE VIEW public.standings AS
SELECT
  user_id,
  display_name,
  avatar_url,
  total_points,
  total_predictions,
  correct_predictions,
  accuracy
FROM public.standings_by_season
WHERE is_active = true
ORDER BY total_points DESC;

-- 7. Function to close current season and start a new one
CREATE OR REPLACE FUNCTION public.close_season_and_start_new(
  new_season_name text,
  p_end_date timestamp with time zone DEFAULT now()
)
RETURNS json AS $$
DECLARE
  current_season_id uuid;
  winner_id uuid;
  winner_name text;
  winner_points integer;
  new_season_id uuid;
BEGIN
  -- Get current active season
  SELECT id INTO current_season_id
  FROM public.seasons
  WHERE is_active = true
  LIMIT 1;

  IF current_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;

  -- Find the winner (user with most points)
  SELECT user_id, display_name, total_points
  INTO winner_id, winner_name, winner_points
  FROM public.standings_by_season
  WHERE season_id = current_season_id
  ORDER BY total_points DESC
  LIMIT 1;

  -- Close the current season
  UPDATE public.seasons
  SET
    is_active = false,
    end_date = p_end_date,
    winner_user_id = winner_id
  WHERE id = current_season_id;

  -- Create new season
  INSERT INTO public.seasons (name, start_date, is_active)
  VALUES (new_season_name, now(), true)
  RETURNING id INTO new_season_id;

  RETURN json_build_object(
    'closed_season_id', current_season_id,
    'winner_id', winner_id,
    'winner_name', winner_name,
    'winner_points', winner_points,
    'new_season_id', new_season_id,
    'new_season_name', new_season_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get all seasons with their winners
CREATE OR REPLACE FUNCTION public.get_seasons_history()
RETURNS TABLE(
  id uuid,
  name text,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  is_active boolean,
  winner_name text,
  winner_points integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.start_date,
    s.end_date,
    s.is_active,
    u.display_name as winner_name,
    COALESCE(
      (SELECT SUM(p.points)::integer
       FROM public.predictions p
       WHERE p.season_id = s.id AND p.user_id = s.winner_user_id),
      0
    ) as winner_points
  FROM public.seasons s
  LEFT JOIN public.users u ON u.id = s.winner_user_id
  ORDER BY s.start_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.seasons TO authenticated;
GRANT SELECT ON public.standings_by_season TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_season_and_start_new(text, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seasons_history() TO authenticated;

-- RLS for seasons
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Seasons are viewable by all authenticated users"
ON public.seasons FOR SELECT
TO authenticated
USING (true);
