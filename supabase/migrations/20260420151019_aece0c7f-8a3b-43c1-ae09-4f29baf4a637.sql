
-- ============ EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS citext;

-- ============ user_profiles_public ============
CREATE TABLE public.user_profiles_public (
  user_id UUID PRIMARY KEY,
  username CITEXT UNIQUE NOT NULL,
  bio TEXT,
  country_code TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  syndicates_count INTEGER NOT NULL DEFAULT 0,
  email_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,24}$')
);
ALTER TABLE public.user_profiles_public ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles readable by everyone"
  ON public.user_profiles_public FOR SELECT USING (true);
CREATE POLICY "Users insert own public profile"
  ON public.user_profiles_public FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own public profile"
  ON public.user_profiles_public FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_upp_updated_at
  BEFORE UPDATE ON public.user_profiles_public
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate a username for new users
CREATE OR REPLACE FUNCTION public.create_public_profile_for_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base TEXT;
  v_candidate TEXT;
  v_n INT := 0;
BEGIN
  v_base := lower(regexp_replace(COALESCE(split_part(NEW.email,'@',1),'user'), '[^a-zA-Z0-9_]', '', 'g'));
  IF length(v_base) < 3 THEN v_base := 'user' || substr(NEW.id::text, 1, 6); END IF;
  IF length(v_base) > 20 THEN v_base := substr(v_base, 1, 20); END IF;
  v_candidate := v_base;
  WHILE EXISTS(SELECT 1 FROM public.user_profiles_public WHERE username = v_candidate) LOOP
    v_n := v_n + 1;
    v_candidate := v_base || v_n::text;
  END LOOP;
  INSERT INTO public.user_profiles_public (user_id, username)
  VALUES (NEW.id, v_candidate)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_public_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_public_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_public_profile_for_new_user();

-- Backfill for existing users
INSERT INTO public.user_profiles_public (user_id, username)
SELECT u.id,
  COALESCE(
    (
      SELECT base || COALESCE(NULLIF(n::text, '0'), '')
      FROM (
        SELECT lower(regexp_replace(COALESCE(split_part(u.email,'@',1),'user'), '[^a-zA-Z0-9_]', '', 'g')) AS base,
               row_number() OVER (PARTITION BY lower(regexp_replace(COALESCE(split_part(u.email,'@',1),'user'), '[^a-zA-Z0-9_]', '', 'g')) ORDER BY u.created_at) - 1 AS n
      ) s LIMIT 1
    ),
    'user' || substr(u.id::text, 1, 6)
  )
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- ============ follows ============
CREATE TABLE public.follows (
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows readable by both parties or public"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users follow as self"
  ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users unfollow as self"
  ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Maintain denormalized counts + create notification
CREATE OR REPLACE FUNCTION public.handle_follow_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_profiles_public SET followers_count = followers_count + 1 WHERE user_id = NEW.following_id;
    UPDATE public.user_profiles_public SET following_count = following_count + 1 WHERE user_id = NEW.follower_id;
    -- Block check
    IF NOT EXISTS (
      SELECT 1 FROM public.user_blocks
      WHERE (blocker_id = NEW.following_id AND blocked_id = NEW.follower_id)
         OR (blocker_id = NEW.follower_id AND blocked_id = NEW.following_id)
    ) THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id)
      VALUES (NEW.following_id, 'follow', NEW.follower_id, 'user', NEW.follower_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_profiles_public SET followers_count = GREATEST(0, followers_count - 1) WHERE user_id = OLD.following_id;
    UPDATE public.user_profiles_public SET following_count = GREATEST(0, following_count - 1) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

-- ============ user_blocks ============
CREATE TABLE public.user_blocks (
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own blocks"
  ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users block as self"
  ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users unblock as self"
  ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- When you block someone, also unfollow both directions
CREATE OR REPLACE FUNCTION public.handle_block_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_block_insert
  AFTER INSERT ON public.user_blocks
  FOR EACH ROW EXECUTE FUNCTION public.handle_block_insert();

-- ============ notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('follow','mention','reaction','reply','payout','syndicate_full','feed_like','feed_comment')),
  actor_id UUID,
  entity_type TEXT,
  entity_id UUID,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Now wire up follow trigger (notifications table exists)
CREATE TRIGGER trg_follow_change
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.handle_follow_change();

-- ============ syndicate_messages ============
CREATE TABLE public.syndicate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndicate_id UUID NOT NULL,
  user_id UUID NOT NULL,
  body TEXT,
  image_path TEXT,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','system')),
  reply_to_id UUID REFERENCES public.syndicate_messages(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_syn_msg_syndicate ON public.syndicate_messages(syndicate_id, created_at DESC);
ALTER TABLE public.syndicate_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read syndicate messages"
  ON public.syndicate_messages FOR SELECT
  USING (is_syndicate_member(syndicate_id) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Members post syndicate messages"
  ON public.syndicate_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND (is_syndicate_member(syndicate_id) OR kind = 'system'));
CREATE POLICY "Authors edit own messages"
  ON public.syndicate_messages FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors or admins delete messages"
  ON public.syndicate_messages FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- Rate limit + mention notifications
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NEW.kind = 'system' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.syndicate_messages
   WHERE user_id = NEW.user_id
     AND syndicate_id = NEW.syndicate_id
     AND created_at > now() - interval '1 minute';
  IF v_count >= 30 THEN
    RAISE EXCEPTION 'Rate limit: max 30 messages per minute per syndicate';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_msg_rate_limit
  BEFORE INSERT ON public.syndicate_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
  v_target UUID;
  v_reply_author UUID;
BEGIN
  -- Reply notification
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT user_id INTO v_reply_author FROM public.syndicate_messages WHERE id = NEW.reply_to_id;
    IF v_reply_author IS NOT NULL AND v_reply_author <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body, metadata)
      VALUES (v_reply_author, 'reply', NEW.user_id, 'syndicate_message', NEW.id, left(COALESCE(NEW.body,''), 140),
              jsonb_build_object('syndicate_id', NEW.syndicate_id));
    END IF;
  END IF;
  -- @mentions
  IF NEW.body IS NOT NULL THEN
    FOR v_username IN
      SELECT DISTINCT (regexp_matches(NEW.body, '@([a-zA-Z0-9_]{3,24})', 'g'))[1]
    LOOP
      SELECT user_id INTO v_target FROM public.user_profiles_public WHERE username = v_username;
      IF v_target IS NOT NULL AND v_target <> NEW.user_id
         AND public.is_syndicate_member_uid(NEW.syndicate_id, v_target) THEN
        INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body, metadata)
        VALUES (v_target, 'mention', NEW.user_id, 'syndicate_message', NEW.id, left(COALESCE(NEW.body,''), 140),
                jsonb_build_object('syndicate_id', NEW.syndicate_id));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

