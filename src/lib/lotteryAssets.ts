export type LotteryBranding = {
  slug: string;
  name?: string | null;
  color?: string | null;
  icon?: string | null;
  draw_days?: string | null;
  logo_url?: string | null;
};

export const getColor = (l?: LotteryBranding | null): string => l?.color || "#3498db";

export const getIcon = (l?: LotteryBranding | null): string =>
  l?.icon || (l?.name ? l.name.slice(0, 2).toUpperCase() : "??");

export const getDrawDays = (l?: LotteryBranding | null): string => l?.draw_days || "";

export const getLogo = (l?: LotteryBranding | null): string | undefined => l?.logo_url || undefined;

export const formatJackpot = (amount: number, currency: string) => {
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  if (amount >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} billion`;
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(0)} million`;
  return `${symbol}${amount.toLocaleString()}`;
};

export const formatPrice = (amount: number, currency: string = "USD") => {
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${symbol}${amount.toFixed(2)}`;
};

export const secondsUntil = (date: string | Date) => {
  const t = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.floor(t / 1000));
};

export const dayName = (date: string | Date) => {
  // Day name as it falls in CAT (Central Africa Time, UTC+2, no DST) — the
  // canonical reference timezone for all lottery draws across the platform.
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: CAT_TIMEZONE,
  });
};

// =============================================================
// Timezone helpers
// All lottery draws are scheduled in CAT (Central Africa Time, UTC+2).
// We display CAT as the canonical reference and append the viewer's local
// time when their timezone resolves to something different, so users in
// any region see a consistent baseline without ambiguity.
// =============================================================

export const CAT_TIMEZONE = "Africa/Harare"; // UTC+2, no DST

const getViewerTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const isViewerInCAT = (): boolean => {
  const tz = getViewerTimezone();
  if (tz === CAT_TIMEZONE) return true;
  // Treat any +02:00 fixed offset as equivalent to CAT for display purposes.
  try {
    const offsetMin = -new Date().getTimezoneOffset(); // minutes east of UTC
    return offsetMin === 120 && /africa|harare|johannesburg|kigali|maputo|lusaka/i.test(tz);
  } catch {
    return false;
  }
};

type DrawDateStyle = "full" | "dateOnly" | "short";

const STYLE_OPTIONS: Record<DrawDateStyle, Intl.DateTimeFormatOptions> = {
  full: {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  dateOnly: {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  },
  short: {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
};

/**
 * Formats a draw timestamp for display.
 * Always shows CAT (the canonical draw timezone) and appends the viewer's
 * local time when they aren't already on UTC+2, so countdowns and dates
 * never feel confusing across regions.
 */
export const formatDrawDate = (
  date: string | Date,
  style: DrawDateStyle = "full",
): string => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const opts = STYLE_OPTIONS[style];
  const cat = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: CAT_TIMEZONE }).format(d);
  if (style === "dateOnly" || isViewerInCAT()) {
    return `${cat} CAT`;
  }
  const viewerTz = getViewerTimezone();
  const local = new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: viewerTz }).format(d);
  // Short label for the viewer's zone (e.g. "GMT+1") to keep the line compact.
  let localTzLabel = "local";
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: viewerTz, timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName");
    if (parts?.value) localTzLabel = parts.value;
  } catch {
    /* ignore */
  }
  return `${cat} CAT · ${local} ${localTzLabel}`;
};
