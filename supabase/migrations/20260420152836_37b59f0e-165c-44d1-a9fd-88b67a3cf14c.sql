
-- 1. Add number_format to lotteries
ALTER TABLE public.lotteries
  ADD COLUMN IF NOT EXISTS number_format jsonb NOT NULL DEFAULT '{"main":{"count":6,"min":1,"max":49},"bonus":{"count":0,"min":0,"max":0}}'::jsonb;

-- Backfill known lotteries by slug (best-effort; safe if slug not present)
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":69},"bonus":{"count":1,"min":1,"max":26}}'::jsonb WHERE slug IN ('powerball','us-powerball');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":70},"bonus":{"count":1,"min":1,"max":25}}'::jsonb WHERE slug IN ('mega-millions','megamillions');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":50},"bonus":{"count":2,"min":1,"max":12}}'::jsonb WHERE slug IN ('euromillions');
UPDATE public.lotteries SET number_format = '{"main":{"count":6,"min":1,"max":59},"bonus":{"count":0,"min":0,"max":0}}'::jsonb WHERE slug IN ('uk-lotto','uk-national-lottery');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":50},"bonus":{"count":1,"min":1,"max":20}}'::jsonb WHERE slug IN ('sa-powerball','south-africa-powerball');
UPDATE public.lotteries SET number_format = '{"main":{"count":6,"min":1,"max":52},"bonus":{"count":0,"min":0,"max":0}}'::jsonb WHERE slug IN ('sa-lotto','south-africa-lotto');

-- 2. Add picks_lock_offset_minutes to syndicates
ALTER TABLE public.syndicates
  ADD COLUMN IF NOT EXISTS picks_lock_offset_minutes integer NOT NULL DEFAULT 120;

-- 3. Create syndicate_picks table
CREATE TABLE IF NOT EXISTS public.syndicate_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  share_index integer NOT NULL CHECK (share_index >= 1),
  main_numbers integer[] NOT NULL DEFAULT '{}',
  bonus_numbers integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, share_index)
);

