
-- ============ Helper: mutual-follow + not-blocked check ============
CREATE OR REPLACE FUNCTION public.can_dm(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND _a <> _b
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _a AND following_id = _b)
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _b AND following_id = _a)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
    );
$$;

-- ============ Threads ============
CREATE TABLE public.dm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,           -- canonical: least(uid1, uid2)
  user_b uuid NOT NULL,           -- canonical: greatest(uid1, uid2)
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dm_threads_pair_chk CHECK (user_a < user_b),
  CONSTRAINT dm_threads_pair_unique UNIQUE (user_a, user_b)
);
CREATE INDEX dm_threads_user_a_idx ON public.dm_threads(user_a, last_message_at DESC);
CREATE INDEX dm_threads_user_b_idx ON public.dm_threads(user_b, last_message_at DESC);

ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read threads" ON public.dm_threads
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b OR has_role(auth.uid(), 'admin'::app_role));

-- ============ Messages ============
CREATE TABLE public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  image_path text,
  kind text NOT NULL DEFAULT 'text',  -- text|image|system
  reply_to_id uuid REFERENCES public.dm_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX dm_messages_thread_idx ON public.dm_messages(thread_id, created_at DESC);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dm_participant(_thread_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_threads t
    WHERE t.id = _thread_id AND (t.user_a = _user OR t.user_b = _user)
  );
$$;

CREATE POLICY "Participants read messages" ON public.dm_messages
  FOR SELECT USING (public.is_dm_participant(thread_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants send messages" ON public.dm_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_dm_participant(thread_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.dm_threads t
      WHERE t.id = thread_id
        AND public.can_dm(t.user_a, t.user_b)
    )
  );

CREATE POLICY "Senders edit own messages" ON public.dm_messages
  FOR UPDATE USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders or admins delete" ON public.dm_messages
  FOR DELETE USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

-- ============ Reactions ============
CREATE TABLE public.dm_message_reactions (
  message_id uuid NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read dm reactions" ON public.dm_message_reactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.dm_messages m
            WHERE m.id = dm_message_reactions.message_id
              AND public.is_dm_participant(m.thread_id, auth.uid()))
  );

CREATE POLICY "Participants add own dm reactions" ON public.dm_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.dm_messages m
                WHERE m.id = dm_message_reactions.message_id
                  AND public.is_dm_participant(m.thread_id, auth.uid()))
  );

CREATE POLICY "Users remove own dm reactions" ON public.dm_message_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============ Read receipts ============
CREATE TABLE public.dm_thread_reads (
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE public.dm_thread_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read dm reads" ON public.dm_thread_reads
  FOR SELECT USING (public.is_dm_participant(thread_id, auth.uid()));

CREATE POLICY "Users upsert own dm reads" ON public.dm_thread_reads
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_dm_participant(thread_id, auth.uid()));

CREATE POLICY "Users update own dm reads" ON public.dm_thread_reads
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ Typing indicators ============
CREATE TABLE public.dm_typing (
  thread_id uuid NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE public.dm_typing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read typing" ON public.dm_typing
  FOR SELECT USING (public.is_dm_participant(thread_id, auth.uid()));

CREATE POLICY "Users upsert own typing" ON public.dm_typing
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_dm_participant(thread_id, auth.uid()));

CREATE POLICY "Users update own typing" ON public.dm_typing
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own typing" ON public.dm_typing
  FOR DELETE USING (auth.uid() = user_id);

-- ============ Triggers: bump thread + notify ============
CREATE OR REPLACE FUNCTION public.dm_after_message_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t public.dm_threads%ROWTYPE;
  recipient uuid;
  preview text;
BEGIN
  SELECT * INTO t FROM public.dm_threads WHERE id = NEW.thread_id;
  recipient := CASE WHEN NEW.sender_id = t.user_a THEN t.user_b ELSE t.user_a END;
  preview := COALESCE(LEFT(NEW.body, 140), CASE NEW.kind WHEN 'image' THEN '📷 Photo' ELSE '' END);

  UPDATE public.dm_threads
    SET last_message_at = NEW.created_at, last_message_preview = preview
    WHERE id = NEW.thread_id;

  INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body, metadata)
  VALUES (recipient, 'dm_message', NEW.sender_id, 'dm_thread', NEW.thread_id, preview, jsonb_build_object('message_id', NEW.id));

  RETURN NEW;
END;
$$;

CREATE TRIGGER dm_messages_after_insert
AFTER INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.dm_after_message_insert();

-- ============ RPC: get or create thread ============
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  a uuid; b uuid; tid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.can_dm(me, _other) THEN
    RAISE EXCEPTION 'not_eligible' USING HINT = 'Both users must follow each other.';
  END IF;
  a := LEAST(me, _other); b := GREATEST(me, _other);
  SELECT id INTO tid FROM public.dm_threads WHERE user_a = a AND user_b = b;
  IF tid IS NULL THEN
    INSERT INTO public.dm_threads(user_a, user_b) VALUES (a, b) RETURNING id INTO tid;
  END IF;
  RETURN tid;
END;
$$;

-- ============ RPC: mark thread read ============
CREATE OR REPLACE FUNCTION public.dm_mark_read(_thread_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_dm_participant(_thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_participant';
  END IF;
  INSERT INTO public.dm_thread_reads(thread_id, user_id, last_read_at)
  VALUES (_thread_id, auth.uid(), now())
  ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

-- ============ RPC: total unread ============
CREATE OR REPLACE FUNCTION public.dm_unread_total()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(c)::int, 0) FROM (
    SELECT (
      SELECT COUNT(*) FROM public.dm_messages m
      WHERE m.thread_id = t.id
        AND m.sender_id <> auth.uid()
        AND m.created_at > COALESCE(
          (SELECT last_read_at FROM public.dm_thread_reads r WHERE r.thread_id = t.id AND r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
    ) AS c
    FROM public.dm_threads t
    WHERE t.user_a = auth.uid() OR t.user_b = auth.uid()
  ) s;
$$;

-- ============ Storage: dm-attachments (private) ============
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-attachments', 'dm-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: <thread_id>/<sender_id>/<filename>
CREATE POLICY "DM participants read attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dm-attachments'
  AND public.is_dm_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "DM participants upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'dm-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
  AND public.is_dm_participant((storage.foldername(name))[1]::uuid, auth.uid())
);

CREATE POLICY "DM uploaders delete own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'dm-attachments'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_thread_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_typing;

ALTER TABLE public.dm_threads REPLICA IDENTITY FULL;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;
ALTER TABLE public.dm_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.dm_thread_reads REPLICA IDENTITY FULL;
ALTER TABLE public.dm_typing REPLICA IDENTITY FULL;
