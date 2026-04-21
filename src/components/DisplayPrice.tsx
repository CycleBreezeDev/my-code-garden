import { useCurrency } from "@/contexts/CurrencyContext";
import { useFxRate } from "@/hooks/useFxRate";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

interface Props {
  /** Amount in the source currency. */
  amount: number;
  /** Source currency code (e.g. wallet currency, ticket price currency). */
  sourceCurrency?: string;
  /** Optional className passthrough. */
  className?: string;
  /** Show the original currency in a tooltip. Defaults to true. */
  showOriginalTooltip?: boolean;
}

/**
 * Renders an amount in the user's chosen display currency, converting from
 * the source currency on the fly. While the FX rate is loading we show
 * the original amount so the UI never shifts. If the rate fetch fails we
 * also fall back to the original — converted prices that "go missing" are
 * worse than slightly less localised ones.
 *
 * This is presentation only. Wallet balances, transactions, withdrawals
 * and top-ups continue to use their real currency.
 */
export const DisplayPrice = ({
  amount,
  sourceCurrency = "USD",
  className,
  showOriginalTooltip = true,
}: Props) => {
  const { currency: targetCurrency } = useCurrency();
  const sameCurrency = sourceCurrency.toUpperCase() === targetCurrency.toUpperCase();
  const { data: rate, isError } = useFxRate(sourceCurrency, targetCurrency);

  // Same currency, or no rate yet, or rate fetch failed → render source.
  if (sameCurrency || rate == null || isError) {
    return (
      <span className={cn("tabular-nums", className)}>
        {formatCurrency(amount, sourceCurrency)}
      </span>
    );
  }

  const converted = amount * rate;
  const tooltip = showOriginalTooltip
    ? `${formatCurrency(amount, sourceCurrency)} · 1 ${sourceCurrency.toUpperCase()} = ${rate.toFixed(4)} ${targetCurrency}`
    : undefined;

  return (
    <span className={cn("tabular-nums", className)} title={tooltip}>
      {formatCurrency(converted, targetCurrency)}
    </span>
  );
};
