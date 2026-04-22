import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Trophy,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CreateDrawCard from "./CreateDrawCard";
import DrawEditCard from "./DrawEditCard";

type DrawRow = {
  id: string;
  draw_date: string;
  status: string;
  jackpot_amount: number;
  currency: string;
  lottery: { name: string };
  syndicates: { id: string; name: string; sold_shares: number; total_shares: number }[] | null;
  draw_results: { id: string }[] | null;
};

const numberArraySchema = z
  .string()
  .trim()
  .min(1, "Required")
  .transform((s) =>
    s
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((n) => Number(n)),
  )
  .refine((arr) => arr.length >= 1, { message: "Enter at least one number" })
  .refine((arr) => arr.every((n) => Number.isInteger(n) && n >= 1 && n <= 99), {
    message: "Numbers must be integers between 1 and 99",
  })
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "Numbers must be unique",
  });

type ValidatedPayload = {
  winning: number[];
  bonus: number[];
  prizes: { syndicate_id: string; gross_prize: number }[];
  totalPrize: number;
};

type FieldErrors = {
  winning?: string;
  bonus?: string;
  prizes?: Record<string, string>;
};

export const DrawsManager = () => {
  const qc = useQueryClient();
  const [selectedDrawId, setSelectedDrawId] = useState<string>("");
  const [winningStr, setWinningStr] = useState("");
  const [bonusStr, setBonusStr] = useState("");
  const [prizes, setPrizes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState<
    { slug: string; ok: boolean; error?: string; jackpot?: string }[] | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ValidatedPayload | null>(null);
  const [editingDrawId, setEditingDrawId] = useState<string | null>(null);

  const handleRefreshFeeds = async () => {
    setRefreshing(true);
    setRefreshResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-lottery-feeds", {
        body: {},
      });
      if (error) throw error;
      const results = (data?.results ?? []) as {
        slug: string;
        ok: boolean;
        error?: string;
        jackpot?: string;
      }[];
      setRefreshResults(results);
      const okCount = results.filter((r) => r.ok).length;
      if (okCount === results.length) {
        toast.success(`Refreshed all ${results.length} lottery feeds`);
      } else {
        toast.warning(`Refreshed ${okCount}/${results.length} feeds — see details`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refresh failed";
      toast.error(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const { data: draws, isLoading } = useQuery({
    queryKey: ["admin-draws"],
    queryFn: async (): Promise<DrawRow[]> => {
      const { data, error } = await supabase
        .from("lottery_draws")
        .select(
          "id, draw_date, status, jackpot_amount, currency, lottery:lotteries!inner(name), syndicates(id, name, sold_shares, total_shares), draw_results(id)",
        )
        .order("draw_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      // PostgREST returns null (not []) for empty embedded relations — normalise here
      // so render code can safely call .length / .map / .find on these arrays.
      return ((data as unknown as DrawRow[]) ?? []).map((d) => ({
        ...d,
        syndicates: d.syndicates ?? [],
        draw_results: d.draw_results ?? [],
      }));
    },
  });

  const selectedDraw = draws?.find((d) => d.id === selectedDrawId);
  const alreadyPublished = (selectedDraw?.draw_results?.length ?? 0) > 0;

  const formatMoney = useMemo(
    () => (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currency} ${amount.toFixed(2)}`;
      }
    },
    [],
  );

  const validate = (): ValidatedPayload | null => {
    if (!selectedDraw) {
      toast.error("Select a draw first");
      return null;
    }
    const next: FieldErrors = {};

    const winParse = numberArraySchema.safeParse(winningStr);
    if (!winParse.success) {
      next.winning = winParse.error.errors[0].message;
    }

    let bonus: number[] = [];
    if (bonusStr.trim()) {
      const bonusParse = numberArraySchema.safeParse(bonusStr);
      if (!bonusParse.success) {
        next.bonus = bonusParse.error.errors[0].message;
      } else {
        bonus = bonusParse.data;
      }
    }

    if (winParse.success && bonus.length > 0) {
      const overlap = bonus.filter((n) => winParse.data.includes(n));
      if (overlap.length > 0) {
        next.bonus = `Bonus cannot overlap winning numbers (${overlap.join(", ")})`;
      }
    }

    const prizeErrors: Record<string, string> = {};
    const prizeRows: { syndicate_id: string; gross_prize: number }[] = [];
    for (const s of selectedDraw.syndicates ?? []) {
      const raw = (prizes[s.id] ?? "").trim();
      if (!raw) continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        prizeErrors[s.id] = "Must be ≥ 0";
        continue;
      }
      if (num > 0) prizeRows.push({ syndicate_id: s.id, gross_prize: num });
    }
    if (Object.keys(prizeErrors).length > 0) next.prizes = prizeErrors;

    setErrors(next);

    if (next.winning || next.bonus || next.prizes) {
      toast.error("Please fix the errors before publishing");
      return null;
    }

    return {
      winning: winParse.success ? winParse.data : [],
      bonus,
      prizes: prizeRows,
      totalPrize: prizeRows.reduce((sum, p) => sum + p.gross_prize, 0),
    };
  };

  const handlePublishClick = () => {
    if (alreadyPublished) {
      toast.error("Results have already been published for this draw");
      return;
    }
    const payload = validate();
    if (!payload) return;
    setPendingPayload(payload);
    setConfirmOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!selectedDraw || !pendingPayload) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("publish_draw_results", {
        _draw_id: selectedDraw.id,
        _winning_numbers: pendingPayload.winning,
        _bonus_numbers: pendingPayload.bonus,
        _prizes: pendingPayload.prizes,
      });
      if (error) throw error;
      toast.success("Results published and payouts distributed");
      setWinningStr("");
      setBonusStr("");
      setPrizes({});
      setSelectedDrawId("");
      setErrors({});
      setPendingPayload(null);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const syndicateName = (id: string) =>
    selectedDraw?.syndicates?.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {/* Create new draw */}
      <CreateDrawCard />

      {/* Lottery feeds refresh */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Live lottery feeds</h2>
            <p className="text-xs text-muted-foreground">
              Refresh jackpots & next-draw times by scraping official sites.
            </p>
          </div>
          <Button onClick={handleRefreshFeeds} disabled={refreshing} variant="outline" className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Refreshing..." : "Refresh now"}
          </Button>
        </div>
        {refreshResults && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {refreshResults.map((r) => (
              <div
                key={r.slug}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                  r.ok ? "border-primary/20 bg-primary/5" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{r.slug}</div>
                  <div className="truncate text-muted-foreground">
                    {r.ok ? r.jackpot ?? "Updated" : r.error ?? "Failed"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Draw picker */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Select a draw</h2>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : draws && draws.length > 0 ? (
            <div className="space-y-2">
              {draws.map((d) => {
                const syndicateCount = d.syndicates?.length ?? 0;
                const published = (d.draw_results?.length ?? 0) > 0;
                const isSelected = d.id === selectedDrawId;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      setSelectedDrawId(d.id);
                      setPrizes({});
                      setErrors({});
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/20 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground">{d.lottery?.name ?? "Unknown lottery"}</div>
                      {published && (
                        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Published
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(d.draw_date).toLocaleString()} · {syndicateCount} syndicate
                      {syndicateCount === 1 ? "" : "s"}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No draws found.</p>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border bg-card p-5">
          {!selectedDraw ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              <Trophy className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a draw to publish results</p>
            </div>
          ) : (
            <>
              <h2 className="mb-1 text-sm font-semibold text-foreground">{selectedDraw.lottery.name}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {new Date(selectedDraw.draw_date).toLocaleString()}
              </p>
              {alreadyPublished && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Results have already been published for this draw.
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="winning" className="text-xs">Winning numbers</Label>
                  <Input
                    id="winning"
                    placeholder="e.g. 5, 12, 23, 34, 41, 49"
                    value={winningStr}
                    onChange={(e) => {
                      setWinningStr(e.target.value);
                      if (errors.winning) setErrors((p) => ({ ...p, winning: undefined }));
                    }}
                    aria-invalid={!!errors.winning}
                    className={`mt-1 ${errors.winning ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.winning && (
                    <p className="mt-1 text-[11px] text-destructive">{errors.winning}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="bonus" className="text-xs">Bonus numbers (optional)</Label>
                  <Input
                    id="bonus"
                    placeholder="e.g. 7, 18"
                    value={bonusStr}
                    onChange={(e) => {
                      setBonusStr(e.target.value);
                      if (errors.bonus) setErrors((p) => ({ ...p, bonus: undefined }));
                    }}
                    aria-invalid={!!errors.bonus}
                    className={`mt-1 ${errors.bonus ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.bonus && (
                    <p className="mt-1 text-[11px] text-destructive">{errors.bonus}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">
                    Gross prize per syndicate ({selectedDraw.currency})
                  </Label>
                  {selectedDraw.syndicates.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      No syndicates for this draw
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedDraw.syndicates.map((s) => {
                        const prizeErr = errors.prizes?.[s.id];
                        return (
                          <div key={s.id} className="rounded-lg bg-secondary/20 p-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-xs font-medium text-foreground">{s.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {s.sold_shares}/{s.total_shares} shares sold
                                </div>
                              </div>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={prizes[s.id] ?? ""}
                                onChange={(e) => {
                                  setPrizes((p) => ({ ...p, [s.id]: e.target.value }));
                                  if (prizeErr) {
                                    setErrors((p) => {
                                      const nextPrizes = { ...(p.prizes ?? {}) };
                                      delete nextPrizes[s.id];
                                      return {
                                        ...p,
                                        prizes: Object.keys(nextPrizes).length ? nextPrizes : undefined,
                                      };
                                    });
                                  }
                                }}
                                aria-invalid={!!prizeErr}
                                className={`h-9 w-32 ${prizeErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                              />
                            </div>
                            {prizeErr && (
                              <p className="mt-1 text-[11px] text-destructive">{prizeErr}</p>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-muted-foreground">
                        Auto-applies 10% platform fee, 90% split across members by shares.
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handlePublishClick}
                  disabled={submitting || alreadyPublished}
                  className="w-full bg-primary font-semibold text-primary-foreground"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Trophy className="mr-2 h-4 w-4" />
                      Publish & Distribute
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish draw results?</AlertDialogTitle>
            <AlertDialogDescription>
              This will record the winning numbers, distribute prizes to syndicate members, and credit
              their wallets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedDraw && pendingPayload && (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Lottery</div>
                <div className="font-medium text-foreground">
                  {selectedDraw.lottery.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {new Date(selectedDraw.draw_date).toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Winning numbers</div>
                <div className="font-medium text-foreground">{pendingPayload.winning.join(", ")}</div>
              </div>
              {pendingPayload.bonus.length > 0 && (
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Bonus</div>
                  <div className="font-medium text-foreground">{pendingPayload.bonus.join(", ")}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">
                  Prizes ({selectedDraw.currency})
                </div>
                {pendingPayload.prizes.length === 0 ? (
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    No prizes — results will be recorded with no payouts.
                  </div>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {pendingPayload.prizes.map((p) => (
                      <li key={p.syndicate_id} className="flex justify-between gap-3">
                        <span className="truncate text-muted-foreground">
                          {syndicateName(p.syndicate_id)}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatMoney(p.gross_prize, selectedDraw.currency)}
                        </span>
                      </li>
                    ))}
                    <li className="mt-1 flex justify-between border-t border-border pt-1">
                      <span className="text-muted-foreground">Total gross</span>
                      <span className="font-semibold text-foreground">
                        {formatMoney(pendingPayload.totalPrize, selectedDraw.currency)}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmPublish();
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                "Confirm & publish"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DrawsManager;
