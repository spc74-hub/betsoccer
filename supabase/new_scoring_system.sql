-- Migration: New scoring system with halftime predictions
-- Run this in Supabase SQL Editor

-- 1. Add halftime score columns to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS home_score_halftime integer,
ADD COLUMN IF NOT EXISTS away_score_halftime integer;

-- 2. Add halftime prediction and points breakdown columns to predictions table
ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS home_score_halftime integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS away_score_halftime integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_winner integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_halftime integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_difference integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_exact integer DEFAULT 0;

-- 3. Update existing predictions to have default halftime values
UPDATE public.predictions
SET home_score_halftime = 0, away_score_halftime = 0
WHERE home_score_halftime IS NULL;

-- 4. Drop existing triggers
DROP TRIGGER IF EXISTS on_match_finished ON public.matches;
DROP TRIGGER IF EXISTS on_match_inserted_finished ON public.matches;

-- 5. Create new points calculation function with the new scoring system
-- Points:
--   +1 for correct winner (1/X/2)
--   +2 for correct halftime score
--   +3 for correct goal difference
--   +4 for exact result
-- All points are cumulative (max 10 per match)
CREATE OR REPLACE FUNCTION public.calculate_prediction_points()
RETURNS trigger AS $$
DECLARE
  pred RECORD;
  p_winner integer;
  p_halftime integer;
  p_difference integer;
  p_exact integer;
  p_total integer;

  -- Match results
  m_home integer;
  m_away integer;
  m_home_ht integer;
  m_away_ht integer;
  m_diff integer;
  m_winner integer; -- 1 = home, 0 = draw, -1 = away

  -- Prediction values
  pred_home integer;
  pred_away integer;
  pred_home_ht integer;
  pred_away_ht integer;
  pred_diff integer;
  pred_winner integer;
BEGIN
  -- Only calculate if match is FINISHED and has scores
  IF NEW.status = 'FINISHED' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    -- Check if this is a new finish OR if scores changed on finished match
    IF (OLD.status != 'FINISHED') OR
       (OLD.home_score IS DISTINCT FROM NEW.home_score) OR
       (OLD.away_score IS DISTINCT FROM NEW.away_score) OR
       (OLD.home_score_halftime IS DISTINCT FROM NEW.home_score_halftime) OR
       (OLD.away_score_halftime IS DISTINCT FROM NEW.away_score_halftime) THEN

      -- Get match results
      m_home := NEW.home_score;
      m_away := NEW.away_score;
      m_home_ht := COALESCE(NEW.home_score_halftime, 0);
      m_away_ht := COALESCE(NEW.away_score_halftime, 0);
      m_diff := m_home - m_away;

      -- Determine winner: 1 = home wins, 0 = draw, -1 = away wins
      IF m_home > m_away THEN
        m_winner := 1;
      ELSIF m_home < m_away THEN
        m_winner := -1;
      ELSE
        m_winner := 0;
      END IF;

      -- Loop through all predictions for this match
      FOR pred IN SELECT * FROM public.predictions WHERE match_id = NEW.id
      LOOP
        p_winner := 0;
        p_halftime := 0;
        p_difference := 0;
        p_exact := 0;

        pred_home := pred.home_score;
        pred_away := pred.away_score;
        pred_home_ht := COALESCE(pred.home_score_halftime, 0);
        pred_away_ht := COALESCE(pred.away_score_halftime, 0);
        pred_diff := pred_home - pred_away;

        -- Determine predicted winner
        IF pred_home > pred_away THEN
          pred_winner := 1;
        ELSIF pred_home < pred_away THEN
          pred_winner := -1;
        ELSE
          pred_winner := 0;
        END IF;

        -- +1 for correct winner (1/X/2)
        IF pred_winner = m_winner THEN
          p_winner := 1;
        END IF;

        -- +2 for correct halftime score
        IF pred_home_ht = m_home_ht AND pred_away_ht = m_away_ht THEN
          p_halftime := 2;
        END IF;

        -- +3 for correct goal difference
        IF pred_diff = m_diff THEN
          p_difference := 3;
        END IF;

        -- +4 for exact result
        IF pred_home = m_home AND pred_away = m_away THEN
          p_exact := 4;
        END IF;

        -- Calculate total
        p_total := p_winner + p_halftime + p_difference + p_exact;

        -- Update prediction
        UPDATE public.predictions
        SET
          points = p_total,
          points_winner = p_winner,
          points_halftime = p_halftime,
          points_difference = p_difference,
          points_exact = p_exact
        WHERE id = pred.id;

        RAISE NOTICE 'Points for prediction %: winner=%, halftime=%, diff=%, exact=%, total=%',
          pred.id, p_winner, p_halftime, p_difference, p_exact, p_total;
      END LOOP;

      RAISE NOTICE 'Points calculated for match %: % - % (HT: % - %)',
        NEW.id, NEW.home_score, NEW.away_score, NEW.home_score_halftime, NEW.away_score_halftime;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create trigger for match updates
