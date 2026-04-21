import { useMemo } from "react";
import { Sparkles, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type NumberFormat,
  type LuckyPick,
  quickPick,
} from "@/lib/numberFormat";

interface Props {
  shares: number;
  format: NumberFormat;
  picks: LuckyPick[];
  onChange: (picks: LuckyPick[]) => void;
}

const NumberGrid = ({
  count,
  min,
  max,
  selected,
  onToggle,
  variant = "main",
}: {
  count: number;
  min: number;
  max: number;
  selected: number[];
  onToggle: (n: number) => void;
  variant?: "main" | "bonus";
}) => {
  const numbers = useMemo(() => {
    const out: number[] = [];
    for (let i = min; i <= max; i++) out.push(i);
    return out;
  }, [min, max]);

  return (
    <div className="grid grid-cols-10 gap-1 sm:grid-cols-10">
      {numbers.map((n) => {
        const isSel = selected.includes(n);
        const isFull = !isSel && selected.length >= count;
        return (
          <button
            key={n}
            type="button"
            disabled={isFull}
            onClick={() => onToggle(n)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all ${
              isSel
                ? variant === "bonus"
                  ? "border-accent bg-accent text-accent-foreground scale-105 shadow-sm"
                  : "border-primary bg-primary text-primary-foreground scale-105 shadow-sm"
                : isFull
                ? "border-border bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                : "border-border bg-secondary text-foreground hover:border-primary/60"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
};

export const LuckyPicksEditor = ({ shares, format, picks, onChange }: Props) => {
  // Ensure we have one row per share
  const rows: LuckyPick[] = useMemo(() => {
    const out: LuckyPick[] = [];
    for (let i = 1; i <= shares; i++) {
      const existing = picks.find((p) => p.share_index === i);
      out.push(existing ?? { share_index: i, main: [], bonus: [] });
    }
    return out;
  }, [shares, picks]);

  const update = (idx: number, patch: Partial<LuckyPick>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange(next);
  };

  const toggleMain = (idx: number, n: number) => {
    const row = rows[idx];
    const has = row.main.includes(n);
    let next = has ? row.main.filter((x) => x !== n) : [...row.main, n];
    if (!has && next.length > format.main.count) return;
    next = next.sort((a, b) => a - b);
    update(idx, { main: next });
  };

  const toggleBonus = (idx: number, n: number) => {
    const row = rows[idx];
    const has = row.bonus.includes(n);
    let next = has ? row.bonus.filter((x) => x !== n) : [...row.bonus, n];
    if (!has && next.length > format.bonus.count) return;
    next = next.sort((a, b) => a - b);
    update(idx, { bonus: next });
  };

  const randomize = (idx: number) => {
    update(idx, {
      main: quickPick(format.main.count, format.main.min, format.main.max),
      bonus:
        format.bonus.count > 0
          ? quickPick(format.bonus.count, format.bonus.min, format.bonus.max)
          : [],
    });
  };

  const clear = (idx: number) => update(idx, { main: [], bonus: [] });

  return (
    <div className="space-y-4">
      {rows.map((row, idx) => {
        const mainOk = row.main.length === format.main.count;
        const bonusOk = format.bonus.count === 0 || row.bonus.length === format.bonus.count;
        const isComplete = mainOk && bonusOk;
        const isEmpty = row.main.length === 0 && row.bonus.length === 0;
        return (
          <div
            key={row.share_index}
            className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  Share {row.share_index}
                </span>
                {isComplete && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    ✓ Complete
                  </span>
                )}
                {!isComplete && !isEmpty && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Incomplete
                  </span>
                )}
                {isEmpty && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Will use Quick Pick
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => randomize(idx)}
                >
                  <Shuffle className="mr-1 h-3 w-3" /> Quick Pick
                </Button>
                {!isEmpty && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => clear(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] text-muted-foreground">
                Main numbers · pick {format.main.count} ({format.main.min}–{format.main.max})
              </div>
              <NumberGrid
                count={format.main.count}
                min={format.main.min}
                max={format.main.max}
                selected={row.main}
                onToggle={(n) => toggleMain(idx, n)}
              />
            </div>

            {format.bonus.count > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  Bonus · pick {format.bonus.count} ({format.bonus.min}–{format.bonus.max})
                </div>
                <NumberGrid
                  count={format.bonus.count}
                  min={format.bonus.min}
                  max={format.bonus.max}
                  selected={row.bonus}
                  onToggle={(n) => toggleBonus(idx, n)}
                  variant="bonus"
                />
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-[11px] text-muted-foreground">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Lucky Picks are optional. Any incomplete row will be filled with a Quick Pick when the operator buys the bundle. You can edit them later from your dashboard until picks lock.
        </span>
      </div>
    </div>
  );
};
