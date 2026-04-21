import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FxQuote {
  rate: number;
  effective_rate: number;
  from: string;
  to: string;
}

/**
 * Fetch the FX rate between two currencies, using the existing `fx-quote`
 * edge function (which itself caches against `fx_rates` for 1 hour).
 *
 * For display-only conversion we use the *raw* `rate` rather than
 * `effective_rate` — the markup is a wallet/withdrawal concept and would
 * mislead users browsing prices.
 *
 * Rates are cached in React Query for 30 minutes per pair so a typical
 * page change doesn't refetch.
 */
export const useFxRate = (from: string, to: string) => {
  const fromU = from.toUpperCase();
  const toU = to.toUpperCase();
  const skip = !fromU || !toU || fromU === toU;

  return useQuery({
    queryKey: ["fx-rate", fromU, toU],
    enabled: !skip,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.functions.invoke<FxQuote>("fx-quote", {
        body: { from: fromU, to: toU, from_amount: 1 },
      });
      if (error) throw error;
      const rate = Number(data?.rate);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid FX rate");
      return rate;
    },
  });
};
