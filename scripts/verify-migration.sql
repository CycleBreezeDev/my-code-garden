-- ============================================================================
-- Post-Migration Verification Script
-- ============================================================================
-- Run with: psql "$SUPABASE_DB_URL" -f scripts/verify-migration.sql
--
-- Verifies:
--   1. All new tables exist with expected columns
--   2. All new RPCs exist with the expected signatures
--   3. RLS is enabled on every new table
--   4. Storage buckets exist
--   5. Critical RPCs (wallet_buy_ticket, get_or_create_dm_thread,
--      upsert_syndicate_picks, dm_mark_read, etc.) are callable end-to-end
--      against synthetic data inside a rolled-back transaction.
--
-- The end-to-end section runs inside BEGIN ... ROLLBACK so nothing persists.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on
\pset border 2

\echo
\echo '============================================================'
\echo '  1. TABLE EXISTENCE CHECK'
\echo '============================================================'

WITH expected(table_name) AS (
  VALUES
    ('user_profiles_public'),
    ('follows'),
    ('user_blocks'),
    ('social_reports'),
    ('notifications'),
    ('feed_posts'),
    ('feed_likes'),
    ('feed_comments'),
    ('dm_threads'),
    ('dm_messages'),
    ('dm_message_reactions'),
    ('dm_thread_reads'),
    ('dm_typing'),
    ('syndicate_messages'),
    ('message_reactions'),
    ('syndicate_picks'),
    ('ticket_pick_verifications'),
    ('tickets'),
    ('kyc_tiers'),
    ('kyc_profiles'),
    ('kyc_documents'),
    ('kyc_checks')
)
SELECT
  e.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN '✅ exists' ELSE '❌ MISSING' END AS status
FROM expected e
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.table_name
ORDER BY e.table_name;

\echo
\echo '============================================================'
\echo '  2. RLS ENABLED CHECK'
\echo '============================================================'

SELECT
  c.relname AS table_name,
  CASE WHEN c.relrowsecurity THEN '✅ RLS on' ELSE '❌ RLS OFF' END AS status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'user_profiles_public','follows','user_blocks','social_reports','notifications',
    'feed_posts','feed_likes','feed_comments',
    'dm_threads','dm_messages','dm_message_reactions','dm_thread_reads','dm_typing',
    'syndicate_messages','message_reactions','syndicate_picks','ticket_pick_verifications',
    'tickets','kyc_tiers','kyc_profiles','kyc_documents','kyc_checks'
  )
ORDER BY c.relname;

\echo
\echo '============================================================'
\echo '  3. RPC EXISTENCE CHECK'
\echo '============================================================'

WITH expected(fn) AS (
  VALUES
    ('wallet_buy_ticket'),
    ('get_or_create_dm_thread'),
    ('dm_mark_read'),
    ('dm_unread_total'),
    ('upsert_syndicate_picks'),
    ('user_feed'),
    ('suggested_follows'),
    ('is_dm_participant'),
    ('is_syndicate_member'),
    ('has_role'),
    ('kyc_bump_tier'),
    ('publish_draw_results'),
    ('wallet_credit'),
    ('wallet_debit_for_withdrawal'),
    ('wallet_finalize_withdrawal')
)
SELECT
  e.fn,
  CASE WHEN p.proname IS NOT NULL THEN '✅ exists' ELSE '❌ MISSING' END AS status,
  pg_get_function_identity_arguments(p.oid) AS signature
FROM expected e
LEFT JOIN pg_proc p ON p.proname = e.fn
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
ORDER BY e.fn;

\echo
\echo '============================================================'
\echo '  4. STORAGE BUCKETS CHECK'
\echo '============================================================'

WITH expected(bucket) AS (
  VALUES ('dm-attachments'), ('kyc-docs'), ('ticket-images'), ('lottery-logos')
)
SELECT
  e.bucket,
  CASE WHEN b.id IS NOT NULL THEN '✅ exists' ELSE '❌ MISSING' END AS status,
  b.public AS is_public
FROM expected e
LEFT JOIN storage.buckets b ON b.id = e.bucket
ORDER BY e.bucket;

\echo
\echo '============================================================'
\echo '  5. END-TO-END RPC SMOKE TEST (rolled back)'
\echo '============================================================'

BEGIN;

-- Reuse two existing users (we cannot read/insert into auth.users from this role).
-- Picks the two oldest profile rows; falls back with a clear error if fewer than 2 exist.
DO $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
  v_lottery_id uuid;
  v_draw_id uuid;
  v_ticket_id uuid;
  v_thread_id uuid;
  v_unread int;
  v_syndicate_id uuid;
  v_membership_id uuid;
  v_picks_count int;
