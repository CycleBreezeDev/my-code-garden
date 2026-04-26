/**
 * Shared layout constants. The fixed-header height is defined once in CSS
 * (`--header-height` in `src/index.css`) and may change per breakpoint via
 * `@media` overrides. JS reads the live computed value so a CSS-only tweak
 * automatically propagates to every smooth-scroll call.
 */
import { useEffect, useState } from "react";

/**
 * Fallback used during SSR or before the CSS variable resolves on the
 * very first paint. Keep aligned with the base `--header-height` in
 * `src/index.css` (`:root` selector).
 */
export const FIXED_HEADER_HEIGHT_FALLBACK = 80;

/**
 * Read the current `--header-height` CSS custom property from the root
 * element. Returns a pixel number. Safe to call from anywhere — falls
 * back to {@link FIXED_HEADER_HEIGHT_FALLBACK} when window isn't ready.
 *
 * This is the canonical way for JS to learn the active navbar height,
 * because the CSS variable is breakpoint-aware (see media-query overrides
 * in `src/index.css`).
 */
export const getFixedHeaderOffset = (): number => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return FIXED_HEADER_HEIGHT_FALLBACK;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--header-height");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FIXED_HEADER_HEIGHT_FALLBACK;
};

/**
 * React hook returning the current fixed-header offset. Re-evaluates on
 * window resize so layouts that depend on the offset (sticky headers,
 * scroll-spy, in-page anchor highlights) stay accurate when the user
 * crosses a breakpoint or rotates a device.
 */
export const useFixedHeaderOffset = (): number => {
  const [offset, setOffset] = useState<number>(() => getFixedHeaderOffset());

  useEffect(() => {
    const update = () => setOffset(getFixedHeaderOffset());
    // Re-read once after mount in case the first render happened before
    // CSS finished applying the breakpoint-specific custom property.
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return offset;
};

/**
 * Smoothly scroll the element with the given id into view, accounting for
 * the fixed top navbar. Returns true when the element exists. Uses the
 * live CSS variable so the offset is always correct for the current
 * breakpoint.
 */
export const smoothScrollToId = (id: string): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - getFixedHeaderOffset();
  window.scrollTo({ top, behavior: "smooth" });
  return true;
};
