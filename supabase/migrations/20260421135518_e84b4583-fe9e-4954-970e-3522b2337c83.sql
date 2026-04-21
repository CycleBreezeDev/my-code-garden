
-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.lotteries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT,
  logo_key TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lotteries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lotteries are publicly readable"
  ON public.lotteries FOR SELECT USING (true);

CREATE TABLE public.lottery_draws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lottery_id UUID NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  draw_date TIMESTAMPTZ NOT NULL,
  jackpot_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_draws_lottery ON public.lottery_draws(lottery_id);
CREATE INDEX idx_draws_date ON public.lottery_draws(draw_date);

ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Draws are publicly readable"
  ON public.lottery_draws FOR SELECT USING (true);

CREATE TABLE public.syndicates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  draw_id UUID NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  total_shares INT NOT NULL CHECK (total_shares > 0),
  sold_shares INT NOT NULL DEFAULT 0 CHECK (sold_shares >= 0),
  price_per_share NUMERIC(10,2) NOT NULL CHECK (price_per_share >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shares_within_total CHECK (sold_shares <= total_shares)
);

CREATE INDEX idx_syndicates_draw ON public.syndicates(draw_id);

ALTER TABLE public.syndicates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Syndicates are publicly readable"
  ON public.syndicates FOR SELECT USING (true);

CREATE TABLE public.syndicate_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shares INT NOT NULL CHECK (shares > 0),
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memberships_user ON public.syndicate_memberships(user_id);
CREATE INDEX idx_memberships_syndicate ON public.syndicate_memberships(syndicate_id);

ALTER TABLE public.syndicate_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memberships"
  ON public.syndicate_memberships FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.draw_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID NOT NULL UNIQUE REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  winning_numbers INT[] NOT NULL,
  bonus_numbers INT[],
  total_winners INT NOT NULL DEFAULT 0,
  jackpot_won NUMERIC(18,2),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.draw_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Results are publicly readable"
  ON public.draw_results FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.join_syndicate(_syndicate_id UUID, _shares INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_syndicate public.syndicates%ROWTYPE;
  v_membership_id UUID;
  v_amount NUMERIC(10,2);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN
    RAISE EXCEPTION 'Invalid share amount';
  END IF;

  SELECT * INTO v_syndicate FROM public.syndicates WHERE id = _syndicate_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Syndicate not found';
  END IF;

  IF v_syndicate.status <> 'open' THEN
    RAISE EXCEPTION 'Syndicate is not open';
  END IF;

  IF v_syndicate.sold_shares + _shares > v_syndicate.total_shares THEN
    RAISE EXCEPTION 'Not enough shares available';
  END IF;

  v_amount := v_syndicate.price_per_share * _shares;

  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid)
  VALUES (_syndicate_id, v_user, _shares, v_amount)
  RETURNING id INTO v_membership_id;

  UPDATE public.syndicates
  SET sold_shares = sold_shares + _shares,
      status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END
  WHERE id = _syndicate_id;

  RETURN v_membership_id;
END;
$$;