CREATE TRIGGER on_match_finished
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.calculate_prediction_points();

-- 7. Create trigger for match inserts (in case match is inserted already finished)
CREATE TRIGGER on_match_inserted_finished
  AFTER INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'FINISHED' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL)
  EXECUTE PROCEDURE public.calculate_prediction_points();

-- 8. Function to manually recalculate all points (for fixing existing data)
DROP FUNCTION IF EXISTS public.recalculate_all_points();
CREATE OR REPLACE FUNCTION public.recalculate_all_points()
RETURNS TABLE(match_id uuid, predictions_updated integer) AS $$
DECLARE
  m RECORD;
  updated_count integer;
  p_winner integer;
  p_halftime integer;
  p_difference integer;
  p_exact integer;
  p_total integer;

  m_home integer;
  m_away integer;
  m_home_ht integer;
  m_away_ht integer;
  m_diff integer;
  m_winner integer;

  pred RECORD;
  pred_home integer;
  pred_away integer;
  pred_home_ht integer;
  pred_away_ht integer;
  pred_diff integer;
  pred_winner integer;
BEGIN
  FOR m IN
    SELECT id, home_score, away_score, home_score_halftime, away_score_halftime
    FROM public.matches
    WHERE status = 'FINISHED' AND home_score IS NOT NULL AND away_score IS NOT NULL
  LOOP
    updated_count := 0;

    m_home := m.home_score;
    m_away := m.away_score;
    m_home_ht := COALESCE(m.home_score_halftime, 0);
    m_away_ht := COALESCE(m.away_score_halftime, 0);
    m_diff := m_home - m_away;

    IF m_home > m_away THEN
      m_winner := 1;
    ELSIF m_home < m_away THEN
      m_winner := -1;
    ELSE
      m_winner := 0;
    END IF;

    FOR pred IN SELECT * FROM public.predictions WHERE predictions.match_id = m.id
    LOOP
      p_winner := 0;
      p_halftime := 0;
      p_difference := 0;
      p_exact := 0;

      pred_home := pred.home_score;
      pred_away := pred.away_score;
      pred_home_ht := COALESCE(pred.home_score_halftime, 0);
      pred_away_ht := COALESCE(pred.away_score_halftime, 0);
      pred_diff := pred_home - pred_away;

      IF pred_home > pred_away THEN
        pred_winner := 1;
      ELSIF pred_home < pred_away THEN
        pred_winner := -1;
      ELSE
        pred_winner := 0;
      END IF;

      IF pred_winner = m_winner THEN
        p_winner := 1;
      END IF;

      IF pred_home_ht = m_home_ht AND pred_away_ht = m_away_ht THEN
        p_halftime := 2;
      END IF;

      IF pred_diff = m_diff THEN
        p_difference := 3;
      END IF;

      IF pred_home = m_home AND pred_away = m_away THEN
        p_exact := 4;
      END IF;

      p_total := p_winner + p_halftime + p_difference + p_exact;

      UPDATE public.predictions
      SET
        points = p_total,
        points_winner = p_winner,
        points_halftime = p_halftime,
        points_difference = p_difference,
        points_exact = p_exact
      WHERE id = pred.id;

      updated_count := updated_count + 1;
    END LOOP;

    match_id := m.id;
    predictions_updated := updated_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.recalculate_all_points() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_points() TO service_role;

-- 9. Run this to recalculate all existing points with the new system:
-- SELECT * FROM public.recalculate_all_points();
