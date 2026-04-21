import { useCurrency } from "@/contexts/CurrencyContext";
import { useFxRate } from "@/hooks/useFxRate";
import { formatCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { data: rate, isError, isLoading } = useFxRate(sourceCurrency, targetCurrency);

  // Same currency → render source immediately (no conversion needed).
  if (sameCurrency) {
    return (
      <span className={cn("tabular-nums", className)}>
        {formatCurrency(amount, sourceCurrency)}
      </span>
    );
  }

  // Loading state: show skeleton to prevent layout shift.
  if (isLoading) {
    return (
      <span className={cn("tabular-nums inline-flex items-center", className)}>
        <span className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
      </span>
    );
  }

  // Rate fetch failed → fall back to original.
  if (rate == null || isError) {
    return (
      <span className={cn("tabular-nums", className)}>
        {formatCurrency(amount, sourceCurrency)}
      </span>
    );
  }

  const converted = amount * rate;

  // Build tooltip content
  const tooltipContent = showOriginalTooltip ? (
    <div className="space-y-1">
      <p className="font-medium">Original: {formatCurrency(amount, sourceCurrency)}</p>
      <p className="text-xs text-muted-foreground">
        1 {sourceCurrency.toUpperCase()} = {rate.toFixed(4)} {targetCurrency}
      </p>
    </div>
  ) : undefined;

  const priceElement = (
    <span className={cn("tabular-nums", className)}>
      {formatCurrency(converted, targetCurrency)}
    </span>
  );

  if (!showOriginalTooltip) {
    return priceElement;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <span className={cn("tabular-nums cursor-help underline decoration-dotted", className)}>
            {formatCurrency(converted, targetCurrency)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
