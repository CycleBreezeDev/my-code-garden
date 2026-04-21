-- Track which Paystack reference created the membership (idempotency)
ALTER TABLE public.syndicate_memberships
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS syndicate_memberships_payment_reference_key
ON public.syndicate_memberships (payment_reference)
WHERE payment_reference IS NOT NULL;

-- Server-side join function for the webhook (no auth context).
-- Returns the membership id; if a membership for this reference already
-- exists, returns it without creating a duplicate.
CREATE OR REPLACE FUNCTION public.join_syndicate_for_user(
  _user_id UUID,
  _syndicate_id UUID,
  _shares INTEGER,
  _reference TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_syndicate public.syndicates%ROWTYPE;
  v_membership_id UUID;
  v_amount NUMERIC(10,2);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user';
  END IF;

  IF _shares IS NULL OR _shares <= 0 OR _shares > 100 THEN
    RAISE EXCEPTION 'Invalid share amount';
  END IF;

  -- Idempotency: if this Paystack reference already produced a membership, return it
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
  VALUES (_syndicate_id, _user_id, _shares, v_amount, _reference)
  RETURNING id INTO v_membership_id;

  UPDATE public.syndicates
  SET sold_shares = sold_shares + _shares,
      status = CASE WHEN sold_shares + _shares >= total_shares THEN 'full' ELSE status END
  WHERE id = _syndicate_id;

  RETURN v_membership_id;
END;
$$;