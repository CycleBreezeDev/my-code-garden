
-- =============================================================
-- 0. Helpers + extensions
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add cover_url to profiles (used by useMyProfile)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- =============================================================
-- 1. user_profiles_public
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles_public (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  username TEXT UNIQUE,
  bio TEXT,
  country_code TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  email_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  syndicates_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public profiles readable by all"
  ON public.user_profiles_public FOR SELECT USING (true);
CREATE POLICY "users insert own public profile"
  ON public.user_profiles_public FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own public profile"
  ON public.user_profiles_public FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage public profiles"
  ON public.user_profiles_public FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_upp_updated BEFORE UPDATE ON public.user_profiles_public
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill rows for existing users
INSERT INTO public.user_profiles_public (user_id, username)
SELECT p.user_id, 'user_' || substr(p.user_id::text, 1, 8)
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_public()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles_public (user_id, username)
  VALUES (NEW.user_id, 'user_' || substr(NEW.user_id::text, 1, 8))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_create_public ON public.profiles;
CREATE TRIGGER trg_profiles_create_public
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_public();

-- =============================================================
-- 2. follows + user_blocks
-- =============================================================
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows readable by all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "users follow" ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "users unfollow" ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own blocks" ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);
CREATE POLICY "users add own blocks" ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "users remove own blocks" ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- Maintain follower/following counts via trigger
CREATE OR REPLACE FUNCTION public.bump_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles_public SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
    UPDATE public.user_profiles_public SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles_public SET followers_count = GREATEST(followers_count - 1, 0) WHERE user_id = OLD.following_id;
    UPDATE public.user_profiles_public SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = OLD.follower_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_follows_counts ON public.follows;
CREATE TRIGGER trg_follows_counts
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.bump_follow_counts();

-- =============================================================
-- 3. social_reports
-- =============================================================
CREATE TABLE IF NOT EXISTS public.social_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('message','profile','feed_post','feed_comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users file reports" ON public.social_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "users see own reports" ON public.social_reports FOR SELECT
  USING (auth.uid() = reporter_id);
CREATE POLICY "admins manage reports" ON public.social_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================================
-- 4. notifications
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  actor_id UUID,
  entity_type TEXT,
  entity_id UUID,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage notifications" ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- =============================================================
-- 5. Feed: posts + likes + comments
-- =============================================================
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed posts readable by all" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "users create own posts" ON public.feed_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own posts" ON public.feed_posts FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "users delete own posts" ON public.feed_posts FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage posts" ON public.feed_posts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_created ON public.feed_posts(user_id, created_at DESC);

CREATE TRIGGER trg_feed_posts_updated BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.feed_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable by all" ON public.feed_likes FOR SELECT USING (true);
CREATE POLICY "users like" ON public.feed_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unlike" ON public.feed_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_feed_likes_count ON public.feed_likes;
CREATE TRIGGER trg_feed_likes_count
AFTER INSERT OR DELETE ON public.feed_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_post_likes_count();

CREATE TABLE IF NOT EXISTS public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable by all" ON public.feed_comments FOR SELECT USING (true);
CREATE POLICY "users comment" ON public.feed_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own comment" ON public.feed_comments FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- 6. Direct messaging
-- =============================================================
CREATE TABLE IF NOT EXISTS public.dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)  -- canonical ordering
);
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read thread" ON public.dm_threads FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "participants update thread" ON public.dm_threads FOR UPDATE
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  body TEXT,
  image_path TEXT,
  kind TEXT NOT NULL DEFAULT 'text',
  reply_to_id UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_dm_participant(_thread_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_threads
    WHERE id = _thread_id
      AND (user_a = auth.uid() OR user_b = auth.uid())
  );
$$;

CREATE POLICY "participants read messages" ON public.dm_messages FOR SELECT
  USING (public.is_dm_participant(thread_id));
CREATE POLICY "participants send messages" ON public.dm_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND public.is_dm_participant(thread_id));
CREATE POLICY "senders edit own messages" ON public.dm_messages FOR UPDATE
  USING (auth.uid() = sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_created ON public.dm_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read reactions" ON public.dm_message_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dm_messages m WHERE m.id = message_id AND public.is_dm_participant(m.thread_id)));
CREATE POLICY "participants add reactions" ON public.dm_message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "participants remove own reactions" ON public.dm_message_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.dm_thread_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);
ALTER TABLE public.dm_thread_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own reads" ON public.dm_thread_reads FOR SELECT
  USING (auth.uid() = user_id OR public.is_dm_participant(thread_id));
CREATE POLICY "users upsert own reads" ON public.dm_thread_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own reads" ON public.dm_thread_reads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.dm_typing (
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
ALTER TABLE public.dm_typing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read typing" ON public.dm_typing FOR SELECT
  USING (public.is_dm_participant(thread_id));
