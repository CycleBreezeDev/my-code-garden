CREATE TABLE public.lottery_jackpot_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id UUID NOT NULL REFERENCES public.lottery_feeds(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  jackpot_display TEXT,
  currency TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jackpot_history_feed_time
  ON public.lottery_jackpot_history (feed_id, captured_at DESC);

ALTER TABLE public.lottery_jackpot_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jackpot history is publicly readable"
ON public.lottery_jackpot_history
FOR SELECT
USING (true);

CREATE POLICY "Admins manage jackpot history"
ON public.lottery_jackpot_history
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));