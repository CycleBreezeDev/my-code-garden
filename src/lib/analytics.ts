/**
 * Lightweight client-side analytics shim.
 *
 * Dispatches a CustomEvent on `window` and forwards to common providers
 * (gtag, plausible, posthog) when available. No-op on the server. This keeps
 * tracking decoupled from any specific vendor — wire up a real SDK later by
 * listening to the `app:analytics` event or by populating one of the globals.
 */
export type AnalyticsEvent =
  | "purchase_start"
  | "purchase_success"
  | "purchase_failed";

export interface AnalyticsPayload {
  lottery_slug?: string;
  lines_count?: number;
  total?: number;
  currency?: string;
  draw_id?: string;
  ticket_ids?: string[];
  error?: string;
  [key: string]: unknown;
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") return;

  const detail = { event, ...payload, ts: Date.now() };

  try {
    window.dispatchEvent(new CustomEvent("app:analytics", { detail }));
  } catch {
    // ignore
  }

  type GtagFn = (cmd: "event", name: string, params?: Record<string, unknown>) => void;
  type PlausibleFn = (name: string, opts?: { props?: Record<string, unknown> }) => void;
  type PosthogLike = { capture: (name: string, props?: Record<string, unknown>) => void };

  const w = window as unknown as {
    gtag?: GtagFn;
    plausible?: PlausibleFn;
    posthog?: PosthogLike;
  };

  try {
    w.gtag?.("event", event, payload);
    w.plausible?.(event, { props: payload });
    w.posthog?.capture(event, payload);
  } catch {
    // never let analytics crash the app
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, payload);
  }
}