CREATE POLICY "users upsert own typing" ON public.dm_typing FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own typing" ON public.dm_typing FOR UPDATE
  USING (auth.uid() = user_id);

-- bump thread on message insert
CREATE OR REPLACE FUNCTION public.bump_dm_thread_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.dm_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = COALESCE(LEFT(NEW.body, 140), CASE NEW.kind WHEN 'image' THEN '📷 Image' ELSE '' END)
  WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dm_bump_thread ON public.dm_messages;
CREATE TRIGGER trg_dm_bump_thread
AFTER INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_dm_thread_on_message();

-- DM RPCs
CREATE OR REPLACE FUNCTION public.get_or_create_dm_thread(_other UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me UUID := auth.uid(); v_a UUID; v_b UUID; v_id UUID;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other IS NULL OR _other = v_me THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF v_me < _other THEN v_a := v_me; v_b := _other; ELSE v_a := _other; v_b := v_me; END IF;
  SELECT id INTO v_id FROM public.dm_threads WHERE user_a = v_a AND user_b = v_b;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.dm_threads (user_a, user_b) VALUES (v_a, v_b) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.dm_mark_read(_thread_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_dm_participant(_thread_id) THEN RAISE EXCEPTION 'Not a participant'; END IF;
  INSERT INTO public.dm_thread_reads (thread_id, user_id, last_read_at)
  VALUES (_thread_id, auth.uid(), now())
  ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END $$;

CREATE OR REPLACE FUNCTION public.dm_unread_total()
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(SUM(c), 0) INTO v_total FROM (
    SELECT (
      SELECT COUNT(*) FROM public.dm_messages m
      WHERE m.thread_id = t.id
        AND m.sender_id <> auth.uid()
        AND m.deleted_at IS NULL
        AND m.created_at > COALESCE(
          (SELECT last_read_at FROM public.dm_thread_reads r WHERE r.thread_id = t.id AND r.user_id = auth.uid()),
          'epoch'::timestamptz
        )
    ) AS c
    FROM public.dm_threads t
    WHERE t.user_a = auth.uid() OR t.user_b = auth.uid()
  ) s;
  RETURN v_total;
END $$;

-- =============================================================
-- 7. Syndicate chat + message_reactions + picks + verifications
-- =============================================================
CREATE TABLE IF NOT EXISTS public.syndicate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT,
  image_path TEXT,
  kind TEXT NOT NULL DEFAULT 'text',
  reply_to_id UUID,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.syndicate_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read syndicate messages" ON public.syndicate_messages FOR SELECT
  USING (public.is_syndicate_member(syndicate_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members post syndicate messages" ON public.syndicate_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_syndicate_member(syndicate_id));
CREATE POLICY "authors edit own syndicate messages" ON public.syndicate_messages FOR UPDATE
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_syn_msg_syn_created ON public.syndicate_messages(syndicate_id, created_at);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.syndicate_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read syn reactions" ON public.message_reactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.syndicate_messages m WHERE m.id = message_id AND (public.is_syndicate_member(m.syndicate_id) OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "members add syn reactions" ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members remove own syn reactions" ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.syndicate_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.syndicate_memberships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  share_index INTEGER NOT NULL,
  main_numbers INTEGER[] NOT NULL DEFAULT '{}',
  bonus_numbers INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  main_match_count INTEGER,
  bonus_match_count INTEGER,
  matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membership_id, share_index)
);
ALTER TABLE public.syndicate_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read picks" ON public.syndicate_picks FOR SELECT
  USING (public.is_syndicate_member(syndicate_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owners modify picks" ON public.syndicate_picks FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_picks_updated BEFORE UPDATE ON public.syndicate_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_syndicate_picks(_membership_id UUID, _picks JSONB)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_mem RECORD; v_count INTEGER := 0; v_pick JSONB; v_idx INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT m.*, s.id AS s_id INTO v_mem
  FROM public.syndicate_memberships m
  JOIN public.syndicates s ON s.id = m.syndicate_id
  WHERE m.id = _membership_id AND m.user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership not found'; END IF;

  -- Wipe current picks for this membership and re-insert (idempotent UX)
  DELETE FROM public.syndicate_picks WHERE membership_id = _membership_id;
  v_idx := 0;
  FOR v_pick IN SELECT * FROM jsonb_array_elements(COALESCE(_picks, '[]'::jsonb))
  LOOP
    INSERT INTO public.syndicate_picks (
      syndicate_id, membership_id, user_id, share_index,
      main_numbers, bonus_numbers, status
    ) VALUES (
      v_mem.s_id, _membership_id, v_user, v_idx,
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_pick->'main'))::int[], '{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_pick->'bonus'))::int[], '{}'),
      'included'
    );
    v_count := v_count + 1;
    v_idx := v_idx + 1;
  END LOOP;
  RETURN v_count;
END $$;

CREATE TABLE IF NOT EXISTS public.ticket_pick_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ticket_image_id UUID NOT NULL REFERENCES public.ticket_images(id) ON DELETE CASCADE,
  syndicate_id UUID NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.syndicate_memberships(id) ON DELETE CASCADE,
  share_index INTEGER NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticket_image_id, share_index)
);
ALTER TABLE public.ticket_pick_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own verifications" ON public.ticket_pick_verifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users add own verifications" ON public.ticket_pick_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users remove own verifications" ON public.ticket_pick_verifications FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- 8. Tickets (single-ticket purchases)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  draw_id UUID NOT NULL REFERENCES public.lottery_draws(id),
  main_numbers INTEGER[] NOT NULL,
  bonus_numbers INTEGER[] NOT NULL DEFAULT '{}',
  lines INTEGER NOT NULL DEFAULT 1,
  total_paid NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  scanner_status TEXT,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own tickets" ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage tickets" ON public.tickets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_tickets_user_created ON public.tickets(user_id, created_at DESC);

