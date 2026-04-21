import { type ComponentType } from "react";
import { DisplayPrice } from "@/components/DisplayPrice";

export interface HeroBadgeProps {
  /** Lucide icon component (or any component that accepts `className`). */
  icon: ComponentType<{ className?: string }>;
  /** Static label. If `amount` + `currency` are set, this renders before the converted price. */
  text: string;
  /** Optional amount to render via <DisplayPrice />. Falls back to text-only when null/undefined. */
  amount?: number | null;
  /** Source currency for `amount`. Required for the price to render. */
  currency?: string | null;
}

/**
 * Pill-shaped badge used in the hero. When `amount` and `currency` are both
 * present the converted price renders inline via <DisplayPrice />. If either
 * is missing, the badge cleanly falls back to text-only — no empty span,
 * no layout glitch.
 */
export const HeroBadge = ({ icon: Icon, text, amount, currency }: HeroBadgeProps) => {
  const showPrice = amount != null && Boolean(currency);

  return (
    <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary">
        <span>{text}</span>
        {showPrice ? (
          <DisplayPrice
            amount={amount as number}
            sourceCurrency={currency as string}
            className="text-sm font-medium text-primary"
          />
        ) : null}
      </span>
    </div>
  );
};
