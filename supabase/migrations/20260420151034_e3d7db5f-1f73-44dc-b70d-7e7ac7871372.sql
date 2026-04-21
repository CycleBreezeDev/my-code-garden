
-- Set search_path on functions that were missing it
ALTER FUNCTION public.suggested_follows(int) SET search_path = public;
ALTER FUNCTION public.user_feed(int, timestamptz) SET search_path = public;
ALTER FUNCTION public.unread_notification_count() SET search_path = public;
ALTER FUNCTION public.is_syndicate_member_uid(uuid, uuid) SET search_path = public;

-- Move citext extension out of public
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION citext SET SCHEMA extensions;
