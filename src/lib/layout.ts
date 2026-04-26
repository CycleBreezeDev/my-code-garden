/**
 * Shared layout constants. Keep these in sync with the Navbar/BottomNav
 * components so anchor scrolling, sticky offsets, and scroll-margin all
 * agree across the app.
 *
 * The fixed header is the same height across breakpoints (Navbar uses a
 * static `py-3` row), so we expose one number. If we ever introduce a
 * taller mobile/desktop variant, switch `getFixedHeaderOffset()` to read
 * `window.matchMedia` and return the right value per breakpoint — every
 * caller will pick it up automatically.
 */

/** Pixel height of the fixed top navbar. Matches `pt-20` page padding. */
/**
 * Pixel height of the fixed top navbar. Matches `pt-20` page padding and
 * the `--header-height` CSS variable in `src/index.css` (which powers
 * `html { scroll-padding-top }` and the `.scroll-mt-header` utility).
 * Update all three together if the navbar height ever changes.
 */
export const FIXED_HEADER_HEIGHT = 80;

/**
 * Returns the current fixed-header offset to subtract when scrolling an
 * anchor into view. Centralized so we don't sprinkle magic numbers across
 * the codebase.
 */
export const getFixedHeaderOffset = (): number => FIXED_HEADER_HEIGHT;

/**
 * Smoothly scroll the element with the given id into view, accounting for
 * the fixed top navbar. Returns true when the element exists.
 */
export const smoothScrollToId = (id: string): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - getFixedHeaderOffset();
  window.scrollTo({ top, behavior: "smooth" });
  return true;
};
