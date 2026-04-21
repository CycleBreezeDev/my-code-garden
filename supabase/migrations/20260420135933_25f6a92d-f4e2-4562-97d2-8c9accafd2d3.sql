CREATE OR REPLACE FUNCTION public.wallet_join_syndicate(_syndicate_id uuid, _shares integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_syndicate public.syndicates%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_membership_id UUID;
  v_new_balance NUMERIC(14,2);
  v_reference TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN
    RAISE EXCEPTION 'Invalid share amount';
  END IF;

  SELECT * INTO v_syndicate FROM public.syndicates WHERE id = _syndicate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Syndicate not found'; END IF;
  IF v_syndicate.status <> 'open' THEN RAISE EXCEPTION 'Syndicate is not open'; END IF;
  IF v_syndicate.sold_shares + _shares > v_syndicate.total_shares THEN
    RAISE EXCEPTION 'Not enough shares available';
  END IF;

  v_amount := v_syndicate.price_per_share * _shares;

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_user AND currency = v_syndicate.currency FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found for currency %', v_syndicate.currency; END IF;
  IF v_wallet.available_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  v_reference := 'wallet:' || gen_random_uuid()::text;

  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid, payment_reference)
  VALUES (_syndicate_id, v_user, _shares, v_amount, v_reference)
  RETURNING id INTO v_membership_id;

  UPDATE public.syndicates
    SET sold_shares = sold_shares + _shares,
        status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END
    WHERE id = _syndicate_id;

  v_new_balance := v_wallet.available_balance - v_amount;

  UPDATE public.wallets
    SET available_balance = v_new_balance
    WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions
    (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES
    (v_user, v_syndicate.currency, 'syndicate_purchase', -v_amount, v_new_balance, v_membership_id::text, 'completed',
     jsonb_build_object('syndicate_id', _syndicate_id, 'membership_id', v_membership_id, 'shares', _shares));

  RETURN v_membership_id;
END;
$function$;