-- Helper variant of is_syndicate_member that takes a uid (for triggers)
CREATE OR REPLACE FUNCTION public.is_syndicate_member_uid(_syndicate_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.syndicate_memberships WHERE syndicate_id = _syndicate_id AND user_id = _user_id);
$$;

CREATE TRIGGER trg_msg_notify
  AFTER INSERT ON public.syndicate_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- ============ message_reactions ============
CREATE TABLE public.message_reactions (
  message_id UUID NOT NULL REFERENCES public.syndicate_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍','❤️','🎉','🔥')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read reactions"
  ON public.message_reactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.syndicate_messages m
            WHERE m.id = message_id AND (is_syndicate_member(m.syndicate_id) OR has_role(auth.uid(),'admin')))
  );
CREATE POLICY "Members add own reactions"
  ON public.message_reactions FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.syndicate_messages m WHERE m.id = message_id AND is_syndicate_member(m.syndicate_id))
  );
CREATE POLICY "Users remove own reactions"
  ON public.message_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID; v_syn UUID;
BEGIN
  SELECT user_id, syndicate_id INTO v_author, v_syn FROM public.syndicate_messages WHERE id = NEW.message_id;
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body, metadata)
    VALUES (v_author, 'reaction', NEW.user_id, 'syndicate_message', NEW.message_id, NEW.emoji,
            jsonb_build_object('syndicate_id', v_syn, 'emoji', NEW.emoji));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_reaction_notify
  AFTER INSERT ON public.message_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ============ feed_posts / likes / comments ============
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual','system_join','system_payout','system_ticket','system_full')),
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_user ON public.feed_posts(user_id, created_at DESC);
CREATE INDEX idx_feed_created ON public.feed_posts(created_at DESC);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feed posts publicly readable"
  ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "Users insert own manual posts"
  ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id AND kind = 'manual');
