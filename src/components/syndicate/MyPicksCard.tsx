import { useEffect, useState } from "react";
import { Loader2, Sparkles, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LuckyPicksEditor } from "./LuckyPicksEditor";
import {
  useMyPicks,
  useUpsertPicks,
  computeLockState,
} from "@/hooks/useSyndicatePicks";
import { type NumberFormat, type LuckyPick, validatePick } from "@/lib/numberFormat";
import { toast } from "@/hooks/use-toast";

interface Props {
  membershipId: string;
  shares: number;
  format: NumberFormat;
  drawDate: string;
  picksLockOffsetMinutes: number;
  syndicateName: string;
}

export const MyPicksCard = ({
  membershipId,
  shares,
  format,
  drawDate,
  picksLockOffsetMinutes,
  syndicateName,
}: Props) => {
  const { data: existing, isLoading } = useMyPicks(membershipId);
  const upsert = useUpsertPicks();
  const [draft, setDraft] = useState<LuckyPick[]>([]);

  useEffect(() => {
    if (existing) {
      const initial: LuckyPick[] = [];
      for (let i = 1; i <= shares; i++) {
        const found = existing.find((p) => p.share_index === i);
        initial.push({
          share_index: i,
          main: found?.main_numbers ?? [],
          bonus: found?.bonus_numbers ?? [],
        });
      }
      setDraft(initial);
    }
  }, [existing, shares]);

  const { locked, locksAt } = computeLockState(drawDate, picksLockOffsetMinutes);

  const handleSave = async () => {
    // Validate every non-empty pick
    const cleaned = draft.filter((p) => p.main.length > 0 || p.bonus.length > 0);
    for (const p of cleaned) {
      const err = validatePick(p, format);
      if (err) {
        toast({ title: `Share ${p.share_index}`, description: err, variant: "destructive" });
        return;
      }
    }
    try {
      await upsert.mutateAsync({ membershipId, picks: cleaned });
      toast({
        title: "Lucky Picks saved",
        description: cleaned.length
          ? `${cleaned.length} pick${cleaned.length > 1 ? "s" : ""} locked in for ${syndicateName}.`
          : "All shares set to Quick Pick.",
      });
    } catch (e) {
      toast({
        title: "Could not save picks",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-heading text-base font-bold text-foreground">My Lucky Picks</h3>
            <p className="text-xs text-muted-foreground">
              Optional · 1 line per share · added to the group's bundle
            </p>
          </div>
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" /> Locked
          </span>
        ) : (
          locksAt && (
            <span className="text-[11px] text-muted-foreground">
              Locks {locksAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <fieldset disabled={locked} className={locked ? "opacity-60 pointer-events-none" : ""}>
            <LuckyPicksEditor shares={shares} format={format} picks={draft} onChange={setDraft} />
          </fieldset>

          {!locked && (
            <Button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="mt-4 w-full bg-primary text-primary-foreground"
            >
              {upsert.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Lucky Picks
            </Button>
          )}
        </>
      )}
    </div>
  );
};
