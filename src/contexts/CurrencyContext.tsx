import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CURRENCY } from "@/lib/currencies";

const STORAGE_KEY = "epiclotto:display-currency";
const AUTO_DETECTED_FLAG = "epiclotto:display-currency:auto-detected";

interface CurrencyContextValue {
  /** Currency code the UI should display amounts in (e.g. "USD", "NGN"). */
  currency: string;
  /** Update the display currency and persist the choice. */
  setCurrency: (code: string) => void;
  /** True while the initial IP-based detection request is in flight. */
  detecting: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

/**
 * Provides a global "display currency" used by `<DisplayPrice />` and the
 * header switcher. The actual wallet currency, transactions, and payment
 * flows are NOT affected — this is presentation only.
 *
 * Detection logic:
 *   1. If the user has previously chosen a currency, use it.
 *   2. Otherwise, on first mount only, call the `detect-country` edge
 *      function once and apply the suggested currency.
 *   3. If detection fails, stay on the default (USD).
 *
 * The auto-detect runs at most once per browser; subsequent visits read
 * the stored choice without making a network call.
 */
export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CURRENCY;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY;
  });
  const [detecting, setDetecting] = useState(false);
  const didDetect = useRef(false);

  const setCurrency = useCallback((code: string) => {
    const next = code.toUpperCase();
    setCurrencyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Mark as user-chosen so we never auto-overwrite on later visits.
      localStorage.setItem(AUTO_DETECTED_FLAG, "1");
    } catch {
      /* Storage quota or private mode — non-fatal. */
    }
  }, []);

  useEffect(() => {
    if (didDetect.current) return;
    didDetect.current = true;
    // Skip detection if the user already has a saved preference.
    const stored = localStorage.getItem(STORAGE_KEY);
    const wasAutoDetected = localStorage.getItem(AUTO_DETECTED_FLAG);
    if (stored && wasAutoDetected) return;

    setDetecting(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("detect-country", { body: {} });
        if (!error && data?.currency && typeof data.currency === "string") {
          // Only apply if the user hasn't manually changed it during the request.
          if (!localStorage.getItem(AUTO_DETECTED_FLAG)) {
            setCurrencyState(data.currency.toUpperCase());
            localStorage.setItem(STORAGE_KEY, data.currency.toUpperCase());
            localStorage.setItem(AUTO_DETECTED_FLAG, "auto");
          }
        }
      } catch {
        /* Detection is best-effort; fall back to default silently. */
      } finally {
        setDetecting(false);
      }
    })();
  }, []);

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, setCurrency, detecting }),
    [currency, setCurrency, detecting],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};

export const useCurrency = (): CurrencyContextValue => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
};
