/**
 * Lightweight pub/sub for cross-component identity refreshes.
 *
 * When the signed-in user renames themselves on /profile, every long-lived
 * UI surface that displays a username (chat bubbles, member lists, DM
 * headers, feed cards rendered from cached queries, etc.) needs a chance to
 * refetch — but those surfaces don't share a parent we can lift state into.
 *
 * Using a window-level CustomEvent gives us a zero-dependency broadcast
 * channel: any component can subscribe with `onUsernameChange(cb)` in an
 * effect, and the rename flow calls `emitUsernameChange()` after a successful
 * save. Consumers typically respond by calling `queryClient.invalidateQueries`
 * or by re-running their local fetcher.
 */

export interface UsernameChangeDetail {
  userId: string;
  username: string;
}

const EVENT = "lovable:username-changed";

export const emitUsernameChange = (detail: UsernameChangeDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<UsernameChangeDetail>(EVENT, { detail }));
};

export const onUsernameChange = (cb: (detail: UsernameChangeDetail) => void) => {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<UsernameChangeDetail>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};
