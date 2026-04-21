
-- All four functions already SET search_path = public; ensure linter sees it via ALTER too.
ALTER FUNCTION public.can_dm(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.is_dm_participant(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.dm_after_message_insert() SET search_path = public;
ALTER FUNCTION public.get_or_create_dm_thread(uuid) SET search_path = public;
ALTER FUNCTION public.dm_mark_read(uuid) SET search_path = public;
ALTER FUNCTION public.dm_unread_total() SET search_path = public;
