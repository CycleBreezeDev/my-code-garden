

## My Profile page (Twitter-style)

A dedicated authenticated route `/profile` linked from the User dropdown menu, presenting the signed-in user's identity in a Twitter-like layout (banner, avatar overlap, name/handle, bio, stats, tabbed content) with full self-service editing for avatar, name, username, bio, country, and password.

### Route & navigation
- New route `/profile` (protected) → `src/pages/MyProfile.tsx`.
- Add a **"My Profile"** item to `UserMenu.tsx` (icon: `UserCircle`) above Dashboard.
- Add a "View public profile" link from this page to `/u/:username` (existing `PublicProfile`).

### Layout (Twitter-inspired)

```text
┌──────────────────────────────────────────────────┐
│  Cover banner (gradient/upload, h-40)            │
│                                                  │
│  ┌────┐                            [Edit profile]│
│  │AVA │  Full Name                               │
│  └────┘  @username · 🇳🇬 Country                 │
│          Bio line — joined Apr 2026              │
│          234 Following · 1.2k Followers          │
├──────────────────────────────────────────────────┤
│ [Posts] [Tickets] [Groups] [Followers] [Following] [Settings] │
├──────────────────────────────────────────────────┤
│   …tab content…                                  │
└──────────────────────────────────────────────────┘
```

### Tabs (relevant to this lottery platform)
1. **Posts** — the user's own `feed_posts` (joins, ticket uploads, payouts, manual posts), reusing `FeedCard`.
2. **Tickets** — embeds existing `MyTicketsSection` (purchased lottery tickets).
3. **Groups** — `syndicate_memberships` list (lottery name, draw date, shares, amount paid) — reuses the card style from `Dashboard`.
4. **Followers** / **Following** — user lists (reuses the `UserList` pattern from `PublicProfile`) with `FollowButton`.
5. **Settings** — inline panel with the edit forms below.

### Settings tab — editable fields
- **Avatar**: upload via new `avatars` storage bucket; preview, replace, remove. Updates `profiles.avatar_url`.
- **Cover banner**: optional upload (same bucket, `covers/` prefix) → new `profiles.cover_url` column.
- **Full name**: updates `profiles.full_name`.
- **Username** (`@handle`): updates `user_profiles_public.username` with the existing 3–24 char regex; on change, links update automatically.
- **Bio** (≤280 chars), **Country code** (ISO-2), **Public profile toggle** → `user_profiles_public`.
- **Email**: shown read-only with a "Change email" button calling `supabase.auth.updateUser({ email })` (sends confirmation).
- **Password change**: current-style form with new + confirm fields → `supabase.auth.updateUser({ password })`. Requires the user to be in an active session; show success toast.
- **Notification prefs**: `email_digest_enabled` toggle (already in schema).
- **Danger zone**: "Sign out everywhere" button (`supabase.auth.signOut({ scope: 'global' })`).

All forms use **zod** + react-hook-form for validation, inline field errors, and disabled submit while saving.

### Backend changes (one migration)
1. **Storage bucket** `avatars` (public) with RLS:
   - SELECT: anyone (public bucket).
   - INSERT/UPDATE/DELETE: only when `(storage.foldername(name))[1] = auth.uid()::text` — each user writes only inside their own folder `avatars/<uid>/…`.
2. **Add column** `profiles.cover_url TEXT NULL`.
3. **Helper RPC** `my_profile_overview()` (SECURITY DEFINER, returns profile + public profile + counts) — optional convenience; otherwise the page does two parallel selects.

### New / updated files
- **Create**: `src/pages/MyProfile.tsx` (page + tabs orchestration).
- **Create**: `src/components/profile/ProfileHeader.tsx` (banner, avatar, name, handle, stats, edit button).
- **Create**: `src/components/profile/AvatarUploader.tsx` (drop zone + crop-to-square preview + storage upload).
- **Create**: `src/components/profile/CoverUploader.tsx`.
- **Create**: `src/components/profile/EditProfileDialog.tsx` (name/username/bio/country/public toggle in one modal — opened by header "Edit profile" button).
- **Create**: `src/components/profile/AccountSettingsCard.tsx` (email change + password change + digest + sign-out-everywhere).
- **Create**: `src/components/profile/MyPostsTab.tsx` (queries `feed_posts WHERE user_id = me`, reuses `FeedCard` shape).
- **Create**: `src/hooks/useMyProfile.ts` (fetch + update helpers, invalidates `AuthContext` profile).
- **Update**: `src/components/UserMenu.tsx` (add "My Profile" item + `UserCircle` icon).
- **Update**: `src/App.tsx` (register `/profile` protected route).
- **Update**: `src/contexts/AuthContext.tsx` (expose a `refreshProfile()` so edits reflect immediately in the navbar/menu).
- **Migration**: `supabase/migrations/<ts>_my_profile.sql` — `avatars` bucket + storage policies + `profiles.cover_url` column.

### UX details
- Header collapses gracefully on mobile (avatar shrinks to `h-20 w-20`, stats wrap).
- Active tab synced with `?tab=` query param so refresh keeps the view.
- Optimistic updates for avatar (immediate preview) with rollback on storage error.
- All toasts via `sonner`; loading via `Loader2`.
- Empty states for each tab ("No posts yet — share your first win", etc.).

### Security
- Password & email updates only via Supabase Auth client SDK (no custom RPC).
- Storage policies scope writes to the user's own folder.
- Username uniqueness enforced by existing DB constraint; client surfaces the friendly error.
- No role/permission fields are editable from this page (admin elevation stays in `user_roles`).

