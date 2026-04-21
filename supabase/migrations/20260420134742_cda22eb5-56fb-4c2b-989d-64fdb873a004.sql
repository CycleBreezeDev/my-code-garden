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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency, destination_type)
);

ALTER TABLE public.withdrawal_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configs are publicly readable"
  ON public.withdrawal_configs FOR SELECT USING (true);

CREATE POLICY "Admins manage configs"
  ON public.withdrawal_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wc_updated
  BEFORE UPDATE ON public.withdrawal_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.withdrawal_configs (currency, destination_type, min_amount, fee_flat, fee_percent, eta_label) VALUES
  ('NGN','ng_bank',500,50,0,'Within minutes'),
  ('NGN','paystack_account',500,0,0,'Instant'),
  ('NGN','flutterwave_account',500,0,0,'Instant'),
  ('GHS','gh_bank',10,1,0,'Within 1 hour'),
  ('KES','ke_bank',100,10,0,'Within 1 hour'),
  ('ZAR','za_bank',20,5,0.5,'1–2 business days'),
  ('USD','intl_bank',10,2,1.0,'2–5 business days'),
  ('EUR','intl_bank',10,2,1.0,'2–5 business days'),
  ('GBP','intl_bank',10,2,1.0,'2–5 business days'),
  ('USD','paypal',5,0,2.0,'1–3 business days'),
  ('EUR','paypal',5,0,2.0,'1–3 business days'),
  ('GBP','paypal',5,0,2.0,'1–3 business days');