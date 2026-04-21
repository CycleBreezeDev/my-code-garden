
-- ============= KYC TIERS =============
CREATE TABLE public.kyc_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier INTEGER NOT NULL UNIQUE CHECK (tier BETWEEN 0 AND 3),
  name TEXT NOT NULL,
  description TEXT,
  daily_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  requires_id BOOLEAN NOT NULL DEFAULT false,
  requires_selfie BOOLEAN NOT NULL DEFAULT false,
  requires_por BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tiers readable by authenticated"
  ON public.kyc_tiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage tiers"
  ON public.kyc_tiers FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER kyc_tiers_updated_at
  BEFORE UPDATE ON public.kyc_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.kyc_tiers (tier, name, description, daily_limit_usd, monthly_limit_usd, requires_id, requires_selfie, requires_por) VALUES
  (0, 'Unverified',  'New account — small grace cap to try the platform.',  50,    50,      false, false, false),
  (1, 'Basic',       'Government ID verified.',                              200,   500,     true,  false, false),
  (2, 'Verified',    'Government ID + live selfie match.',                   1000,  5000,    true,  true,  false),
  (3, 'Premium',     'Full KYC including proof of residence.',               10000, 50000,   true,  true,  true);

-- ============= KYC PROFILES =============
CREATE TABLE public.kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  tier INTEGER NOT NULL DEFAULT 0 REFERENCES public.kyc_tiers(tier) ON UPDATE CASCADE,
  status TEXT NOT NULL DEFAULT 'unverified', -- unverified | pending | approved | rejected
  country TEXT,                              -- ISO-2
  id_type TEXT,                              -- passport | national_id | drivers_license | bvn | nin | gh_card | ke_id | za_id
  id_number TEXT,
  full_name TEXT,
  dob DATE,
  selfie_verified_at TIMESTAMPTZ,
  por_verified_at TIMESTAMPTZ,
  last_provider TEXT,
  last_provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kyc profile"
  ON public.kyc_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all kyc profiles"
  ON public.kyc_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kyc profiles"
  ON public.kyc_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER kyc_profiles_updated_at
  BEFORE UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create Tier 0 profile for new users
CREATE OR REPLACE FUNCTION public.create_kyc_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kyc_profiles (user_id, tier, status)
  VALUES (NEW.id, 0, 'unverified')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_kyc
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_kyc_profile_for_new_user();

-- Backfill for any existing users
INSERT INTO public.kyc_profiles (user_id, tier, status)
SELECT u.id, 0, 'unverified'
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- ============= KYC DOCUMENTS =============
CREATE TABLE public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL, -- id_front | id_back | selfie | por
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded', -- uploaded | verified | rejected
  ocr_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kyc docs"
  ON public.kyc_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own kyc docs"
  ON public.kyc_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all kyc docs"
  ON public.kyc_documents FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kyc docs"
  ON public.kyc_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============= KYC CHECKS (audit) =============
CREATE TABLE public.kyc_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'smile_id',
  job_type TEXT NOT NULL, -- id_verification | document_verification | address_verification | webhook
  status TEXT NOT NULL,   -- pending | success | failed
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kyc_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kyc checks"
  ON public.kyc_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all kyc checks"
  ON public.kyc_checks FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kyc checks"
  ON public.kyc_checks FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-docs', 'kyc-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own kyc files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own kyc files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all kyc files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage kyc files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'kyc-docs' AND has_role(auth.uid(), 'admin'));

-- ============= LIMIT-ENFORCEMENT FUNCTION =============
-- Returns: { allowed, reason, tier, daily_limit, monthly_limit, used_daily_usd, used_monthly_usd, remaining_daily_usd, remaining_monthly_usd }
CREATE OR REPLACE FUNCTION public.kyc_can_transact(
  _user_id UUID,
  _amount_usd NUMERIC,
  _kind TEXT  -- 'topup' | 'withdrawal' | 'fx'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier INTEGER;
  v_status TEXT;
  v_daily NUMERIC;
  v_monthly NUMERIC;
  v_used_daily NUMERIC := 0;
  v_used_monthly NUMERIC := 0;
  v_kinds TEXT[];
BEGIN
  IF _kind NOT IN ('topup','withdrawal','fx') THEN
    RAISE EXCEPTION 'Invalid kind';
  END IF;

  SELECT p.tier, p.status INTO v_tier, v_status
  FROM public.kyc_profiles p WHERE p.user_id = _user_id;

  IF v_tier IS NULL THEN
    v_tier := 0;
    v_status := 'unverified';
  END IF;

  SELECT t.daily_limit_usd, t.monthly_limit_usd INTO v_daily, v_monthly
  FROM public.kyc_tiers t WHERE t.tier = v_tier;

  -- Which transaction kinds count toward limits
  v_kinds := ARRAY['topup','withdrawal','fx'];

  SELECT COALESCE(SUM((metadata->>'usd_amount')::NUMERIC), 0) INTO v_used_daily
  FROM public.wallet_transactions
  WHERE user_id = _user_id
    AND created_at >= now() - interval '24 hours'
    AND (metadata->>'kyc_kind') = ANY (v_kinds)
    AND status IN ('pending','completed');

  SELECT COALESCE(SUM((metadata->>'usd_amount')::NUMERIC), 0) INTO v_used_monthly
  FROM public.wallet_transactions
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now())
    AND (metadata->>'kyc_kind') = ANY (v_kinds)
    AND status IN ('pending','completed');

  RETURN jsonb_build_object(
    'allowed', (_amount_usd <= GREATEST(0, v_daily - v_used_daily)) AND (_amount_usd <= GREATEST(0, v_monthly - v_used_monthly)),
    'tier', v_tier,
    'status', v_status,
    'daily_limit_usd', v_daily,
    'monthly_limit_usd', v_monthly,
    'used_daily_usd', v_used_daily,
    'used_monthly_usd', v_used_monthly,
    'remaining_daily_usd', GREATEST(0, v_daily - v_used_daily),
    'remaining_monthly_usd', GREATEST(0, v_monthly - v_used_monthly),
    'requested_usd', _amount_usd
  );
END;
$$;

-- ============= TIER BUMP =============
CREATE OR REPLACE FUNCTION public.kyc_bump_tier(
  _user_id UUID,
  _tier INTEGER,
  _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _tier NOT BETWEEN 0 AND 3 THEN RAISE EXCEPTION 'Invalid tier'; END IF;

  UPDATE public.kyc_profiles
  SET tier = _tier,
      status = CASE WHEN _tier > 0 THEN 'approved' ELSE status END,
      rejection_reason = NULL,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.kyc_checks (user_id, provider, job_type, status, response_payload, initiated_by)
  VALUES (_user_id, 'system', 'tier_bump', 'success',
          jsonb_build_object('tier', _tier, 'reason', _reason),
          auth.uid());
END;
$$;
