-- Add missing columns required by Play Lottery and Play Group Ticket pages.
-- These migrations were authored previously but never applied; reapply idempotently.

-- 1. number_format on lotteries (drives the Play Lottery picker)
ALTER TABLE public.lotteries
  ADD COLUMN IF NOT EXISTS number_format jsonb NOT NULL
  DEFAULT '{"main":{"count":6,"min":1,"max":49},"bonus":{"count":0,"min":0,"max":0}}'::jsonb;

-- 2. price_per_line on lotteries (Play Lottery purchase math)
ALTER TABLE public.lotteries
  ADD COLUMN IF NOT EXISTS price_per_line numeric NOT NULL DEFAULT 4.99;

-- 3. picks_lock_offset_minutes on syndicates (Group Ticket Lucky Picks lock window)
ALTER TABLE public.syndicates
  ADD COLUMN IF NOT EXISTS picks_lock_offset_minutes integer NOT NULL DEFAULT 120;

-- Backfill known lotteries with realistic number formats
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":69},"bonus":{"count":1,"min":1,"max":26}}'::jsonb
  WHERE slug IN ('powerball','powerball-us','us-powerball');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":70},"bonus":{"count":1,"min":1,"max":25}}'::jsonb
  WHERE slug IN ('mega-millions','megamillions');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":50},"bonus":{"count":2,"min":1,"max":12}}'::jsonb
  WHERE slug IN ('euromillions');
UPDATE public.lotteries SET number_format = '{"main":{"count":6,"min":1,"max":59},"bonus":{"count":0,"min":0,"max":0}}'::jsonb
  WHERE slug IN ('uk-lotto','uk-national-lottery');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":50},"bonus":{"count":1,"min":1,"max":20}}'::jsonb
  WHERE slug IN ('sa-powerball','south-africa-powerball');
UPDATE public.lotteries SET number_format = '{"main":{"count":6,"min":1,"max":52},"bonus":{"count":0,"min":0,"max":0}}'::jsonb
  WHERE slug IN ('sa-lotto','south-africa-lotto');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":52},"bonus":{"count":1,"min":1,"max":10}}'::jsonb
  WHERE slug IN ('lotto-america');
UPDATE public.lotteries SET number_format = '{"main":{"count":5,"min":1,"max":49},"bonus":{"count":2,"min":1,"max":10}}'::jsonb
  WHERE slug IN ('france-loto','loto');

-- Fix the data bug visible on production: "Tuesday Night powerball" syndicate
-- is attached to the EuroMillions draw, which is why the Group Tickets page
-- shows "€0". Repoint it to the next upcoming Powerball draw if one exists,
-- otherwise leave alone (admin can fix manually).
DO $$
DECLARE
  v_pb_draw uuid;
BEGIN
  SELECT d.id INTO v_pb_draw
  FROM public.lottery_draws d
  JOIN public.lotteries l ON l.id = d.lottery_id
  WHERE l.slug IN ('powerball','powerball-us')
    AND d.status = 'upcoming'
  ORDER BY d.draw_date ASC
  LIMIT 1;

  IF v_pb_draw IS NOT NULL THEN
    UPDATE public.syndicates
       SET draw_id = v_pb_draw, currency = 'USD'
     WHERE slug = 'tuesday-night-powerball'
       AND sold_shares = 0;
  END IF;
END $$;