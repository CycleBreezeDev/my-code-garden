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
  return new Date(date).toLocaleDateString("en-US", { weekday: "long" });
};
