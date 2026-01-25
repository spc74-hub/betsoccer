-- Points breakdown view: Shows detailed breakdown of points by category for each user
-- This updates the standings view to include points breakdown

-- Drop existing view
DROP VIEW IF EXISTS public.standings;

-- Create updated standings view with points breakdown
CREATE OR REPLACE VIEW public.standings AS
SELECT
  u.id AS user_id,
  u.display_name,
  u.avatar_url,
  COALESCE(SUM(p.points), 0)::integer AS total_points,
  COUNT(p.id)::integer AS total_predictions,
  COUNT(CASE WHEN p.points > 0 THEN 1 END)::integer AS correct_predictions,
  CASE
    WHEN COUNT(p.id) > 0
    THEN ROUND((COUNT(CASE WHEN p.points > 0 THEN 1 END)::numeric / COUNT(p.id)::numeric) * 100, 1)
    ELSE 0
  END AS accuracy,
  -- Points breakdown by category
  COALESCE(SUM(p.points_winner), 0)::integer AS points_winner,
  COALESCE(SUM(p.points_halftime), 0)::integer AS points_halftime,
  COALESCE(SUM(p.points_difference), 0)::integer AS points_difference,
  COALESCE(SUM(p.points_exact), 0)::integer AS points_exact
FROM public.users u
LEFT JOIN public.predictions p ON p.user_id = u.id 
  AND p.season_id = (SELECT id FROM public.seasons WHERE is_active = true LIMIT 1)
  AND p.points IS NOT NULL
GROUP BY u.id, u.display_name, u.avatar_url
ORDER BY total_points DESC, correct_predictions DESC, total_predictions ASC;

-- Also update standings_by_season view to include points breakdown
DROP VIEW IF EXISTS public.standings_by_season;
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
  END as accuracy,
  -- Points breakdown by category
  COALESCE(SUM(p.points_winner), 0)::integer AS points_winner,
  COALESCE(SUM(p.points_halftime), 0)::integer AS points_halftime,
  COALESCE(SUM(p.points_difference), 0)::integer AS points_difference,
  COALESCE(SUM(p.points_exact), 0)::integer AS points_exact
FROM public.users u
CROSS JOIN public.seasons s
LEFT JOIN public.predictions p ON p.user_id = u.id AND p.season_id = s.id
GROUP BY s.id, s.name, s.is_active, u.id, u.display_name, u.avatar_url
ORDER BY s.is_active DESC, total_points DESC;
