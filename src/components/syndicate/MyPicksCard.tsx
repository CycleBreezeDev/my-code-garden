import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Save, Lock, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LuckyPicksEditor } from "./LuckyPicksEditor";
import { AllocatedNumbersList } from "./AllocatedNumbersList";
import {
  useMyPicks,
  useUpsertPicks,
  computeLockState,
} from "@/hooks/useSyndicatePicks";
import { useSyndicateTicketImages } from "@/hooks/useSyndicateTicketImages";
import { type NumberFormat, type LuckyPick, validatePick } from "@/lib/numberFormat";
import { toast } from "@/hooks/use-toast";

interface Props {
  membershipId: string;
  syndicateId?: string;
  shares: number;
  format: NumberFormat;
  drawDate: string;
  picksLockOffsetMinutes: number;
  syndicateName: string;
  lotteryColor?: string;
  /** Called when "Verify on ticket" is clicked — typically scrolls to the ticket scans section. */
  onVerifyOnTicket?: () => void;
}

export const MyPicksCard = ({
  membershipId,
  syndicateId,
  shares,
  format,
  drawDate,
  picksLockOffsetMinutes,
  syndicateName,
  lotteryColor,
  onVerifyOnTicket,
}: Props) => {
  const { data: existing, isLoading } = useMyPicks(membershipId);
  const { data: ticketImages } = useSyndicateTicketImages(syndicateId);
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

  const summary = useMemo(() => {
    const rows = existing ?? [];
    const yours = rows.filter((p) => p.status === "included").length;
    const quick = rows.filter((p) => p.status === "quick_picked").length;
    const pending = shares - yours - quick;
    return { yours, quick, pending: Math.max(0, pending) };
  }, [existing, shares]);

  const verifiedCount = ticketImages?.length ?? 0;

  const handleSave = async () => {
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
            <h3 className="font-heading text-base font-bold text-foreground">
              {locked ? "My Allocated Numbers" : "My Lucky Picks"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {locked
                ? "Final numbers locked in for this draw — verify against the scanned tickets below."
                : "Optional · 1 line per share · added to the group's bundle"}
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
      ) : locked ? (
        <>
          {/* Summary strip */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
              <div className="font-heading text-lg font-bold text-foreground">{shares}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Lines</div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-center">
              <div className="font-heading text-lg font-bold text-primary">{summary.yours}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Your picks</div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-center">
              <div className="font-heading text-lg font-bold text-foreground">{summary.quick}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick Picks</div>
            </div>
            <div
              className={`rounded-lg border p-2.5 text-center ${
                verifiedCount > 0
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-secondary/30 text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-center gap-1 font-heading text-sm font-bold">
                {verifiedCount > 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Verified
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Pending
                  </>
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wide">
                {verifiedCount > 0 ? `${verifiedCount} scan${verifiedCount > 1 ? "s" : ""}` : "No scans yet"}
              </div>
            </div>
          </div>

          <AllocatedNumbersList
            shares={shares}
            picks={existing ?? []}
            color={lotteryColor}
            onVerify={onVerifyOnTicket}
            showVerifyAction={!!onVerifyOnTicket}
          />
        </>
      ) : (
        <>
          <fieldset disabled={locked} className={locked ? "opacity-60 pointer-events-none" : ""}>
            <LuckyPicksEditor shares={shares} format={format} picks={draft} onChange={setDraft} />
          </fieldset>

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
        </>
      )}
    </div>
  );
};