CREATE POLICY "Users delete own posts"
  ON public.feed_posts FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TABLE public.feed_likes (
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes publicly readable" ON public.feed_likes FOR SELECT USING (true);
CREATE POLICY "Users like as self" ON public.feed_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike as self" ON public.feed_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feed_comments_post ON public.feed_comments(post_id, created_at);
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments publicly readable" ON public.feed_comments FOR SELECT USING (true);
CREATE POLICY "Users comment as self" ON public.feed_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.feed_comments FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- Like / comment counts and notifications
CREATE OR REPLACE FUNCTION public.handle_feed_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id RETURNING user_id INTO v_author;
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id)
      VALUES (v_author, 'feed_like', NEW.user_id, 'feed_post', NEW.post_id);
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.feed_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER trg_feed_like AFTER INSERT OR DELETE ON public.feed_likes FOR EACH ROW EXECUTE FUNCTION public.handle_feed_like();

CREATE OR REPLACE FUNCTION public.handle_feed_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_author UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id RETURNING user_id INTO v_author;
    IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body)
      VALUES (v_author, 'feed_comment', NEW.user_id, 'feed_post', NEW.post_id, left(NEW.body, 140));
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.feed_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER trg_feed_comment AFTER INSERT OR DELETE ON public.feed_comments FOR EACH ROW EXECUTE FUNCTION public.handle_feed_comment();

