CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage lotteries"
ON public.lotteries FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage draws"
ON public.lottery_draws FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage syndicates"
ON public.syndicates FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage draw results"
ON public.draw_results FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.syndicate_memberships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  shares INTEGER NOT NULL,
  gross_prize NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draw_id, membership_id)
);

CREATE INDEX idx_payouts_user ON public.payouts(user_id);
CREATE INDEX idx_payouts_draw ON public.payouts(draw_id);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payouts"
ON public.payouts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts"
ON public.payouts FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage payouts"
ON public.payouts FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.publish_draw_results(
  _draw_id UUID,
  _winning_numbers INTEGER[],
  _bonus_numbers INTEGER[],
  _prizes JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_id UUID;
  v_total_winners INTEGER := 0;
  v_jackpot NUMERIC(12,2) := 0;
  v_prize JSONB;
  v_syndicate_id UUID;
  v_gross NUMERIC(12,2);
  v_net_pool NUMERIC(12,2);
  v_total_shares INTEGER;
  v_membership RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can publish draw results';
  END IF;

  IF _winning_numbers IS NULL OR array_length(_winning_numbers, 1) IS NULL THEN
    RAISE EXCEPTION 'Winning numbers required';
  END IF;

  INSERT INTO public.draw_results (draw_id, winning_numbers, bonus_numbers, total_winners, jackpot_won)
  VALUES (_draw_id, _winning_numbers, _bonus_numbers, 0, 0)
  ON CONFLICT (draw_id) DO UPDATE
    SET winning_numbers = EXCLUDED.winning_numbers,
        bonus_numbers = EXCLUDED.bonus_numbers,
        published_at = now()
  RETURNING id INTO v_result_id;

  UPDATE public.lottery_draws SET status = 'completed' WHERE id = _draw_id;

  IF _prizes IS NOT NULL THEN
    FOR v_prize IN SELECT * FROM jsonb_array_elements(_prizes)
    LOOP
      v_syndicate_id := (v_prize->>'syndicate_id')::UUID;
      v_gross := COALESCE((v_prize->>'gross_prize')::NUMERIC, 0);

      IF v_gross <= 0 THEN CONTINUE; END IF;

      IF NOT EXISTS (SELECT 1 FROM public.syndicates WHERE id = v_syndicate_id AND draw_id = _draw_id) THEN
        RAISE EXCEPTION 'Syndicate % does not belong to draw %', v_syndicate_id, _draw_id;
      END IF;

      SELECT COALESCE(SUM(shares), 0) INTO v_total_shares
      FROM public.syndicate_memberships WHERE syndicate_id = v_syndicate_id;

      IF v_total_shares = 0 THEN CONTINUE; END IF;

      v_net_pool := ROUND(v_gross * 0.90, 2);
      v_jackpot := v_jackpot + v_gross;

      FOR v_membership IN
        SELECT id, user_id, shares
        FROM public.syndicate_memberships
        WHERE syndicate_id = v_syndicate_id
      LOOP
        DECLARE
          v_member_net NUMERIC(12,2);
          v_member_gross NUMERIC(12,2);
          v_member_fee NUMERIC(12,2);
        BEGIN
          v_member_net := ROUND(v_net_pool * v_membership.shares / v_total_shares, 2);
          v_member_gross := ROUND(v_gross * v_membership.shares / v_total_shares, 2);
          v_member_fee := ROUND(v_member_gross - v_member_net, 2);

          INSERT INTO public.payouts (
            draw_id, syndicate_id, membership_id, user_id,
            shares, gross_prize, platform_fee, net_amount
          ) VALUES (
            _draw_id, v_syndicate_id, v_membership.id, v_membership.user_id,
            v_membership.shares, v_member_gross, v_member_fee, v_member_net
          )
          ON CONFLICT (draw_id, membership_id) DO UPDATE
            SET gross_prize = EXCLUDED.gross_prize,
                platform_fee = EXCLUDED.platform_fee,
                net_amount = EXCLUDED.net_amount,
                shares = EXCLUDED.shares;

          v_total_winners := v_total_winners + 1;
        END;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.draw_results
  SET total_winners = v_total_winners, jackpot_won = v_jackpot
  WHERE id = v_result_id;

  RETURN v_result_id;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_draw_results_draw_id ON public.draw_results(draw_id);

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;