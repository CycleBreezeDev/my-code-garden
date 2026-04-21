-- Add match columns to syndicate_picks
ALTER TABLE public.syndicate_picks
  ADD COLUMN IF NOT EXISTS main_match_count integer,
  ADD COLUMN IF NOT EXISTS bonus_match_count integer,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

-- Function: score all picks for a draw and create notifications
CREATE OR REPLACE FUNCTION public.score_picks_for_draw(_draw_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result record;
  _scored integer := 0;
  _pick record;
  _main_hits integer;
  _bonus_hits integer;
BEGIN
  SELECT winning_numbers, COALESCE(bonus_numbers, ARRAY[]::int[]) AS bonus_numbers
    INTO _result
  FROM public.draw_results
  WHERE draw_id = _draw_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  FOR _pick IN
    SELECT sp.id, sp.user_id, sp.share_index, sp.main_numbers, sp.bonus_numbers,
           s.id AS syndicate_id, s.name AS syndicate_name, s.slug AS syndicate_slug
    FROM public.syndicate_picks sp
    JOIN public.syndicates s ON s.id = sp.syndicate_id
    WHERE s.draw_id = _draw_id
  LOOP
    SELECT COUNT(*) INTO _main_hits
      FROM unnest(_pick.main_numbers) n
      WHERE n = ANY(_result.winning_numbers);

    SELECT COUNT(*) INTO _bonus_hits
      FROM unnest(_pick.bonus_numbers) n
      WHERE n = ANY(_result.bonus_numbers);

    UPDATE public.syndicate_picks
       SET main_match_count = _main_hits,
           bonus_match_count = _bonus_hits,
           matched_at = now()
     WHERE id = _pick.id;

    _scored := _scored + 1;

    IF (_main_hits + _bonus_hits) > 0 THEN
      INSERT INTO public.notifications (user_id, kind, entity_type, entity_id, body, metadata)
      VALUES (
        _pick.user_id,
        'lucky_pick_match',
        'syndicate_pick',
        _pick.id,
        'Your Lucky Pick matched ' || _main_hits ||
          CASE WHEN _bonus_hits > 0 THEN ' main + ' || _bonus_hits || ' bonus' ELSE ' number' || CASE WHEN _main_hits = 1 THEN '' ELSE 's' END END
          || ' in ' || _pick.syndicate_name,
        jsonb_build_object(
          'syndicate_id', _pick.syndicate_id,
          'syndicate_slug', _pick.syndicate_slug,
          'syndicate_name', _pick.syndicate_name,
          'share_index', _pick.share_index,
          'main_match_count', _main_hits,
          'bonus_match_count', _bonus_hits,
          'draw_id', _draw_id
        )
      );
    END IF;
  END LOOP;

  RETURN _scored;
END;
$$;

-- Trigger: auto-score picks when draw_results is inserted/updated
CREATE OR REPLACE FUNCTION public.trg_score_picks_after_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.score_picks_for_draw(NEW.draw_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS draw_results_score_picks ON public.draw_results;
CREATE TRIGGER draw_results_score_picks
AFTER INSERT OR UPDATE OF winning_numbers, bonus_numbers ON public.draw_results
FOR EACH ROW
EXECUTE FUNCTION public.trg_score_picks_after_results();

-- Backfill: score any draws that already have results
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT draw_id FROM public.draw_results LOOP
    PERFORM public.score_picks_for_draw(r.draw_id);
  END LOOP;
END$$;