-- ============ social_reports ============
CREATE TABLE public.social_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('message','profile','feed_post','feed_comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolution_note TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_status ON public.social_reports(status, created_at DESC);
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users report as self" ON public.social_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports" ON public.social_reports FOR SELECT USING (auth.uid() = reporter_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage reports" ON public.social_reports FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ Membership join → system feed post + syndicate count ============
CREATE OR REPLACE FUNCTION public.feed_event_on_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_syn public.syndicates%ROWTYPE; v_lottery TEXT; v_full BOOLEAN;
BEGIN
  SELECT * INTO v_syn FROM public.syndicates WHERE id = NEW.syndicate_id;
  SELECT l.name INTO v_lottery FROM public.lottery_draws d JOIN public.lotteries l ON l.id = d.lottery_id WHERE d.id = v_syn.draw_id;

  INSERT INTO public.feed_posts (user_id, kind, body, metadata)
  VALUES (NEW.user_id, 'system_join',
          'joined ' || COALESCE(v_syn.name, 'a group ticket'),
          jsonb_build_object('syndicate_id', v_syn.id, 'syndicate_slug', v_syn.slug, 'syndicate_name', v_syn.name, 'lottery', v_lottery, 'shares', NEW.shares));

  UPDATE public.user_profiles_public
  SET syndicates_count = (SELECT count(DISTINCT syndicate_id) FROM public.syndicate_memberships WHERE user_id = NEW.user_id)
  WHERE user_id = NEW.user_id;

  -- Syndicate full notification to all members
  v_full := (v_syn.sold_shares + NEW.shares) >= v_syn.total_shares;
  IF v_full THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, entity_type, entity_id, body, metadata)
    SELECT DISTINCT m.user_id, 'syndicate_full', NULL, 'syndicate', v_syn.id,
           COALESCE(v_syn.name, 'Your group ticket') || ' is now full!',
           jsonb_build_object('syndicate_id', v_syn.id, 'syndicate_slug', v_syn.slug)
    FROM public.syndicate_memberships m
    WHERE m.syndicate_id = v_syn.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_feed_membership
  AFTER INSERT ON public.syndicate_memberships
  FOR EACH ROW EXECUTE FUNCTION public.feed_event_on_membership();

-- ============ Payout → notification + system feed ============
CREATE OR REPLACE FUNCTION public.notify_on_payout()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_syn public.syndicates%ROWTYPE;
BEGIN
  IF NEW.net_amount <= 0 THEN RETURN NEW; END IF;
  SELECT * INTO v_syn FROM public.syndicates WHERE id = NEW.syndicate_id;
  INSERT INTO public.notifications (user_id, kind, entity_type, entity_id, body, metadata)
  VALUES (NEW.user_id, 'payout', 'payout', NEW.id,
          'You won ' || COALESCE(v_syn.currency,'USD') || ' ' || NEW.net_amount::text || ' from ' || COALESCE(v_syn.name,'a group ticket') || '!',
          jsonb_build_object('amount', NEW.net_amount, 'currency', v_syn.currency, 'syndicate_id', v_syn.id));
  INSERT INTO public.feed_posts (user_id, kind, body, metadata)
  VALUES (NEW.user_id, 'system_payout',
          'won ' || COALESCE(v_syn.currency,'USD') || ' ' || NEW.net_amount::text || ' 🎉',
          jsonb_build_object('amount', NEW.net_amount, 'currency', v_syn.currency, 'syndicate_id', v_syn.id, 'syndicate_name', v_syn.name));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_payout_notify
  AFTER INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_payout();

-- ============ Ticket image → system feed + chat system message ============
CREATE OR REPLACE FUNCTION public.feed_event_on_ticket_image()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_syn public.syndicates%ROWTYPE;
BEGIN
  SELECT * INTO v_syn FROM public.syndicates WHERE id = NEW.syndicate_id;
  INSERT INTO public.feed_posts (user_id, kind, body, metadata)
  VALUES (NEW.uploaded_by, 'system_ticket', 'uploaded a ticket photo for ' || COALESCE(v_syn.name,'a group ticket'),
          jsonb_build_object('syndicate_id', v_syn.id, 'syndicate_slug', v_syn.slug, 'image_path', NEW.storage_path));
  INSERT INTO public.syndicate_messages (syndicate_id, user_id, kind, body, metadata)
  VALUES (NEW.syndicate_id, NEW.uploaded_by, 'system', 'Ticket photo uploaded',
          jsonb_build_object('image_path', NEW.storage_path));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_feed_ticket_image
  AFTER INSERT ON public.ticket_images
  FOR EACH ROW EXECUTE FUNCTION public.feed_event_on_ticket_image();

-- ============ Helper functions for app ============
CREATE OR REPLACE FUNCTION public.suggested_follows(_limit int DEFAULT 10)
RETURNS TABLE(user_id uuid, username citext, bio text, country_code text, followers_count int, mutual_syndicates bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_syns AS (
    SELECT syndicate_id FROM public.syndicate_memberships WHERE user_id = auth.uid()
  ),
  candidates AS (
    SELECT m.user_id, count(DISTINCT m.syndicate_id) AS shared
    FROM public.syndicate_memberships m
    WHERE m.syndicate_id IN (SELECT syndicate_id FROM my_syns)
      AND m.user_id <> auth.uid()
      AND m.user_id NOT IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      AND m.user_id NOT IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid())
      AND m.user_id NOT IN (SELECT blocker_id FROM public.user_blocks WHERE blocked_id = auth.uid())
    GROUP BY m.user_id
  )
  SELECT p.user_id, p.username, p.bio, p.country_code, p.followers_count, c.shared
  FROM candidates c
  JOIN public.user_profiles_public p ON p.user_id = c.user_id
  WHERE p.is_public = true
  ORDER BY c.shared DESC, p.followers_count DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.user_feed(_limit int DEFAULT 30, _before timestamptz DEFAULT NULL)
RETURNS TABLE(
  id uuid, user_id uuid, kind text, body text, metadata jsonb,
  likes_count int, comments_count int, created_at timestamptz,
  username citext, full_name text, avatar_url text, liked_by_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fp.id, fp.user_id, fp.kind, fp.body, fp.metadata,
         fp.likes_count, fp.comments_count, fp.created_at,
         upp.username, pr.full_name, pr.avatar_url,
         EXISTS(SELECT 1 FROM public.feed_likes fl WHERE fl.post_id = fp.id AND fl.user_id = auth.uid()) AS liked_by_me
  FROM public.feed_posts fp
  LEFT JOIN public.user_profiles_public upp ON upp.user_id = fp.user_id
  LEFT JOIN public.profiles pr ON pr.user_id = fp.user_id
  WHERE (_before IS NULL OR fp.created_at < _before)
    AND fp.user_id NOT IN (SELECT blocked_id FROM public.user_blocks WHERE blocker_id = auth.uid())
    AND (
      fp.user_id = auth.uid()
      OR fp.user_id IN (SELECT following_id FROM public.follows WHERE follower_id = auth.uid())
      OR fp.metadata->>'syndicate_id' IN (
        SELECT syndicate_id::text FROM public.syndicate_memberships WHERE user_id = auth.uid()
      )
    )
  ORDER BY fp.created_at DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.notifications WHERE user_id = auth.uid() AND read_at IS NULL;
$$;

-- Backfill syndicate counts
UPDATE public.user_profiles_public p
SET syndicates_count = COALESCE((SELECT count(DISTINCT syndicate_id) FROM public.syndicate_memberships m WHERE m.user_id = p.user_id), 0);

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.syndicate_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;

ALTER TABLE public.syndicate_messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.follows REPLICA IDENTITY FULL;