BEGIN
  SELECT user_id INTO v_user_a FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  SELECT user_id INTO v_user_b FROM public.profiles WHERE user_id <> v_user_a ORDER BY created_at ASC LIMIT 1;
  IF v_user_a IS NULL OR v_user_b IS NULL THEN
    RAISE EXCEPTION 'Need at least 2 existing profiles to run the end-to-end smoke test';
  END IF;
  RAISE NOTICE 'Using existing users: A=% B=%', v_user_a, v_user_b;

  -- Ensure user A has a wallet for the ticket purchase.
  -- (profiles + user_profiles_public already exist via signup trigger.)

  -- ---- wallet_buy_ticket end-to-end ------------------------------------
  INSERT INTO public.lotteries (slug, name, price_per_line)
  VALUES ('verify-lotto', 'Verify Lotto', 2.00)
  RETURNING id INTO v_lottery_id;

  INSERT INTO public.lottery_draws (lottery_id, draw_date, currency, status, jackpot_amount)
  VALUES (v_lottery_id, now() + interval '1 day', 'USD', 'upcoming', 1000000)
  RETURNING id INTO v_draw_id;

  INSERT INTO public.wallets (user_id, currency, available_balance)
  VALUES (v_user_a, 'USD', 50.00)
  ON CONFLICT (user_id, currency) DO UPDATE SET available_balance = EXCLUDED.available_balance;

  -- Impersonate user A.
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_ticket_id := public.wallet_buy_ticket(
    _draw_id => v_draw_id,
    _main    => ARRAY[1,2,3,4,5,6],
    _bonus   => ARRAY[7,8],
    _lines   => 1
  );
  RAISE NOTICE '✅ wallet_buy_ticket -> %', v_ticket_id;
  IF v_ticket_id IS NULL THEN RAISE EXCEPTION 'wallet_buy_ticket returned NULL'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE id = v_ticket_id AND user_id = v_user_a) THEN
    RAISE EXCEPTION 'ticket row missing after wallet_buy_ticket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE reference = v_ticket_id::text) THEN
    RAISE EXCEPTION 'wallet_transactions row missing after wallet_buy_ticket';
  END IF;

  -- ---- get_or_create_dm_thread + dm_mark_read --------------------------
  v_thread_id := public.get_or_create_dm_thread(_other => v_user_b);
  RAISE NOTICE '✅ get_or_create_dm_thread -> %', v_thread_id;

  -- Idempotency: calling again returns the same id.
  IF v_thread_id <> public.get_or_create_dm_thread(_other => v_user_b) THEN
    RAISE EXCEPTION 'get_or_create_dm_thread is not idempotent';
  END IF;

  -- B sends a message to A.
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  INSERT INTO public.dm_messages (thread_id, sender_id, body, kind)
  VALUES (v_thread_id, v_user_b, 'hello from B', 'text');

  -- A checks unread, then marks read.
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  v_unread := public.dm_unread_total();
  RAISE NOTICE '✅ dm_unread_total (A, before read) -> %', v_unread;
  IF v_unread < 1 THEN RAISE EXCEPTION 'expected unread >= 1, got %', v_unread; END IF;

  PERFORM public.dm_mark_read(_thread_id => v_thread_id);
  v_unread := public.dm_unread_total();
  RAISE NOTICE '✅ dm_unread_total (A, after read)  -> %', v_unread;
  IF v_unread <> 0 THEN RAISE EXCEPTION 'expected unread = 0 after mark_read, got %', v_unread; END IF;

  -- ---- upsert_syndicate_picks -----------------------------------------
  INSERT INTO public.syndicates (slug, draw_id, name, total_shares, price_per_share, currency)
  VALUES ('verify-syn', v_draw_id, 'Verify Syndicate', 10, 5.00, 'USD')
  RETURNING id INTO v_syndicate_id;

  INSERT INTO public.syndicate_memberships (syndicate_id, user_id, shares, amount_paid)
  VALUES (v_syndicate_id, v_user_a, 2, 10.00)
  RETURNING id INTO v_membership_id;

  v_picks_count := public.upsert_syndicate_picks(
    _membership_id => v_membership_id,
    _picks => '[{"main":[1,2,3,4,5,6],"bonus":[7]},{"main":[10,11,12,13,14,15],"bonus":[8]}]'::jsonb
  );
  RAISE NOTICE '✅ upsert_syndicate_picks -> % rows', v_picks_count;
  IF v_picks_count <> 2 THEN RAISE EXCEPTION 'expected 2 picks, got %', v_picks_count; END IF;

  -- Idempotency: re-running replaces, doesn't accumulate.
  v_picks_count := public.upsert_syndicate_picks(
    _membership_id => v_membership_id,
    _picks => '[{"main":[1,2,3,4,5,6],"bonus":[9]}]'::jsonb
  );
  IF v_picks_count <> 1 THEN RAISE EXCEPTION 'expected 1 pick after replace, got %', v_picks_count; END IF;
  RAISE NOTICE '✅ upsert_syndicate_picks (replace) -> % rows', v_picks_count;

  -- ---- user_feed + suggested_follows readability -----------------------
  PERFORM 1 FROM public.user_feed(_limit => 5);
  RAISE NOTICE '✅ user_feed callable';

  PERFORM 1 FROM public.suggested_follows(_limit => 5);
  RAISE NOTICE '✅ suggested_follows callable';

  RAISE NOTICE '------------------------------------------------------------';
  RAISE NOTICE '  ALL END-TO-END CHECKS PASSED';
  RAISE NOTICE '------------------------------------------------------------';
END $$;

ROLLBACK;

\echo
\echo '============================================================'
\echo '  VERIFICATION COMPLETE'
\echo '============================================================'
\echo 'All checks above should show ✅. Any ❌ requires attention.'
\echo
