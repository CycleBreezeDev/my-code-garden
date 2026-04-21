ALTER TABLE public.withdrawal_configs
  ADD COLUMN IF NOT EXISTS daily_limit numeric DEFAULT NULL;