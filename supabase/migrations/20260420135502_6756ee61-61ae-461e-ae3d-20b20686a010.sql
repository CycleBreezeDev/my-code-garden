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

CREATE POLICY "FX rates are publicly readable"
  ON public.fx_rates FOR SELECT USING (true);

CREATE POLICY "Admins manage fx rates"
  ON public.fx_rates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

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

CREATE POLICY "FX pairs are publicly readable"
  ON public.fx_pairs FOR SELECT USING (true);

CREATE POLICY "Admins manage fx pairs"
  ON public.fx_pairs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_fx_pairs_updated
  BEFORE UPDATE ON public.fx_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.withdrawal_requests
  ADD COLUMN source_currency TEXT,
  ADD COLUMN source_amount NUMERIC(14,2),
  ADD COLUMN fx_rate NUMERIC(18,8),
  ADD COLUMN fx_markup_percent NUMERIC(6,3);

-- Seed default markup for common pairs
INSERT INTO public.fx_pairs (base_currency, quote_currency, markup_percent) VALUES
  ('USD','NGN',2.0),('USD','GHS',2.0),('USD','KES',2.0),('USD','ZAR',2.0),
  ('NGN','USD',2.5),('GHS','USD',2.5),('KES','USD',2.5),('ZAR','USD',2.5),
  ('EUR','NGN',2.0),('GBP','NGN',2.0)
ON CONFLICT DO NOTHING;