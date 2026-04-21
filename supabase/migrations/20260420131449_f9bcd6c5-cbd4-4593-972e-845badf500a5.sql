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
FOR EACH ROW
EXECUTE FUNCTION public.sync_lottery_from_feed();