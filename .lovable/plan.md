

## Pooled syndicate + optional "Lucky Pick" per share

Group Tickets stay pooled (operator buys the bundle, 50/50 prize split unchanged). On top of that, every share you buy lets you **optionally** suggest one set of numbers ("Lucky Pick") that the operator will include in the bundle alongside the Quick Picks.

### What members see

**On the join screen (`/group/:slug`)**
- A new "How numbers work" explainer panel above the share picker:
  - "Group Tickets are pooled — we buy a bundle of official tickets for the whole group."
  - "Most lines are Quick Picks. You can optionally pick your own numbers for each share you buy (1 line per share)."
  - "Whichever ticket wins, prizes split 50/50 (ticket buyer / group)."
- After choosing 1×/2×/5× shares, a collapsible **"Add my Lucky Picks (optional)"** section appears with N number-picker rows — one per share.
- Each row shows the lottery's main-ball range + bonus-ball range (read from a new `lotteries.number_format` JSON: `{main:{count,min,max}, bonus:{count,min,max}}`). Includes a "Quick Pick for me" button that randomizes that row.
- Picks are saved when you confirm payment. Skipping is fine — those shares just default to operator Quick Picks.

**After joining (Dashboard → My Groups + on the group's "About" tab)**
- A "My Lucky Picks" card listing the lines you submitted, with edit/randomize buttons.
- Editing is locked once `picks_locked_at` passes (default: 2 hours before draw; admin-configurable per syndicate).
- A "Group line-up" tab shows total lines purchased, how many are member-suggested vs Quick Pick, and (after tickets are uploaded) which scanned ticket each suggestion maps to.

**Activity / notifications**
- System feed event: "Alice locked in 2 Lucky Picks for Mega Millions Group #4."
- Notification at lock time: "Your Lucky Picks are locked for tonight's draw."
- After results: "Your Lucky Pick matched 3 numbers" (if any).

### What admins see

- Admin panel → Syndicates gets a **"Picks"** view per syndicate:
  - Table of all member-submitted lines (user, share #, numbers, bonus, status: pending / included / quick-picked).
  - "Export CSV for retailer" button (one row per line, ready to hand to whoever buys the physical tickets).
  - "Mark included" / "Mark quick-picked" buttons (so the audit trail is clear if a retailer can't take a custom line).
- New `lotteries.number_format` editor in the Lottery Branding admin tab.
- Per-syndicate `picks_lock_offset_minutes` field (default 120).

### Technical plan

**Schema (one migration)**
- `lotteries.number_format jsonb` — e.g. `{"main":{"count":5,"min":1,"max":70},"bonus":{"count":1,"min":1,"max":25}}`. Backfill defaults for existing lotteries from a static map.
- `syndicates.picks_lock_offset_minutes int default 120`.
- New table `syndicate_picks`:
  - `id`, `syndicate_id`, `membership_id`, `user_id`, `share_index` (1..shares for that membership), `main_numbers int[]`, `bonus_numbers int[]`, `status text` (`pending` / `included` / `quick_picked`), `created_at`, `updated_at`.
  - Unique `(membership_id, share_index)`.
- Validation trigger checks count/min/max against `lotteries.number_format` and that `now() < draw_date - lock_offset` on insert/update.
- RLS: members read/write their own picks; admins read all and update `status`.
- Helper view `syndicate_picks_summary` for the admin "Picks" tab (counts of pending/included per syndicate).

**RPC**
- `upsert_syndicate_picks(_membership_id uuid, _picks jsonb[])` — replaces a member's picks atomically; honors the lock window.
- `quick_pick_for_lottery(_lottery_id uuid)` — server-side randomizer used as a fallback (so the client and server agree on ranges).

**Frontend**
- New `src/components/syndicate/LuckyPicksEditor.tsx` (number grid, bonus row, "QP" per row, validation toasts).
- New `src/components/syndicate/MyPicksCard.tsx` (Dashboard + group page).
- `GroupTicketDetail.tsx`: add the "How numbers work" panel + collapsible picker; pass picks to `SyndicatePayConfirm`.
- `SyndicatePayConfirm.tsx`: after the existing `wallet_join_syndicate` / `wallet_join_syndicate_fx` succeeds, call `upsert_syndicate_picks` with the captured picks. (Card flow does the same on `paystack-verify` success.)
- `paystack-verify` edge function: accept an optional `picks` payload from the callback URL state and upsert after membership is created.
- `src/components/admin/SyndicatePicksManager.tsx` + new tab in `Admin.tsx`.
- `src/components/admin/LotteryBrandingManager.tsx`: add `number_format` editor.
- New hook `useSyndicatePicks(syndicateId)` for read/edit/lock-state.

**Copy added to FAQ on the group page**
- "Do I pick my own numbers?" → "It's optional. Each share gives you one Lucky Pick line we'll add to the group's ticket bundle. Skip it and we use a Quick Pick. Either way, prizes are split 50/50."
- "What's the deadline?" → Pulls dynamically from `picks_lock_offset_minutes`.

### Out of scope (ask separately)
- Members editing each other's picks or voting on shared lines.
- Auto-matching individual scanned tickets to picks (beyond the manual admin "Mark included" action).
- Multi-line per share (each share = exactly 1 line).

### Phasing if you'd rather slice it
1. Schema + member picker + lock window + admin export CSV (ship-ready MVP).
2. Admin "Mark included / quick-picked" + per-pick result matching after results publish.
3. Notifications + feed events + match-count summaries.

Reply **"Build all of it"**, **"Phase 1 only"**, or list parts you want.

