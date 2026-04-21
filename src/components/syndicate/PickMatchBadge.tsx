import { Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  mainMatches: number;
  bonusMatches: number;
  className?: string;
}

/**
 * Compact "matched X numbers" pill shown on a pick after the draw is scored.
 * Color escalates with hit count: muted (0) → primary (1+) → trophy gold (3+).
 * Returns null when there's nothing to brag about (0 main + 0 bonus).
 */
export const PickMatchBadge = ({ mainMatches, bonusMatches, className }: Props) => {
  const total = mainMatches + bonusMatches;
  if (total <= 0) return null;

  const isBig = mainMatches >= 3;
  const Icon = isBig ? Trophy : Sparkles;

  // Compose label: "matched 3 numbers" or "matched 2 + 1 bonus"
  const label = bonusMatches > 0
    ? `Matched ${mainMatches} + ${bonusMatches} bonus`
    : `Matched ${mainMatches} number${mainMatches === 1 ? "" : "s"}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
        isBig
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-primary/15 text-primary",
        className,
      )}
      title={`${mainMatches} main + ${bonusMatches} bonus matches`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};
