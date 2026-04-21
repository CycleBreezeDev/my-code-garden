-- =========================
-- WALLETS
-- =========================
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

CREATE POLICY "Users view own wallets" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all wallets" ON public.wallets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage wallets" ON public.wallets
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- WALLET TRANSACTIONS
-- =========================
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  currency TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdrawal','payout_in','syndicate_spend','refund','fee','adjustment','hold','release')),
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

CREATE POLICY "Users view own transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all transactions" ON public.wallet_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage transactions" ON public.wallet_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- WITHDRAWAL REQUESTS
-- =========================
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawals_user ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX idx_withdrawals_status ON public.withdrawal_requests(status);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all withdrawals" ON public.withdrawal_requests
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage withdrawals" ON public.withdrawal_requests
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- PAYOUT RECIPIENTS (saved beneficiaries)
-- =========================
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

CREATE POLICY "Users view own recipients" ON public.payout_recipients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recipients" ON public.payout_recipients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recipients" ON public.payout_recipients
  FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- WALLET FUNCTIONS
-- =========================

-- Credit wallet (idempotent on provider+provider_ref via unique index)
CREATE OR REPLACE FUNCTION public.wallet_credit(
  _user_id UUID,
  _currency TEXT,
  _amount NUMERIC,
  _kind TEXT,
  _reference TEXT DEFAULT NULL,
  _provider TEXT DEFAULT NULL,
  _provider_ref TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_tx_id UUID;
  v_new_balance NUMERIC(14,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Idempotency check
  IF _provider_ref IS NOT NULL THEN
    SELECT id INTO v_tx_id FROM public.wallet_transactions
      WHERE provider = _provider AND provider_ref = _provider_ref;
    IF FOUND THEN RETURN v_tx_id; END IF;
  END IF;

  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (_user_id, _currency, 0)
  ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;

  v_new_balance := v_wallet.available_balance + _amount;

  UPDATE public.wallets
    SET available_balance = v_new_balance,
        lifetime_deposit = CASE WHEN _kind IN ('deposit','payout_in') THEN lifetime_deposit + _amount ELSE lifetime_deposit END
    WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
  VALUES
    (_user_id, _currency, _kind, _amount, v_new_balance, _reference, _provider, _provider_ref, 'completed', _metadata)
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- Debit + create withdrawal in one atomic step
CREATE OR REPLACE FUNCTION public.wallet_debit_for_withdrawal(
  _user_id UUID,
  _currency TEXT,
  _amount NUMERIC,
  _fee NUMERIC,
  _destination_type TEXT,
  _destination JSONB,
  _provider TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_withdrawal_id UUID;
  v_net NUMERIC(14,2);
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  v_net := _amount - COALESCE(_fee, 0);
  IF v_net <= 0 THEN RAISE EXCEPTION 'Net amount must be positive'; END IF;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = _user_id AND currency = _currency FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  IF v_wallet.available_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
    SET available_balance = available_balance - _amount,
        pending_balance = pending_balance + _amount
    WHERE id = v_wallet.id;

  INSERT INTO public.withdrawal_requests
    (user_id, currency, amount, fee, net_amount, destination_type, destination, provider, status)
  VALUES
    (_user_id, _currency, _amount, COALESCE(_fee,0), v_net, _destination_type, _destination, _provider, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES
    (_user_id, _currency, 'hold', -_amount, v_wallet.available_balance - _amount, v_withdrawal_id::text, 'completed',
     jsonb_build_object('withdrawal_id', v_withdrawal_id));

  RETURN v_withdrawal_id;
END;
$$;

-- Finalize withdrawal (paid releases pending, failed/rejected refunds)
CREATE OR REPLACE FUNCTION public.wallet_finalize_withdrawal(
  _withdrawal_id UUID,
  _status TEXT,
  _provider_ref TEXT DEFAULT NULL,
  _failure_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w public.withdrawal_requests%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
BEGIN
  IF _status NOT IN ('paid','failed','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_w FROM public.withdrawal_requests WHERE id = _withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF v_w.status IN ('paid','failed','rejected') THEN RETURN; END IF;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_w.user_id AND currency = v_w.currency FOR UPDATE;

  IF _status = 'paid' THEN
    UPDATE public.wallets
      SET pending_balance = pending_balance - v_w.amount,
          lifetime_withdrawn = lifetime_withdrawn + v_w.amount
      WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions
      (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
    VALUES
      (v_w.user_id, v_w.currency, 'withdrawal', -v_w.amount, v_wallet.available_balance, _withdrawal_id::text,
       v_w.provider, _provider_ref, 'completed', jsonb_build_object('withdrawal_id', _withdrawal_id));
  ELSE
    -- refund
    UPDATE public.wallets
      SET pending_balance = pending_balance - v_w.amount,
          available_balance = available_balance + v_w.amount
      WHERE id = v_wallet.id;

    INSERT INTO public.wallet_transactions
      (user_id, currency, kind, amount, balance_after, reference, provider, provider_ref, status, metadata)
    VALUES
      (v_w.user_id, v_w.currency, 'refund', v_w.amount, v_wallet.available_balance + v_w.amount, _withdrawal_id::text,
       v_w.provider, _provider_ref, 'completed',
       jsonb_build_object('withdrawal_id', _withdrawal_id, 'reason', _failure_reason));
  END IF;

  UPDATE public.withdrawal_requests
    SET status = _status,
        provider_ref = COALESCE(_provider_ref, provider_ref),
        failure_reason = _failure_reason,
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = _withdrawal_id;
END;
$$;

-- Auto-credit wallet on payout insert
CREATE OR REPLACE FUNCTION public.credit_wallet_on_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  SELECT currency INTO v_currency FROM public.syndicates WHERE id = NEW.syndicate_id;
  IF v_currency IS NULL THEN v_currency := 'USD'; END IF;

  PERFORM public.wallet_credit(
    NEW.user_id,
    v_currency,
    NEW.net_amount,
    'payout_in',
    NEW.id::text,
    'system',
    'payout:' || NEW.id::text,
    jsonb_build_object('payout_id', NEW.id, 'syndicate_id', NEW.syndicate_id, 'draw_id', NEW.draw_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_wallet_on_payout
  AFTER INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.credit_wallet_on_payout();