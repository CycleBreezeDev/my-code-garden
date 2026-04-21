CREATE OR REPLACE FUNCTION public.join_syndicate(_syndicate_id uuid, _shares integer, _reference text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  -- Idempotency: same Paystack reference should never create a 2nd membership
  IF _reference IS NOT NULL THEN
    SELECT id INTO v_membership_id
    FROM public.syndicate_memberships
    WHERE payment_reference = _reference;
    IF FOUND THEN
      RETURN v_membership_id;
    END IF;
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

  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid, payment_reference)
  VALUES (_syndicate_id, v_user, _shares, v_amount, _reference)
  RETURNING id INTO v_membership_id;

  UPDATE public.syndicates
  SET sold_shares = sold_shares + _shares,
      status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END
  WHERE id = _syndicate_id;

  RETURN v_membership_id;
END;
$function$;