-- wallet_buy_ticket: debits the wallet for a single ticket purchase
CREATE OR REPLACE FUNCTION public.wallet_buy_ticket(_draw_id UUID, _main INTEGER[], _bonus INTEGER[], _lines INTEGER)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_draw public.lottery_draws%ROWTYPE;
  v_lottery public.lotteries%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_total NUMERIC(12,2);
  v_ref TEXT := 'wallet-tkt:' || gen_random_uuid()::text;
  v_new_balance NUMERIC(14,2);
  v_ticket_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _lines IS NULL OR _lines <= 0 OR _lines > 50 THEN RAISE EXCEPTION 'Invalid lines'; END IF;
  IF _main IS NULL OR array_length(_main,1) IS NULL THEN RAISE EXCEPTION 'Main numbers required'; END IF;

  SELECT * INTO v_draw FROM public.lottery_draws WHERE id = _draw_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draw not found'; END IF;
  IF v_draw.status <> 'upcoming' OR v_draw.draw_date <= now() THEN RAISE EXCEPTION 'Draw closed'; END IF;

  SELECT * INTO v_lottery FROM public.lotteries WHERE id = v_draw.lottery_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lottery not found'; END IF;

  v_total := ROUND(v_lottery.price_per_line * _lines, 2);

  SELECT * INTO v_wallet FROM public.wallets
    WHERE user_id = v_user AND currency = v_draw.currency FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet.available_balance < v_total THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  v_new_balance := v_wallet.available_balance - v_total;
  UPDATE public.wallets SET available_balance = v_new_balance WHERE id = v_wallet.id;

  INSERT INTO public.tickets (user_id, draw_id, main_numbers, bonus_numbers, lines, total_paid, currency, status, payment_reference)
  VALUES (v_user, _draw_id, _main, COALESCE(_bonus, '{}'), _lines, v_total, v_draw.currency, 'paid', v_ref)
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.wallet_transactions (user_id, currency, kind, amount, balance_after, reference, status, metadata)
  VALUES (v_user, v_draw.currency, 'ticket_purchase', -v_total, v_new_balance, v_ticket_id::text, 'completed',
    jsonb_build_object('ticket_id', v_ticket_id, 'draw_id', _draw_id, 'lines', _lines));

  RETURN v_ticket_id;
END $$;

-- =============================================================
-- 9. Score picks after results published
-- =============================================================
CREATE OR REPLACE FUNCTION public.score_picks_for_draw()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.main_numbers, p.bonus_numbers
    FROM public.syndicate_picks p
    JOIN public.syndicates s ON s.id = p.syndicate_id
    WHERE s.draw_id = NEW.draw_id
  LOOP
    UPDATE public.syndicate_picks
    SET main_match_count = (
      SELECT COUNT(*) FROM unnest(r.main_numbers) n
      WHERE n = ANY(NEW.winning_numbers)
    ),
    bonus_match_count = (
      SELECT COUNT(*) FROM unnest(COALESCE(r.bonus_numbers, '{}'::int[])) n
      WHERE n = ANY(COALESCE(NEW.bonus_numbers, '{}'::int[]))
    ),
    matched_at = now()
    WHERE id = r.id;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_score_picks ON public.draw_results;
CREATE TRIGGER trg_score_picks
AFTER INSERT OR UPDATE ON public.draw_results
FOR EACH ROW EXECUTE FUNCTION public.score_picks_for_draw();

