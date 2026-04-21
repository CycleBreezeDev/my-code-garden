import { useState } from "react";
import { z } from "zod";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trophy, Shield, AlertCircle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { formatPrice } from "@/lib/lotteryAssets";
import { toast } from "sonner";
import ContactSubmissions from "@/components/admin/ContactSubmissions";
import LotteryBrandingManager from "@/components/admin/LotteryBrandingManager";
import { WithdrawalsManager } from "@/components/admin/WithdrawalsManager";
import { WithdrawalConfigsManager } from "@/components/admin/WithdrawalConfigsManager";
import { FxPairsManager } from "@/components/admin/FxPairsManager";
import { KycManager } from "@/components/admin/KycManager";
import { SocialReports } from "@/components/admin/SocialReports";
import SyndicatePicksManager from "@/components/admin/SyndicatePicksManager";

type DrawRow = {
  id: string;
  draw_date: string;
  status: string;
  jackpot_amount: number;
  currency: string;
  lottery: { name: string };
  syndicates: { id: string; name: string; sold_shares: number; total_shares: number }[];
  draw_results: { id: string }[];
};

const numberArraySchema = z
  .string()
  .trim()
  .min(1, "Required")
  .transform((s) =>
    s
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((n) => Number(n))
  )
  .refine((arr) => arr.every((n) => Number.isInteger(n) && n >= 1 && n <= 99), {
    message: "Numbers must be integers between 1 and 99",
  });

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const qc = useQueryClient();
  const [selectedDrawId, setSelectedDrawId] = useState<string>("");
  const [winningStr, setWinningStr] = useState("");
  const [bonusStr, setBonusStr] = useState("");
  const [prizes, setPrizes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResults, setRefreshResults] = useState<
    { slug: string; ok: boolean; error?: string; jackpot?: string }[] | null
  >(null);

  const handleRefreshFeeds = async () => {
    setRefreshing(true);
    setRefreshResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-lottery-feeds", {
        body: {},
      });
      if (error) throw error;
      const results = (data?.results ?? []) as { slug: string; ok: boolean; error?: string; jackpot?: string }[];
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
          "id, draw_date, status, jackpot_amount, currency, lottery:lotteries!inner(name), syndicates(id, name, sold_shares, total_shares), draw_results(id)"
        )
        .order("draw_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as DrawRow[]) ?? [];
    },
    enabled: isAdmin,
  });

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20">
          <div className="mx-auto max-w-2xl px-6 py-16 text-center">
            <Shield className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Admin only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const selectedDraw = draws?.find((d) => d.id === selectedDrawId);

  const handlePublish = async () => {
    if (!selectedDraw) {
      toast.error("Select a draw first");
      return;
    }

    const winParse = numberArraySchema.safeParse(winningStr);
    if (!winParse.success) {
      toast.error("Winning numbers: " + winParse.error.errors[0].message);
      return;
    }
    let bonus: number[] = [];
    if (bonusStr.trim()) {
      const bonusParse = numberArraySchema.safeParse(bonusStr);
      if (!bonusParse.success) {
        toast.error("Bonus numbers: " + bonusParse.error.errors[0].message);
        return;
      }
      bonus = bonusParse.data;
    }

    const prizesPayload = Object.entries(prizes)
      .map(([syndicate_id, raw]) => ({
        syndicate_id,
        gross_prize: Number(raw),
      }))
      .filter((p) => p.gross_prize > 0 && Number.isFinite(p.gross_prize));

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("publish_draw_results", {
        _draw_id: selectedDraw.id,
        _winning_numbers: winParse.data,
        _bonus_numbers: bonus,
        _prizes: prizesPayload,
      });
      if (error) throw error;
      toast.success("Results published and payouts distributed");
      setWinningStr("");
      setBonusStr("");
      setPrizes({});
      setSelectedDrawId("");
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to publish";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6 flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Admin · Publish Draw Results</h1>
          </div>

          {/* Lottery feeds refresh */}
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Live lottery feeds</h2>
                <p className="text-xs text-muted-foreground">
                  Refresh jackpots & next-draw times by scraping official sites.
                </p>
              </div>
              <Button
                onClick={handleRefreshFeeds}
                disabled={refreshing}
                variant="outline"
                className="gap-2"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? "Refreshing..." : "Refresh now"}
              </Button>
            </div>

            {refreshResults && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {refreshResults.map((r) => (
                  <div
                    key={r.slug}
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                      r.ok
                        ? "border-primary/20 bg-primary/5"
                        : "border-destructive/30 bg-destructive/5"
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
                    const published = d.draw_results.length > 0;
                    const isSelected = d.id === selectedDrawId;
                    return (
                      <button
                        key={d.id}
                        onClick={() => {
                          setSelectedDrawId(d.id);
                          setPrizes({});
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-secondary/20 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium text-foreground">{d.lottery.name}</div>
                          {published && (
                            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              Published
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(d.draw_date).toLocaleString()} · {d.syndicates.length} syndicate
                          {d.syndicates.length === 1 ? "" : "s"}
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

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="winning" className="text-xs">Winning numbers</Label>
                      <Input
                        id="winning"
                        placeholder="e.g. 5, 12, 23, 34, 41, 49"
                        value={winningStr}
                        onChange={(e) => setWinningStr(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bonus" className="text-xs">Bonus numbers (optional)</Label>
                      <Input
                        id="bonus"
                        placeholder="e.g. 7, 18"
                        value={bonusStr}
                        onChange={(e) => setBonusStr(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-xs">Gross prize per syndicate ({selectedDraw.currency})</Label>
                      </div>
                      {selectedDraw.syndicates.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          No syndicates for this draw
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedDraw.syndicates.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 rounded-lg bg-secondary/20 p-2">
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
                                onChange={(e) =>
                                  setPrizes((p) => ({ ...p, [s.id]: e.target.value }))
                                }
                                className="h-9 w-32"
                              />
                            </div>
                          ))}
                          <p className="text-[11px] text-muted-foreground">
                            Auto-applies 10% platform fee, 90% split across members by shares.
                          </p>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handlePublish}
                      disabled={submitting}
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

          <div className="mt-6">
            <WithdrawalsManager />
          </div>

          <div className="mt-6">
            <WithdrawalConfigsManager />
          </div>

          <div className="mt-6">
            <FxPairsManager />
          </div>

          <div className="mt-6">
            <KycManager />
          </div>

          <div className="mt-6">
            <SyndicatePicksManager />
          </div>

          <div className="mt-6">
            <LotteryBrandingManager />
          </div>

          <div className="mt-6">
            <ContactSubmissions />
          </div>

          <div className="mt-6">
            <SocialReports />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
