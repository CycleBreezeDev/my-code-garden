
-- Extensions for scheduling HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Feeds table
CREATE TABLE public.lottery_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  estimated_jackpot NUMERIC(14,2),
  jackpot_display TEXT,
  next_draw_at TIMESTAMPTZ,
  draw_schedule TEXT,
  source_url TEXT NOT NULL,
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lottery_feeds_order ON public.lottery_feeds(display_order);

ALTER TABLE public.lottery_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lottery feeds are publicly readable"
ON public.lottery_feeds FOR SELECT USING (true);

CREATE POLICY "Admins manage lottery feeds"
ON public.lottery_feeds FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_lottery_feeds_updated
BEFORE UPDATE ON public.lottery_feeds
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 8 lotteries
INSERT INTO public.lottery_feeds (slug, name, country, currency, source_url, display_order, draw_schedule) VALUES
  ('powerball-us',    'Powerball',         'US', 'USD', 'https://www.powerball.com/',                                          1, 'Mon, Wed & Sat'),
  ('mega-millions',   'Mega Millions',     'US', 'USD', 'https://www.megamillions.com/',                                       2, 'Tue & Fri'),
  ('euromillions',    'EuroMillions',      'EU', 'EUR', 'https://www.euro-millions.com/',                                      3, 'Tue & Fri'),
  ('uk-lotto',        'UK Lotto',          'UK', 'GBP', 'https://www.national-lottery.co.uk/games/lotto',                      4, 'Wed & Sat'),
  ('france-loto',     'Loto',              'FR', 'EUR', 'https://www.fdj.fr/jeux-de-tirage/loto',                              5, 'Mon, Wed & Sat'),
  ('lotto-america',   'Lotto America',     'US', 'USD', 'https://www.lottoamerica.com/',                                       6, 'Mon, Wed & Sat'),
  ('sa-lotto',        'SA Lotto',          'ZA', 'ZAR', 'https://www.nationallottery.co.za/lotto/results',                     7, 'Wed & Sat'),
  ('sa-powerball',    'SA Powerball',      'ZA', 'ZAR', 'https://www.nationallottery.co.za/powerball/results',                 8, 'Tue & Fri');