-- =============================================================
-- 10. KYC
-- =============================================================
CREATE TABLE IF NOT EXISTS public.kyc_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  daily_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  requires_id BOOLEAN NOT NULL DEFAULT false,
  requires_selfie BOOLEAN NOT NULL DEFAULT false,
  requires_por BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.kyc_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc tiers public read" ON public.kyc_tiers FOR SELECT USING (true);
CREATE POLICY "admins manage kyc tiers" ON public.kyc_tiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kyc_tiers (tier, name, description, daily_limit_usd, monthly_limit_usd, requires_id, requires_selfie, requires_por)
VALUES
  (0, 'Unverified', 'Basic, view-only', 0, 0, false, false, false),
  (1, 'Tier 1', 'Email + name', 100, 1000, false, false, false),
  (2, 'Tier 2', 'Government ID + selfie', 1000, 10000, true, true, false),
  (3, 'Tier 3', 'Full KYC + proof of residence', 10000, 100000, true, true, true)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  tier INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unverified',
  country TEXT,
  id_type TEXT,
  id_number TEXT,
  full_name TEXT,
  dob DATE,
  rejection_reason TEXT,
  por_verified_at TIMESTAMPTZ,
  selfie_verified_at TIMESTAMPTZ,
  last_provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own kyc" ON public.kyc_profiles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage kyc profiles" ON public.kyc_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_kyc_profiles_updated BEFORE UPDATE ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own kyc docs" ON public.kyc_documents FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage kyc docs" ON public.kyc_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kyc_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own kyc checks" ON public.kyc_checks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admins manage kyc checks" ON public.kyc_checks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.kyc_bump_tier(_user_id UUID, _tier INTEGER, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  INSERT INTO public.kyc_profiles (user_id, tier, status)
  VALUES (_user_id, _tier, 'verified')
  ON CONFLICT (user_id) DO UPDATE
    SET tier = EXCLUDED.tier, status = 'verified', rejection_reason = NULL;
  INSERT INTO public.kyc_checks (user_id, provider, job_type, status, request_payload)
  VALUES (_user_id, 'admin', 'tier_change', 'completed', jsonb_build_object('tier', _tier, 'reason', _reason));
END $$;

-- =============================================================
-- 11. Feed RPCs
-- =============================================================
CREATE OR REPLACE FUNCTION public.user_feed(_limit INTEGER DEFAULT 50, _before TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  id UUID, user_id UUID, kind TEXT, body TEXT, metadata JSONB,
  likes_count INTEGER, comments_count INTEGER, created_at TIMESTAMPTZ,
  username TEXT, full_name TEXT, avatar_url TEXT, liked_by_me BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.user_id, p.kind, p.body, p.metadata,
    p.likes_count, p.comments_count, p.created_at,
    upp.username, pr.full_name, pr.avatar_url,
    EXISTS (SELECT 1 FROM public.feed_likes l WHERE l.post_id = p.id AND l.user_id = auth.uid()) AS liked_by_me
  FROM public.feed_posts p
  LEFT JOIN public.user_profiles_public upp ON upp.user_id = p.user_id
  LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
  WHERE (_before IS NULL OR p.created_at < _before)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_id = auth.uid() AND b.blocked_id = p.user_id
    )
    AND (
      auth.uid() IS NULL
      OR p.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = p.user_id)
      OR upp.is_public = true
    )
  ORDER BY p.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 50), 100);
$$;

CREATE OR REPLACE FUNCTION public.suggested_follows(_limit INTEGER DEFAULT 12)
RETURNS TABLE (
  user_id UUID, username TEXT, full_name TEXT, avatar_url TEXT, followers_count INTEGER
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT upp.user_id, upp.username, pr.full_name, pr.avatar_url, upp.followers_count
  FROM public.user_profiles_public upp
  LEFT JOIN public.profiles pr ON pr.user_id = upp.user_id
  WHERE upp.is_public = true
    AND upp.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      auth.uid() IS NULL OR
      NOT EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = upp.user_id)
    )
    AND (
      auth.uid() IS NULL OR
      NOT EXISTS (SELECT 1 FROM public.user_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = upp.user_id)
    )
  ORDER BY upp.followers_count DESC, upp.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 12), 50);
$$;

-- =============================================================
-- 12. Storage buckets used by new tables
-- =============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-attachments', 'dm-attachments', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-docs', 'kyc-docs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "DM attachments owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'dm-attachments' AND auth.uid()::text = (storage.foldername(name))[2]);
CREATE POLICY "DM attachments owner write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dm-attachments' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "KYC owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "KYC owner write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "KYC admin read" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-docs' AND public.has_role(auth.uid(), 'admin'));
