import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, ArrowRight, Loader2, Ticket, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";

type Feed = {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  source_url: string;
};

type Snapshot = {
  id: string;
  amount: number;
  jackpot_display: string | null;
  captured_at: string;
};

const formatAmount = (v: number, currency?: string) => {
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "ZAR" ? "R" : "";
  if (v >= 1_000_000_000) return `${symbol}${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${symbol}${(v / 1_000).toFixed(0)}K`;
  return `${symbol}${v.toLocaleString()}`;
};

const LotteryHistory = () => {
  const { slug = "" } = useParams<{ slug: string }>();

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ["lottery-feed", slug],
    queryFn: async (): Promise<Feed | null> => {
      const { data, error } = await supabase
        .from("lottery_feeds")
        .select("id, slug, name, country, currency, source_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as Feed) ?? null;
    },
    enabled: !!slug,
  });

  const { data: snapshots, isLoading: snapsLoading } = useQuery({
    queryKey: ["lottery-history", feed?.id],
    queryFn: async (): Promise<Snapshot[]> => {
      const { data, error } = await supabase
        .from("lottery_jackpot_history")
        .select("id, amount, jackpot_display, captured_at")
        .eq("feed_id", feed!.id)
        .order("captured_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Snapshot[]).map((s) => ({
        ...s,
        amount: Number(s.amount),
      }));
    },
    enabled: !!feed?.id,
  });

  const stats = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return null;
    const amounts = snapshots.map((s) => s.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    const first = amounts[0];
    const last = amounts[amounts.length - 1];
    const pct = first === 0 ? 0 : ((last - first) / first) * 100;
    return { min, max, first, last, pct, count: snapshots.length };
  }, [snapshots]);

  const chartData = useMemo(
    () =>
      (snapshots ?? []).map((s) => ({
        time: new Date(s.captured_at).getTime(),
        amount: s.amount,
        label: format(new Date(s.captured_at), "MMM d, HH:mm"),
      })),
    [snapshots]
  );

  const isLoading = feedLoading || snapsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-6xl px-6 py-8 pb-28 sm:pb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !feed ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <h1 className="font-heading text-xl font-bold text-foreground">Lottery not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">No lottery feed matches “{slug}”.</p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {feed.country}
                  </div>
                  <h1 className="mt-1 font-heading text-3xl font-bold text-foreground">
                    {feed.name} — Jackpot history
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All recorded estimated-jackpot snapshots from{" "}
                    <a
                      href={feed.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      the official site
                    </a>
                    .
                  </p>
                </div>
                <Link to={`/lottery/${feed.slug}`} className="shrink-0">
                  <Button className="gap-2 bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30">
                    <Ticket className="h-4 w-4" />
                    Buy ticket
                    {stats ? <span className="opacity-90">— {formatAmount(stats.last, feed.currency)}</span> : null}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {stats ? (
                <>
                  <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Latest" value={formatAmount(stats.last, feed.currency)} />
                    <StatCard label="Min" value={formatAmount(stats.min, feed.currency)} />
                    <StatCard label="Max" value={formatAmount(stats.max, feed.currency)} />
                    <StatCard
                      label="Change (period)"
                      value={`${stats.pct >= 0 ? "+" : ""}${stats.pct.toFixed(1)}%`}
                      trend={stats.pct > 0 ? "up" : stats.pct < 0 ? "down" : "flat"}
                    />
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="mb-4 text-sm font-semibold text-foreground">Trend</h2>
                    <ChartContainer
                      config={{
                        amount: { label: "Jackpot", color: "hsl(var(--primary))" },
                      }}
                      className="h-[320px] w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                          <defs>
                            <linearGradient id="jackpotFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis
                            dataKey="time"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            scale="time"
                            tickFormatter={(t) => format(new Date(t), "MMM d")}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickFormatter={(v) => formatAmount(Number(v), feed.currency)}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={60}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                labelFormatter={(_, payload) => {
                                  const t = payload?.[0]?.payload?.time;
                                  return t ? format(new Date(t), "MMM d, yyyy HH:mm") : "";
                                }}
                                formatter={(value) => [formatAmount(Number(value), feed.currency), " Jackpot"]}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#jackpotFill)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>

                  <div className="mt-6 rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-foreground">All snapshots</h2>
                      <span className="text-xs text-muted-foreground">{stats.count} total</span>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Captured at</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead className="hidden sm:table-cell">Display</TableHead>
                            <TableHead className="text-right">Δ vs previous</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...snapshots!].reverse().map((s, i, arr) => {
                            // arr is reversed (newest first). previous in time = arr[i+1]
                            const prev = arr[i + 1];
                            const diff = prev ? s.amount - prev.amount : 0;
                            const diffPct = prev && prev.amount !== 0 ? (diff / prev.amount) * 100 : 0;
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="font-mono text-xs">
                                  {format(new Date(s.captured_at), "MMM d, yyyy HH:mm")}
                                </TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {formatAmount(s.amount, feed.currency)}
                                </TableCell>
                                <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                                  {s.jackpot_display ?? "—"}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {prev ? (
                                    <span
                                      className={
                                        diff > 0
                                          ? "text-primary"
                                          : diff < 0
                                          ? "text-muted-foreground"
                                          : "text-muted-foreground"
                                      }
                                    >
                                      {diff > 0 ? "+" : ""}
                                      {diffPct.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                  No snapshots recorded yet. Trigger a refresh from the Admin page to start collecting history.
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {feed && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:hidden">
          <Link to={`/lottery/${feed.slug}`} className="block">
            <Button className="w-full gap-2 bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/30">
              <Ticket className="h-4 w-4" />
              Buy ticket
              {stats ? <span className="opacity-90">— {formatAmount(stats.last, feed.currency)}</span> : null}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
}) => {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color =
    trend === "up" ? "text-primary" : trend === "down" ? "text-muted-foreground" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 flex items-center gap-1.5 font-heading text-xl font-bold ${trend ? color : "text-foreground"}`}>
        {trend && <Icon className="h-4 w-4" />}
        {value}
      </div>
    </div>
  );
};

export default LotteryHistory;
