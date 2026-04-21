
DROP VIEW IF EXISTS public.syndicate_picks_summary;
CREATE VIEW public.syndicate_picks_summary
WITH (security_invoker = on) AS
SELECT
  s.id AS syndicate_id,
  s.name AS syndicate_name,
  s.slug AS syndicate_slug,
  count(p.*) AS total_picks,
  count(*) FILTER (WHERE p.status = 'pending') AS pending_picks,
  count(*) FILTER (WHERE p.status = 'included') AS included_picks,
  count(*) FILTER (WHERE p.status = 'quick_picked') AS quick_picked
FROM public.syndicates s
LEFT JOIN public.syndicate_picks p ON p.syndicate_id = s.id
GROUP BY s.id, s.name, s.slug;
