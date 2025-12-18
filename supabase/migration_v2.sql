-- Migration v2: Add initial points and allow cross-user predictions

-- 1. Add initial_points column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS initial_points integer DEFAULT 0;

-- 2. Update RLS policy to allow any authenticated user to create predictions for any user
DROP POLICY IF EXISTS "Users can create own predictions" ON public.predictions;
CREATE POLICY "Users can create predictions for any user"
  ON public.predictions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Update RLS policy to allow any authenticated user to update predictions before kickoff
DROP POLICY IF EXISTS "Users can update own predictions before kickoff" ON public.predictions;
CREATE POLICY "Users can update predictions before kickoff"
  ON public.predictions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = predictions.match_id
      AND matches.kickoff_utc > now()
    )
  );

-- 4. Update RLS policy to allow any authenticated user to delete predictions before kickoff
DROP POLICY IF EXISTS "Users can delete own predictions before kickoff" ON public.predictions;
CREATE POLICY "Users can delete predictions before kickoff"
  ON public.predictions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches
      WHERE matches.id = predictions.match_id
      AND matches.kickoff_utc > now()
    )
  );

-- 5. Update standings view to include initial_points
DROP VIEW IF EXISTS public.standings;
CREATE OR REPLACE VIEW public.standings AS
SELECT
  u.id AS user_id,
  u.display_name,
  u.avatar_url,
  (u.initial_points + COALESCE(SUM(p.points), 0))::integer AS total_points,
  COUNT(p.id)::integer AS total_predictions,
  COALESCE(SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END), 0)::integer AS correct_predictions,
  CASE
    WHEN COUNT(p.id) > 0 THEN
      ROUND((SUM(CASE WHEN p.points = 1 THEN 1 ELSE 0 END)::numeric / COUNT(p.id)::numeric) * 100, 1)
    ELSE 0
  END AS accuracy
FROM public.users u
LEFT JOIN public.predictions p ON u.id = p.user_id AND p.points IS NOT NULL
GROUP BY u.id, u.display_name, u.avatar_url, u.initial_points
ORDER BY total_points DESC, correct_predictions DESC, total_predictions ASC;

-- 6. Create Salva user manually (he can claim it later with magic link)
-- First we need to insert into auth.users, but that requires service role
-- Instead, we'll create a function to add users with initial points

CREATE OR REPLACE FUNCTION public.create_player(
  p_email text,
  p_display_name text,
  p_initial_points integer DEFAULT 0
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Generate a UUID for the new user
  v_user_id := uuid_generate_v4();

  -- Insert into public.users (auth.users entry will be created when they sign up)
  INSERT INTO public.users (id, email, display_name, initial_points)
  VALUES (v_user_id, p_email, p_display_name, p_initial_points)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    initial_points = EXCLUDED.initial_points;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