CREATE INDEX IF NOT EXISTS idx_syndicate_picks_syndicate ON public.syndicate_picks(syndicate_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_picks_user ON public.syndicate_picks(user_id);

ALTER TABLE public.syndicate_picks ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_syndicate_picks_updated_at ON public.syndicate_picks;
CREATE TRIGGER trg_syndicate_picks_updated_at
  BEFORE UPDATE ON public.syndicate_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Validation trigger: format + lock window
CREATE OR REPLACE FUNCTION public.validate_syndicate_pick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_syn public.syndicates%ROWTYPE;
  v_draw public.lottery_draws%ROWTYPE;
  v_lottery public.lotteries%ROWTYPE;
  v_fmt jsonb;
  v_main_count int; v_main_min int; v_main_max int;
  v_bonus_count int; v_bonus_min int; v_bonus_max int;
  v_n int;
  v_membership public.syndicate_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_syn FROM public.syndicates WHERE id = NEW.syndicate_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Syndicate not found'; END IF;

  SELECT * INTO v_draw FROM public.lottery_draws WHERE id = v_syn.draw_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draw not found'; END IF;

  SELECT * INTO v_lottery FROM public.lotteries WHERE id = v_draw.lottery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lottery not found'; END IF;

  -- Lock window check (skip when admin updates only the status field)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF now() >= (v_draw.draw_date - make_interval(mins => COALESCE(v_syn.picks_lock_offset_minutes, 120))) THEN
      RAISE EXCEPTION 'Picks are locked for this draw';
    END IF;
  END IF;

  -- Membership/share_index sanity
  SELECT * INTO v_membership FROM public.syndicate_memberships WHERE id = NEW.membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
  IF v_membership.user_id <> NEW.user_id THEN RAISE EXCEPTION 'user_id mismatch'; END IF;
  IF v_membership.syndicate_id <> NEW.syndicate_id THEN RAISE EXCEPTION 'syndicate mismatch'; END IF;
  IF NEW.share_index > v_membership.shares THEN
    RAISE EXCEPTION 'share_index exceeds purchased shares';
  END IF;

  v_fmt := COALESCE(v_lottery.number_format, '{"main":{"count":6,"min":1,"max":49},"bonus":{"count":0,"min":0,"max":0}}'::jsonb);
  v_main_count := COALESCE((v_fmt->'main'->>'count')::int, 6);
  v_main_min   := COALESCE((v_fmt->'main'->>'min')::int, 1);
  v_main_max   := COALESCE((v_fmt->'main'->>'max')::int, 49);
  v_bonus_count := COALESCE((v_fmt->'bonus'->>'count')::int, 0);
  v_bonus_min   := COALESCE((v_fmt->'bonus'->>'min')::int, 0);
  v_bonus_max   := COALESCE((v_fmt->'bonus'->>'max')::int, 0);

  IF array_length(NEW.main_numbers, 1) IS DISTINCT FROM v_main_count THEN
    RAISE EXCEPTION 'Expected % main numbers, got %', v_main_count, COALESCE(array_length(NEW.main_numbers,1),0);
  END IF;
  IF COALESCE(array_length(NEW.bonus_numbers, 1), 0) <> v_bonus_count THEN
    RAISE EXCEPTION 'Expected % bonus numbers, got %', v_bonus_count, COALESCE(array_length(NEW.bonus_numbers,1),0);
  END IF;

  -- Range + uniqueness check (main)
  IF (SELECT count(DISTINCT x) FROM unnest(NEW.main_numbers) AS x) <> v_main_count THEN
    RAISE EXCEPTION 'Main numbers must be unique';
  END IF;
  FOREACH v_n IN ARRAY NEW.main_numbers LOOP
    IF v_n < v_main_min OR v_n > v_main_max THEN
      RAISE EXCEPTION 'Main number % outside range %-%', v_n, v_main_min, v_main_max;
    END IF;
  END LOOP;

  IF v_bonus_count > 0 THEN
    IF (SELECT count(DISTINCT x) FROM unnest(NEW.bonus_numbers) AS x) <> v_bonus_count THEN
      RAISE EXCEPTION 'Bonus numbers must be unique';
    END IF;
    FOREACH v_n IN ARRAY NEW.bonus_numbers LOOP
      IF v_n < v_bonus_min OR v_n > v_bonus_max THEN
        RAISE EXCEPTION 'Bonus number % outside range %-%', v_n, v_bonus_min, v_bonus_max;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_syndicate_pick ON public.syndicate_picks;
CREATE TRIGGER trg_validate_syndicate_pick
  BEFORE INSERT OR UPDATE ON public.syndicate_picks
  FOR EACH ROW EXECUTE FUNCTION public.validate_syndicate_pick();

-- 5. RLS policies
DROP POLICY IF EXISTS "Members view own picks" ON public.syndicate_picks;
CREATE POLICY "Members view own picks" ON public.syndicate_picks
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Members insert own picks" ON public.syndicate_picks;
CREATE POLICY "Members insert own picks" ON public.syndicate_picks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members update own picks" ON public.syndicate_picks;
CREATE POLICY "Members update own picks" ON public.syndicate_picks
  FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Members delete own picks" ON public.syndicate_picks;
CREATE POLICY "Members delete own picks" ON public.syndicate_picks
  FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 6. Helper view for admin
CREATE OR REPLACE VIEW public.syndicate_picks_summary AS
SELECT
  s.id AS syndicate_id,
  s.name AS syndicate_name,
  s.slug AS syndicate_slug,
  count(p.*) AS total_picks,
  count(*) FILTER (WHERE p.status = 'pending') AS pending_picks,
  count(*) FILTER (WHERE p.status = 'included') AS included_picks,
  count(*) FILTER (WHERE p.status = 'quick_picked') AS quick_picked
FROM public.syndicates s
LEFT JOIN public.syndicate_picks p ON p.syndicate_id = s.id
GROUP BY s.id, s.name, s.slug;

-- 7. quick_pick_for_lottery
CREATE OR REPLACE FUNCTION public.quick_pick_for_lottery(_lottery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fmt jsonb;
  v_mc int; v_mmin int; v_mmax int;
  v_bc int; v_bmin int; v_bmax int;
  v_main int[]; v_bonus int[];
BEGIN
  SELECT number_format INTO v_fmt FROM public.lotteries WHERE id = _lottery_id;
  IF v_fmt IS NULL THEN
    v_fmt := '{"main":{"count":6,"min":1,"max":49},"bonus":{"count":0,"min":0,"max":0}}'::jsonb;
  END IF;
  v_mc := (v_fmt->'main'->>'count')::int; v_mmin := (v_fmt->'main'->>'min')::int; v_mmax := (v_fmt->'main'->>'max')::int;
  v_bc := COALESCE((v_fmt->'bonus'->>'count')::int,0); v_bmin := COALESCE((v_fmt->'bonus'->>'min')::int,0); v_bmax := COALESCE((v_fmt->'bonus'->>'max')::int,0);

  SELECT array_agg(n ORDER BY n) INTO v_main FROM (
    SELECT DISTINCT (v_mmin + floor(random()*(v_mmax - v_mmin + 1))::int) AS n
    FROM generate_series(1, v_mc * 4)
    LIMIT v_mc
  ) t;

  IF v_bc > 0 THEN
    SELECT array_agg(n ORDER BY n) INTO v_bonus FROM (
      SELECT DISTINCT (v_bmin + floor(random()*(v_bmax - v_bmin + 1))::int) AS n
      FROM generate_series(1, v_bc * 4)
      LIMIT v_bc
    ) t;
  ELSE
    v_bonus := '{}'::int[];
  END IF;

  RETURN jsonb_build_object('main', v_main, 'bonus', v_bonus);
END;
$$;

-- 8. upsert_syndicate_picks RPC
CREATE OR REPLACE FUNCTION public.upsert_syndicate_picks(_membership_id uuid, _picks jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_membership public.syndicate_memberships%ROWTYPE;
  v_pick jsonb;
  v_share int;
  v_main int[]; v_bonus int[];
  v_count int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_membership FROM public.syndicate_memberships WHERE id = _membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;
  IF v_membership.user_id <> v_user AND NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'Not your membership';
  END IF;

  -- Replace existing picks for this membership
  DELETE FROM public.syndicate_picks WHERE membership_id = _membership_id;

  IF _picks IS NULL OR jsonb_typeof(_picks) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR v_pick IN SELECT * FROM jsonb_array_elements(_picks) LOOP
    v_share := (v_pick->>'share_index')::int;
    SELECT array_agg((x)::int) INTO v_main FROM jsonb_array_elements_text(v_pick->'main') AS x;
    IF v_pick ? 'bonus' AND jsonb_typeof(v_pick->'bonus') = 'array' THEN
      SELECT array_agg((x)::int) INTO v_bonus FROM jsonb_array_elements_text(v_pick->'bonus') AS x;
    ELSE
      v_bonus := '{}'::int[];
    END IF;

    INSERT INTO public.syndicate_picks
      (syndicate_id, membership_id, user_id, share_index, main_numbers, bonus_numbers, status)
    VALUES
      (v_membership.syndicate_id, _membership_id, v_membership.user_id, v_share,
       COALESCE(v_main,'{}'::int[]), COALESCE(v_bonus,'{}'::int[]), 'pending');
    v_count := v_count + 1;
  END LOOP;

  -- Optional: feed event
  INSERT INTO public.feed_posts (user_id, kind, body, metadata)
  SELECT v_membership.user_id, 'system_picks',
         'locked in ' || v_count || ' Lucky Pick(s) for ' || COALESCE(s.name, 'a group ticket'),
         jsonb_build_object('syndicate_id', s.id, 'syndicate_slug', s.slug, 'count', v_count)
  FROM public.syndicates s WHERE s.id = v_membership.syndicate_id AND v_count > 0;

  RETURN v_count;
END;
$$;
