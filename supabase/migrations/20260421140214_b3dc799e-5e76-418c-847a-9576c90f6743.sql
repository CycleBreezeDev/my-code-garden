CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  currency TEXT NOT NULL,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_deposit NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);

CREATE INDEX idx_wallets_user ON public.wallets(user_id);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallets" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage wallets" ON public.wallets FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  currency TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','payout_in','syndicate_spend','syndicate_purchase','refund','fee','adjustment','hold','release','fx_debit','fx_credit')),
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2),
  reference TEXT,
  provider TEXT,
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
CREATE UNIQUE INDEX idx_wallet_tx_provider_ref ON public.wallet_transactions(provider, provider_ref) WHERE provider_ref IS NOT NULL;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.wallet_transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage transactions" ON public.wallet_transactions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  currency TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14,2) NOT NULL,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('ng_bank','gh_bank','ke_bank','za_bank','intl_bank','paypal','paystack_account','flutterwave_account')),
  destination JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT NOT NULL CHECK (provider IN ('paystack','flutterwave','manual')),
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','processing','paid','failed','rejected')),
  failure_reason TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  source_currency TEXT,
  source_amount NUMERIC(14,2),
  fx_rate NUMERIC(18,8),
  fx_markup_percent NUMERIC(6,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawals_user ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON public.withdrawal_requests(status);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all withdrawals" ON public.withdrawal_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_withdrawals_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payout_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  destination JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider TEXT,
  provider_recipient_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recipients_user ON public.payout_recipients(user_id);
ALTER TABLE public.payout_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recipients" ON public.payout_recipients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recipients" ON public.payout_recipients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own recipients" ON public.payout_recipients FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.wallet_credit(
  _user_id UUID, _currency TEXT, _amount NUMERIC, _kind TEXT,
  _reference TEXT DEFAULT NULL, _provider TEXT DEFAULT NULL,
  _provider_ref TEXT DEFAULT NULL, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet public.wallets%ROWTYPE; v_tx_id UUID; v_new_balance NUMERIC(14,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _provider_ref IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.wallet_transactions WHERE provider = _provider AND provider_ref = _provider_ref;
    IF FOUND THEN RETURN v_tx_id; END IF;
  END IF;
  INSERT INTO public.wallets (user_id, currency, available_balance) VALUES (_user_id, _currency, 0)
    ON CONFLICT (user_id, currency) DO NOTHING;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  v_new_balance := v_wallet.available_balance + _amount;
  UPDATE public.wallets SET available_balance = v_new_balance,
    lifetime_deposit = CASE WHEN _kind IN ('deposit','payout_in') THEN lifetime_deposit + _amount ELSE lifetime_deposit END
    WHERE id = v_wallet.id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
  VALUES (_user_id, _currency, _kind, _amount, v_new_balance, _reference, _provider, _provider_ref, 'completed', _metadata)
  RETURNING id INTO v_tx_id;
  RETURN v_tx_id;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_debit_for_withdrawal(
  _user_id UUID, _currency TEXT, _amount NUMERIC, _fee NUMERIC,
  _destination_type TEXT, _destination JSONB, _provider TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet public.wallets%ROWTYPE; v_withdrawal_id UUID; v_net NUMERIC(14,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  v_net := _amount - COALESCE(_fee, 0);
  IF v_net <= 0 THEN RAISE EXCEPTION 'Net amount must be positive'; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.available_balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET available_balance = available_balance - _amount, pending_balance = pending_balance + _amount WHERE id = v_wallet.id;
  INSERT INTO public.withdrawal_requests (user_id, currency, amount, fee, net_amount, destination_type, destination, provider, status)
  VALUES (_user_id, _currency, _amount, COALESCE(_fee,0), v_net, _destination_type, _destination, _provider, 'pending')
  RETURNING id INTO v_withdrawal_id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (_user_id, _currency, 'hold', -_amount, v_wallet.available_balance - _amount, v_withdrawal_id::text, 'completed',
    jsonb_build_object('withdrawal_id', v_withdrawal_id));
  RETURN v_withdrawal_id;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_finalize_withdrawal(
  _withdrawal_id UUID, _status TEXT, _provider_ref TEXT DEFAULT NULL, _failure_reason TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_w public.withdrawal_requests%ROWTYPE; v_wallet public.wallets%ROWTYPE;
BEGIN
  IF _status NOT IN ('paid','failed','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status IN ('paid','failed','rejected') THEN RETURN; END IF;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_w.user_id AND currency = v_w.currency FOR UPDATE;
  IF _status = 'paid' THEN
    UPDATE public.wallets SET pending_balance = pending_balance - v_w.amount, lifetime_withdrawn = lifetime_withdrawn + v_w.amount WHERE id = v_wallet.id;
    INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
    VALUES (v_w.user_id, v_w.currency, 'withdrawal', -v_w.amount, v_wallet.available_balance, _withdrawal_id::text, v_w.provider, _provider_ref, 'completed',
      jsonb_build_object('withdrawal_id', _withdrawal_id));
  ELSE
    UPDATE public.wallets SET pending_balance = pending_balance - v_w.amount, available_balance = available_balance + v_w.amount WHERE id = v_wallet.id;
    INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
    VALUES (v_w.user_id, v_w.currency, 'refund', v_w.amount, v_wallet.available_balance + v_w.amount, _withdrawal_id::text, v_w.provider, _provider_ref, 'completed',
      jsonb_build_object('withdrawal_id', _withdrawal_id, 'reason', _failure_reason));
  END IF;
  UPDATE public.withdrawal_requests SET status = _status, provider_ref = COALESCE(_provider_ref, provider_ref),
    failure_reason = _failure_reason, processed_at = now(), processed_by = auth.uid() WHERE id = _withdrawal_id;
END; $$;

CREATE OR REPLACE FUNCTION public.credit_wallet_on_payout() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_currency TEXT;
BEGIN
  SELECT currency INTO v_currency FROM public.syndicates WHERE id = NEW.syndicate_id;
  IF v_currency IS NULL THEN v_currency := 'USD'; END IF;
  PERFORM public.wallet_credit(NEW.user_id, v_currency, NEW.net_amount, 'payout_in', NEW.id::text, 'system', 'payout:' || NEW.id::text,
    jsonb_build_object('payout_id', NEW.id, 'syndicate_id', NEW.syndicate_id, 'draw_id', NEW.draw_id));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_credit_wallet_on_payout AFTER INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.credit_wallet_on_payout();

CREATE TABLE public.withdrawal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  min_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14,2),
  fee_flat NUMERIC(14,2) NOT NULL DEFAULT 0,
  fee_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  eta_label TEXT,
  daily_limit NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency, destination_type)
);
ALTER TABLE public.withdrawal_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Configs are publicly readable" ON public.withdrawal_configs FOR SELECT USING (true);
CREATE POLICY "Admins manage configs" ON public.withdrawal_configs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_wc_updated BEFORE UPDATE ON public.withdrawal_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.withdrawal_configs (currency, destination_type, min_amount, fee_flat, fee_percent, eta_label) VALUES
  ('NGN','ng_bank',500,50,0,'Within minutes'),
  ('NGN','paystack_account',500,0,0,'Instant'),
  ('NGN','flutterwave_account',500,0,0,'Instant'),
  ('GHS','gh_bank',10,1,0,'Within 1 hour'),
  ('KES','ke_bank',100,10,0,'Within 1 hour'),
  ('ZAR','za_bank',20,5,0.5,'1-2 business days'),
  ('USD','intl_bank',10,2,1.0,'2-5 business days'),
  ('EUR','intl_bank',10,2,1.0,'2-5 business days'),
  ('GBP','intl_bank',10,2,1.0,'2-5 business days'),
  ('USD','paypal',5,0,2.0,'1-3 business days'),
  ('EUR','paypal',5,0,2.0,'1-3 business days'),
  ('GBP','paypal',5,0,2.0,'1-3 business days');

CREATE TABLE public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  source TEXT NOT NULL DEFAULT 'exchangerate.host',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FX rates are publicly readable" ON public.fx_rates FOR SELECT USING (true);
CREATE POLICY "Admins manage fx rates" ON public.fx_rates FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.fx_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  markup_percent NUMERIC(6,3) NOT NULL DEFAULT 2.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency)
);
ALTER TABLE public.fx_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FX pairs are publicly readable" ON public.fx_pairs FOR SELECT USING (true);
CREATE POLICY "Admins manage fx pairs" ON public.fx_pairs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_fx_pairs_updated BEFORE UPDATE ON public.fx_pairs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fx_pairs (base_currency, quote_currency, markup_percent) VALUES
  ('USD','NGN',2.0),('USD','GHS',2.0),('USD','KES',2.0),('USD','ZAR',2.0),
  ('NGN','USD',2.5),('GHS','USD',2.5),('KES','USD',2.5),('ZAR','USD',2.5),
  ('EUR','NGN',2.0),('GBP','NGN',2.0)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.wallet_join_syndicate(_syndicate_id uuid, _shares integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user UUID := auth.uid(); v_syndicate public.syndicates%ROWTYPE; v_wallet public.wallets%ROWTYPE;
  v_amount NUMERIC(12,2); v_membership_id UUID; v_new_balance NUMERIC(14,2); v_reference TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN RAISE EXCEPTION 'Invalid share amount'; END IF;
  SELECT * INTO v_syndicate FROM public.syndicates WHERE id = _syndicate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Syndicate not found'; END IF;
  IF v_syndicate.status <> 'open' THEN RAISE EXCEPTION 'Syndicate is not open'; END IF;
  IF v_syndicate.sold_shares + _shares > v_syndicate.total_shares THEN RAISE EXCEPTION 'Not enough shares available'; END IF;
  v_amount := v_syndicate.price_per_share * _shares;
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user AND currency = v_syndicate.currency FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for currency %', v_syndicate.currency; END IF;
  IF v_wallet.available_balance < v_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  v_reference := 'wallet:' || gen_random_uuid()::text;
  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid, payment_reference)
  VALUES (_syndicate_id, v_user, _shares, v_amount, v_reference) RETURNING id INTO v_membership_id;
  UPDATE public.syndicates SET sold_shares = sold_shares + _shares,
    status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END WHERE id = _syndicate_id;
  v_new_balance := v_wallet.available_balance - v_amount;
  UPDATE public.wallets SET available_balance = v_new_balance WHERE id = v_wallet.id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (v_user, v_syndicate.currency, 'syndicate_purchase', -v_amount, v_new_balance, v_membership_id::text, 'completed',
    jsonb_build_object('syndicate_id', _syndicate_id, 'membership_id', v_membership_id, 'shares', _shares));
  RETURN v_membership_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.wallet_join_syndicate_fx(
  _syndicate_id uuid, _shares integer, _source_currency text, _quoted_rate numeric, _markup_percent numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user UUID := auth.uid(); v_syndicate public.syndicates%ROWTYPE;
  v_src_wallet public.wallets%ROWTYPE; v_dst_wallet public.wallets%ROWTYPE;
  v_target_amount NUMERIC(12,2); v_source_amount NUMERIC(12,2); v_effective_rate NUMERIC(18,8);
  v_membership_id UUID; v_new_src_balance NUMERIC(14,2); v_new_dst_balance NUMERIC(14,2);
  v_reference TEXT; v_current_rate NUMERIC(18,8); v_current_effective NUMERIC(18,8); v_drift NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN RAISE EXCEPTION 'Invalid share amount'; END IF;
  IF _source_currency IS NULL OR length(_source_currency) <> 3 THEN RAISE EXCEPTION 'Invalid source currency'; END IF;
  IF _quoted_rate IS NULL OR _quoted_rate <= 0 THEN RAISE EXCEPTION 'Invalid quote rate'; END IF;
  SELECT * INTO v_syndicate FROM public.syndicates WHERE id = _syndicate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Syndicate not found'; END IF;
  IF v_syndicate.status <> 'open' THEN RAISE EXCEPTION 'Syndicate is not open'; END IF;
  IF v_syndicate.sold_shares + _shares > v_syndicate.total_shares THEN RAISE EXCEPTION 'Not enough shares available'; END IF;
  v_target_amount := v_syndicate.price_per_share * _shares;
  IF upper(_source_currency) = upper(v_syndicate.currency) THEN
    RETURN public.wallet_join_syndicate(_syndicate_id, _shares);
  END IF;
  v_effective_rate := _quoted_rate * (1 - COALESCE(_markup_percent, 0) / 100);
  IF v_effective_rate <= 0 THEN RAISE EXCEPTION 'Invalid effective rate'; END IF;
  SELECT rate INTO v_current_rate FROM public.fx_rates
    WHERE base_currency = upper(_source_currency) AND quote_currency = upper(v_syndicate.currency)
    ORDER BY fetched_at DESC LIMIT 1;
  IF v_current_rate IS NULL THEN RAISE EXCEPTION 'No FX rate available - refresh quote'; END IF;
  v_current_effective := v_current_rate * (1 - COALESCE(_markup_percent, 0) / 100);
  v_drift := abs(v_current_effective - v_effective_rate) / v_current_effective;
  IF v_drift > 0.05 THEN RAISE EXCEPTION 'Quote expired - please refresh'; END IF;
  v_source_amount := round(v_target_amount / v_effective_rate, 2);
  IF v_source_amount <= 0 THEN RAISE EXCEPTION 'Computed source amount invalid'; END IF;
  SELECT * INTO v_src_wallet FROM public.wallets WHERE user_id = v_user AND currency = upper(_source_currency) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source wallet not found for %', _source_currency; END IF;
  IF v_src_wallet.available_balance < v_source_amount THEN RAISE EXCEPTION 'Insufficient balance in % wallet', _source_currency; END IF;
  INSERT INTO public.wallets (user_id, currency, available_balance) VALUES (v_user, upper(v_syndicate.currency), 0)
    ON CONFLICT (user_id, currency) DO NOTHING;
  SELECT * INTO v_dst_wallet FROM public.wallets WHERE user_id = v_user AND currency = upper(v_syndicate.currency) FOR UPDATE;
  v_reference := 'wallet-fx:' || gen_random_uuid()::text;
  v_new_src_balance := v_src_wallet.available_balance - v_source_amount;
  UPDATE public.wallets SET available_balance = v_new_src_balance WHERE id = v_src_wallet.id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (v_user, v_src_wallet.currency, 'fx_debit', -v_source_amount, v_new_src_balance, v_reference, 'completed',
    jsonb_build_object('syndicate_id', _syndicate_id, 'fx_rate', _quoted_rate, 'markup_percent', _markup_percent,
      'effective_rate', v_effective_rate, 'source_currency', v_src_wallet.currency, 'target_currency', v_dst_wallet.currency,
      'source_amount', v_source_amount, 'target_amount', v_target_amount));
  v_new_dst_balance := v_dst_wallet.available_balance + v_target_amount;
  UPDATE public.wallets SET available_balance = v_new_dst_balance WHERE id = v_dst_wallet.id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (v_user, v_dst_wallet.currency, 'fx_credit', v_target_amount, v_new_dst_balance, v_reference, 'completed',
    jsonb_build_object('syndicate_id', _syndicate_id, 'fx_rate', _quoted_rate, 'markup_percent', _markup_percent,
      'effective_rate', v_effective_rate, 'source_currency', v_src_wallet.currency, 'target_currency', v_dst_wallet.currency,
      'source_amount', v_source_amount, 'target_amount', v_target_amount));
  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid, payment_reference)
  VALUES (_syndicate_id, v_user, _shares, v_target_amount, v_reference) RETURNING id INTO v_membership_id;
  UPDATE public.syndicates SET sold_shares = sold_shares + _shares,
    status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END WHERE id = _syndicate_id;
  v_new_dst_balance := v_new_dst_balance - v_target_amount;
  UPDATE public.wallets SET available_balance = v_new_dst_balance WHERE id = v_dst_wallet.id;
  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (v_user, v_dst_wallet.currency, 'syndicate_purchase', -v_target_amount, v_new_dst_balance, v_membership_id::text, 'completed',
    jsonb_build_object('syndicate_id', _syndicate_id, 'membership_id', v_membership_id, 'shares', _shares, 'fx_reference', v_reference));
  RETURN v_membership_id;
END; $function$;