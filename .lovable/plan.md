

## Goal

Give every group-ticket member full visibility into the lottery numbers allocated to their shares — whether they self-picked or got operator-assigned Quick Picks — and let them manually verify those numbers against the official scanned ticket bundle.

## What the user will see

### 1. Upgraded "My Lucky Picks" card → "My Allocated Numbers"

On `/group/:slug` (and `/dashboard`), the existing `MyPicksCard` becomes a two-mode card:

- **Before lock** (current behavior, kept): editor for picking numbers per share, "Quick Pick" / "Clear" buttons, save.
- **After lock** (new): read-only "Allocated Numbers" view showing one row per share with:
  - Share number (Share 1, Share 2, …)
  - The actual numbers as colored balls (main + bonus, matching lottery branding)
  - Source badge: **"Your pick"** (green) or **"Quick Pick"** (muted) — driven by the existing `status` field (`included` vs `quick_picked`)
  - A small **"Verify on ticket"** link that scrolls to / opens the matching official scan in the Ticket Images section
  - A "Copy numbers" button (copies "07-12-19-25-33-41 + 04" style text)

### 2. New "Allocated to me" summary strip

Above the per-share list:
- Total lines allocated, how many self-picked vs Quick Pick
- "Verified ✓" indicator once at least one ticket image has been uploaded for the draw
- Lock countdown / "Picks locked" pill (already exists, kept)

### 3. Manual verification flow

In the existing **Ticket Images** section (already member-visible via `ticket_images` table) we add a **"Match my numbers"** toggle. When on, each uploaded ticket scan is rendered with the user's allocated numbers listed beside it so they can eyeball-compare line by line against the printed ticket.

### 4. Dashboard surface

On `/dashboard` → "My Syndicates" each membership row gets a new collapsible **"My numbers (N lines)"** showing the same allocated-numbers list inline, so users don't have to open the group page to verify.

## How it works (technical)

### Data — already in place, no schema change needed

- `syndicate_picks` already stores `main_numbers`, `bonus_numbers`, `status` per share, RLS scoped to owner.
- `ticket_images` already stores official scans, RLS scoped to members.
- `lotteries.number_format` already drives ball colors and ranges.

### Backfill operator Quick Picks (one migration)

When picks lock and the operator buys the bundle, every share that has no row (or an empty row) needs a deterministic Quick Pick stored so the user can see it. Add:

- A migration adding `public.finalize_syndicate_picks(_syndicate_id uuid)` (admin / service-role only) that:
  - Iterates every membership × share_index for the syndicate
  - For any missing share, inserts a row using the existing `quick_pick_for_lottery()` function with `status = 'quick_picked'`
  - For existing user picks, flips `status` from `pending` → `included`
- Wire the existing admin "lock & buy" action (or a new admin button on the Syndicate admin panel) to call this RPC. If no admin trigger currently exists, add a small admin button "Finalize picks & assign Quick Picks" on `LotteryBrandingManager` / a new minimal admin card.

### New components

```text
src/components/syndicate/
  MyPicksCard.tsx          (extended: editor when unlocked, read-only allocation view when locked)
  AllocatedNumbersList.tsx (new: ball rendering, source badge, copy button)
  NumberBalls.tsx          (new: reusable colored ball row)
```

### Hook changes

`useMyPicks` already returns rows with `status` + numbers — no change needed. Add a tiny `useSyndicateTicketImages(syndicateId)` already used by `MyTicketsSection`; reused on the group page.

### Files to edit

- `src/components/syndicate/MyPicksCard.tsx` — split into pre-lock editor and post-lock allocation view
- `src/components/syndicate/AllocatedNumbersList.tsx` — new
- `src/components/syndicate/NumberBalls.tsx` — new (small reusable ball renderer)
- `src/pages/Dashboard.tsx` — add inline "My numbers" expander per membership
- `src/components/MyTicketsSection.tsx` — add "Match my numbers" toggle that overlays the user's allocated lines next to each scan
- `supabase/migrations/<new>.sql` — `finalize_syndicate_picks(uuid)` RPC + grant to admin role
- `src/components/admin/SyndicatePicksManager.tsx` — add "Finalize picks" button calling the RPC (only if not already present)

## Out of scope

- Changing the 50/50 prize split logic
- Changing how the operator actually buys tickets at the lottery operator
- Auto-OCR of ticket scans (manual verification only, per request)

