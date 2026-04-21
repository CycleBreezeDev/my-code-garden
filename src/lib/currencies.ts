/**
 * Currencies users can switch the UI display to.
 *
 * `code` is the ISO-4217 code (matches what `Intl.NumberFormat` expects and
 * what your backend `fx_pairs` / `fx_rates` tables use).
 *
 * `symbol` is the human-readable prefix we show on cards where space is
 * tight and a full ISO label would feel clinical.
 *
 * `flag` is the regional indicator emoji — purely decorative.
 */
export type SupportedCurrency = {
  code: string;
  label: string;
  symbol: string;
  flag: string;
};

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: "USD", label: "US Dollar",            symbol: "$",    flag: "🇺🇸" },
  { code: "GHS", label: "Ghanaian Cedi",        symbol: "GH₵",  flag: "🇬🇭" },
  { code: "ZAR", label: "South African Rand",   symbol: "R",    flag: "🇿🇦" },
  { code: "KES", label: "Kenyan Shilling",      symbol: "KSh",  flag: "🇰🇪" },
  { code: "NGN", label: "Nigerian Naira",       symbol: "₦",    flag: "🇳🇬" },
  { code: "XOF", label: "West African CFA",     symbol: "CFA",  flag: "🌍" },
  { code: "XAF", label: "Central African CFA",  symbol: "FCFA", flag: "🌍" },
];

export const DEFAULT_CURRENCY = "USD";

export const findCurrency = (code: string): SupportedCurrency =>
  SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase()) ?? SUPPORTED_CURRENCIES[0];

/**
 * Format an amount in the given currency. Uses Intl when available and
 * falls back to the manual symbol from SUPPORTED_CURRENCIES so unsupported
 * locales still render something reasonable (e.g. CFA on older browsers).
 */
export const formatCurrency = (amount: number, code: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      // CFA traditionally has no decimals; everything else gets 2.
      maximumFractionDigits: code === "XOF" || code === "XAF" ? 0 : 2,
    }).format(amount);
  } catch {
    const c = findCurrency(code);
    const rounded = code === "XOF" || code === "XAF" ? Math.round(amount) : amount;
    return `${c.symbol}${rounded.toFixed(code === "XOF" || code === "XAF" ? 0 : 2)}`;
  }
};
