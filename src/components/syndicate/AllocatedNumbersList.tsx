import { Copy, Sparkles, Shuffle, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberBalls } from "./NumberBalls";
import type { SyndicatePickRow } from "@/hooks/useSyndicatePicks";

interface Props {
  shares: number;
  picks: SyndicatePickRow[];
  color?: string;
  onVerify?: () => void;
  showVerifyAction?: boolean;
}

const formatLine = (main: number[], bonus: number[]) => {
  const m = main.map((n) => String(n).padStart(2, "0")).join("-");
  const b = bonus.length ? ` + ${bonus.map((n) => String(n).padStart(2, "0")).join("-")}` : "";
  return `${m}${b}`;
};

/**
 * Read-only "Allocated Numbers" view: one row per share with source badge,
 * copy button and (optional) jump-to-ticket-scan action.
 */
export const AllocatedNumbersList = ({
  shares,
  picks,
  color,
  onVerify,
  showVerifyAction = true,
}: Props) => {
  // Build a row per share index (1..shares) so missing rows still render a placeholder.
  const rows = Array.from({ length: shares }, (_, i) => {
    const idx = i + 1;
    const row = picks.find((p) => p.share_index === idx) ?? null;
    return { idx, row };
  });

  const handleCopy = async (row: SyndicatePickRow) => {
    try {
      await navigator.clipboard.writeText(formatLine(row.main_numbers, row.bonus_numbers));
      toast.success("Numbers copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <ul className="space-y-2.5">
      {rows.map(({ idx, row }) => {
        const isYours = row?.status === "included";
        const isQuick = row?.status === "quick_picked";
        const pending = !row || row.status === "pending";

        return (
          <li
            key={idx}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/20 p-3"
          >
            <span className="inline-flex h-7 min-w-[3rem] items-center justify-center rounded-md bg-card px-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Share {idx}
            </span>

            <div className="flex-1 min-w-0">
              {row ? (
                <NumberBalls main={row.main_numbers} bonus={row.bonus_numbers} color={color} size="sm" />
              ) : (
                <span className="text-xs italic text-muted-foreground">
                  Awaiting Quick Pick allocation
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isYours && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase text-primary">
                  <Sparkles className="h-3 w-3" /> Your pick
                </span>
              )}
              {isQuick && (
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                  <Shuffle className="h-3 w-3" /> Quick Pick
                </span>
              )}
              {pending && (
                <span className="inline-flex items-center gap-1 rounded-md bg-accent/20 px-2 py-1 text-[10px] font-bold uppercase text-accent-foreground">
                  Pending
                </span>
              )}

              {row && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleCopy(row)}
                  aria-label={`Copy share ${idx} numbers`}
                  title="Copy numbers"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}

              {showVerifyAction && row && onVerify && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-primary hover:text-primary"
                  onClick={onVerify}
                >
                  <Eye className="mr-1 h-3 w-3" /> Verify
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
