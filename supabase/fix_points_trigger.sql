-- Fix: Improved trigger to calculate points when match finishes or scores update
-- Run this in Supabase SQL Editor

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_match_finished ON public.matches;

-- Improved function that handles both cases:
-- 1. When status changes to FINISHED
-- 2. When scores are updated on an already FINISHED match
CREATE OR REPLACE FUNCTION public.calculate_prediction_points()
RETURNS trigger AS $$
BEGIN
  -- Only calculate if match is FINISHED and has scores
  IF NEW.status = 'FINISHED' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    -- Check if this is a new finish OR if scores changed on finished match
    IF (OLD.status != 'FINISHED') OR
       (OLD.home_score IS DISTINCT FROM NEW.home_score) OR
       (OLD.away_score IS DISTINCT FROM NEW.away_score) THEN

      UPDATE public.predictions
      SET points = CASE
        WHEN home_score = NEW.home_score AND away_score = NEW.away_score THEN 1
        ELSE 0
      END
      WHERE match_id = NEW.id;

      RAISE NOTICE 'Points calculated for match %: % - %', NEW.id, NEW.home_score, NEW.away_score;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved trigger (fires on any update to matches)
CREATE TRIGGER on_match_finished
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE PROCEDURE public.calculate_prediction_points();

-- Also add trigger for INSERT (in case match is inserted already finished)
DROP TRIGGER IF EXISTS on_match_inserted_finished ON public.matches;
CREATE TRIGGER on_match_inserted_finished
  AFTER INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.status = 'FINISHED' AND NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL)
  EXECUTE PROCEDURE public.calculate_prediction_points();

-- Function to manually recalculate all points (useful for fixing existing data)
CREATE OR REPLACE FUNCTION public.recalculate_all_points()
RETURNS TABLE(match_id uuid, updated_predictions integer) AS $$
DECLARE
  m RECORD;
  updated_count integer;
BEGIN
  FOR m IN
    SELECT id, home_score, away_score
    FROM public.matches
    WHERE status = 'FINISHED' AND home_score IS NOT NULL AND away_score IS NOT NULL
  LOOP
    UPDATE public.predictions p
    SET points = CASE
      WHEN p.home_score = m.home_score AND p.away_score = m.away_score THEN 1
      ELSE 0
    END
    WHERE p.match_id = m.id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    match_id := m.id;
    updated_predictions := updated_count;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.recalculate_all_points() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_points() TO service_role;

-- Run this to recalculate all existing points now:
-- SELECT * FROM public.recalculate_all_points();
