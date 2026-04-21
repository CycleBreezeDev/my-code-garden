import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrency } from "@/contexts/CurrencyContext";
import { SUPPORTED_CURRENCIES, findCurrency } from "@/lib/currencies";
import { cn } from "@/lib/utils";

interface Props {
  /** When true, render full label instead of compact chip — used in the mobile menu. */
  fullWidth?: boolean;
}

/**
 * Header dropdown letting users choose how prices across the marketing
 * surfaces are displayed. The actual wallet currency is unaffected.
 */
export const CurrencySwitcher = ({ fullWidth = false }: Props) => {
  const { currency, setCurrency, detecting } = useCurrency();
  const active = findCurrency(currency);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5 border-border bg-card font-medium",
            fullWidth ? "w-full justify-between" : "px-2.5",
          )}
          aria-label={`Display currency: ${active.label}`}
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="text-base leading-none">{active.flag}</span>
            <span className="text-xs font-semibold">{active.code}</span>
          </span>
          {detecting ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Display currency
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_CURRENCIES.map((c) => {
          const isActive = c.code === currency;
          return (
            <DropdownMenuItem
              key={c.code}
              onClick={() => setCurrency(c.code)}
              className="gap-2 text-sm"
            >
              <span aria-hidden className="text-base">{c.flag}</span>
              <span className="flex-1">
                <span className="font-semibold">{c.code}</span>
                <span className="ml-2 text-xs text-muted-foreground">{c.label}</span>
              </span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
