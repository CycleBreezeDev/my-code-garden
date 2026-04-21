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
ON public.lottery_jackpot_history FOR SELECT USING (true);

CREATE POLICY "Admins manage jackpot history"
ON public.lottery_jackpot_history FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT contact_submissions_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT contact_submissions_email_length CHECK (char_length(email) BETWEEN 3 AND 255),
  CONSTRAINT contact_submissions_subject_length CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT contact_submissions_message_length CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT contact_submissions_status_check CHECK (status IN ('new', 'read', 'archived'))
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_submissions FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update contact submissions"
  ON public.contact_submissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contact submissions"
  ON public.contact_submissions FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions (status);

CREATE TRIGGER trg_contact_submissions_updated_at
  BEFORE UPDATE ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions;

CREATE OR REPLACE FUNCTION public.sync_lottery_from_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lotteries (slug, name, country, is_active)
  VALUES (NEW.slug, NEW.name, NEW.country, true)
  ON CONFLICT (slug) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lottery_feeds_sync_lottery ON public.lottery_feeds;
CREATE TRIGGER lottery_feeds_sync_lottery
AFTER INSERT ON public.lottery_feeds
FOR EACH ROW EXECUTE FUNCTION public.sync_lottery_from_feed();

-- Backfill existing feeds into lotteries table
INSERT INTO public.lotteries (slug, name, country, is_active)
SELECT slug, name, country, true FROM public.lottery_feeds
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.lotteries
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS draw_days TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lottery-logos', 'lottery-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Lottery logos are publicly viewable" ON storage.objects;
CREATE POLICY "Lottery logos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'lottery-logos');

DROP POLICY IF EXISTS "Admins can upload lottery logos" ON storage.objects;
CREATE POLICY "Admins can upload lottery logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update lottery logos" ON storage.objects;
CREATE POLICY "Admins can update lottery logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete lottery logos" ON storage.objects;
CREATE POLICY "Admins can delete lottery logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'lottery-logos' AND public.has_role(auth.uid(), 'admin'));