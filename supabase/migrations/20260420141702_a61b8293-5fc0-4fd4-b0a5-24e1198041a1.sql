-- FX-aware wallet join: debits source-currency wallet, records an FX conversion,
-- then credits the syndicate currency internally and joins.
-- Quote (rate + markup) is supplied by the client from a recent fx-quote response;
-- the server clamps gross slippage by re-checking the cached fx_rates and rejecting
-- if the supplied effective rate deviates by more than 5% from current.

CREATE OR REPLACE FUNCTION public.wallet_join_syndicate_fx(
  _syndicate_id uuid,
  _shares integer,
  _source_currency text,
  _quoted_rate numeric,
  _markup_percent numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_syndicate public.syndicates%ROWTYPE;
  v_src_wallet public.wallets%ROWTYPE;
  v_dst_wallet public.wallets%ROWTYPE;
  v_target_amount NUMERIC(12,2);  -- in syndicate currency
  v_source_amount NUMERIC(12,2);  -- in source currency (debited)
  v_effective_rate NUMERIC(18,8);
  v_membership_id UUID;
  v_new_src_balance NUMERIC(14,2);
  v_new_dst_balance NUMERIC(14,2);
  v_reference TEXT;
  v_current_rate NUMERIC(18,8);
  v_current_effective NUMERIC(18,8);
  v_drift NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN RAISE EXCEPTION 'Invalid share amount'; END IF;
  IF _source_currency IS NULL OR length(_source_currency) <> 3 THEN RAISE EXCEPTION 'Invalid source currency'; END IF;
  IF _quoted_rate IS NULL OR _quoted_rate <= 0 THEN RAISE EXCEPTION 'Invalid quote rate'; END IF;

  SELECT * INTO v_syndicate FROM public.syndicates WHERE id = _syndicate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Syndicate not found'; END IF;
  IF v_syndicate.status <> 'open' THEN RAISE EXCEPTION 'Syndicate is not open'; END IF;
  IF v_syndicate.sold_shares + _shares > v_syndicate.total_shares THEN
    RAISE EXCEPTION 'Not enough shares available';
  END IF;

  v_target_amount := v_syndicate.price_per_share * _shares;

  -- Same currency: just delegate to wallet_join_syndicate
  IF upper(_source_currency) = upper(v_syndicate.currency) THEN
    RETURN public.wallet_join_syndicate(_syndicate_id, _shares);
  END IF;

  -- Effective rate user receives per 1 unit of source: less due to markup
  v_effective_rate := _quoted_rate * (1 - COALESCE(_markup_percent, 0) / 100);
  IF v_effective_rate <= 0 THEN RAISE EXCEPTION 'Invalid effective rate'; END IF;

  -- Drift check vs cached rate (must exist in fx_rates from recent quote call)
  SELECT rate INTO v_current_rate
    FROM public.fx_rates
    WHERE base_currency = upper(_source_currency)
      AND quote_currency = upper(v_syndicate.currency)
    ORDER BY fetched_at DESC
    LIMIT 1;
  IF v_current_rate IS NULL THEN
    RAISE EXCEPTION 'No FX rate available — refresh quote';
  END IF;
  v_current_effective := v_current_rate * (1 - COALESCE(_markup_percent, 0) / 100);
  v_drift := abs(v_current_effective - v_effective_rate) / v_current_effective;
  IF v_drift > 0.05 THEN
    RAISE EXCEPTION 'Quote expired — please refresh (rate moved %.2f%%)', v_drift * 100;
  END IF;

  -- source amount = how much source currency we must debit to deliver target
  v_source_amount := round(v_target_amount / v_effective_rate, 2);
  IF v_source_amount <= 0 THEN RAISE EXCEPTION 'Computed source amount invalid'; END IF;

  -- Lock source wallet
  SELECT * INTO v_src_wallet FROM public.wallets
    WHERE user_id = v_user AND currency = upper(_source_currency) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source wallet not found for %', _source_currency; END IF;
  IF v_src_wallet.available_balance < v_source_amount THEN
    RAISE EXCEPTION 'Insufficient balance in % wallet', _source_currency;
  END IF;

  -- Ensure destination wallet exists
  INSERT INTO public.wallets (user_id, currency, available_balance)
    VALUES (v_user, upper(v_syndicate.currency), 0)
    ON CONFLICT (user_id, currency) DO NOTHING;
  SELECT * INTO v_dst_wallet FROM public.wallets
    WHERE user_id = v_user AND currency = upper(v_syndicate.currency) FOR UPDATE;

  v_reference := 'wallet-fx:' || gen_random_uuid()::text;

  -- 1) Debit source
  v_new_src_balance := v_src_wallet.available_balance - v_source_amount;
  UPDATE public.wallets SET available_balance = v_new_src_balance WHERE id = v_src_wallet.id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES
    (v_user, v_src_wallet.currency, 'fx_debit', -v_source_amount, v_new_src_balance, v_reference, 'completed',
     jsonb_build_object(
       'syndicate_id', _syndicate_id,
       'fx_rate', _quoted_rate,
       'markup_percent', _markup_percent,
       'effective_rate', v_effective_rate,
       'source_currency', v_src_wallet.currency,
       'target_currency', v_dst_wallet.currency,
       'source_amount', v_source_amount,
       'target_amount', v_target_amount
     ));

  -- 2) Credit destination (internal conversion)
  v_new_dst_balance := v_dst_wallet.available_balance + v_target_amount;
  UPDATE public.wallets
    SET available_balance = v_new_dst_balance
    WHERE id = v_dst_wallet.id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES
    (v_user, v_dst_wallet.currency, 'fx_credit', v_target_amount, v_new_dst_balance, v_reference, 'completed',
     jsonb_build_object(
       'syndicate_id', _syndicate_id,
       'fx_rate', _quoted_rate,
       'markup_percent', _markup_percent,
       'effective_rate', v_effective_rate,
       'source_currency', v_src_wallet.currency,
       'target_currency', v_dst_wallet.currency,
       'source_amount', v_source_amount,
       'target_amount', v_target_amount
     ));

  -- 3) Create membership
  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid, payment_reference)
  VALUES (_syndicate_id, v_user, _shares, v_target_amount, v_reference)
  RETURNING id INTO v_membership_id;

  UPDATE public.syndicates
    SET sold_shares = sold_shares + _shares,
        status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END
    WHERE id = _syndicate_id;

  -- 4) Debit destination for syndicate purchase (mirrors wallet_join_syndicate trail)
  v_new_dst_balance := v_new_dst_balance - v_target_amount;
  UPDATE public.wallets SET available_balance = v_new_dst_balance WHERE id = v_dst_wallet.id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES
    (v_user, v_dst_wallet.currency, 'syndicate_purchase', -v_target_amount, v_new_dst_balance, v_membership_id::text, 'completed',
     jsonb_build_object(
       'syndicate_id', _syndicate_id,
       'membership_id', v_membership_id,
       'shares', _shares,
       'fx_reference', v_reference
     ));

  RETURN v_membership_id;
END;
$function$;