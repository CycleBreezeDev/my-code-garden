import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, Clock, RefreshCw, ArrowRight, TrendingUp, Ticket } from "lucide-react";
import Sparkline from "@/components/Sparkline";

// Map feed slugs to the corresponding lottery slugs used by /lottery/:slug.
// Feeds whose slug already matches a lottery row don't need an entry — we fall back to f.slug.
const feedSlugToLotterySlug: Record<string, string> = {
  "powerball-us": "powerball",
  "uk-lotto": "lotto-uk",
  "france-loto": "loto-france",
};

type Feed = {
  id: string;
  slug: string;
  name: string;
  country: string;
  currency: string;
  estimated_jackpot: number | null;
  jackpot_display: string | null;
  next_draw_at: string | null;
  draw_schedule: string | null;
  source_url: string;
  last_refreshed_at: string | null;
};

const flagFor = (country: string) => {
  switch (country) {
    case "US": return "🇺🇸";
    case "EU": return "🇪🇺";
    case "UK": return "🇬🇧";
    case "FR": return "🇫🇷";
    case "ZA": return "🇿🇦";
    default: return "🌐";
  }
};

const formatJackpot = (f: Feed) => {
  if (f.jackpot_display) return f.jackpot_display;
  if (f.estimated_jackpot && f.estimated_jackpot > 0) {
    const symbol = f.currency === "USD" ? "$" : f.currency === "EUR" ? "€" : f.currency === "GBP" ? "£" : f.currency === "ZAR" ? "R" : "";
    const v = f.estimated_jackpot;
    if (v >= 1_000_000_000) return `${symbol}${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `${symbol}${Math.round(v / 1_000_000)}M`;
    if (v >= 1_000) return `${symbol}${Math.round(v / 1_000)}K`;
    return `${symbol}${v.toLocaleString()}`;
  }
  return "—";
};

const useCountdown = (target: string | null) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (isNaN(ms) || ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const FeedCountdown = ({ target }: { target: string | null }) => {
  const text = useCountdown(target);
  if (!text) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" /> in {text}
    </span>
  );
};

const LiveJackpotsSection = () => {
  const { data: feeds, isLoading } = useQuery({
    queryKey: ["lottery-feeds"],
    queryFn: async (): Promise<Feed[]> => {
      const { data, error } = await supabase
        .from("lottery_feeds")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as Feed[]) ?? [];
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: history } = useQuery({
    queryKey: ["jackpot-history"],
    queryFn: async (): Promise<Record<string, number[]>> => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("lottery_jackpot_history")
        .select("feed_id, amount, captured_at")
        .gte("captured_at", since)
        .order("captured_at", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, number[]> = {};
      for (const row of (data ?? []) as { feed_id: string; amount: number }[]) {
        if (!grouped[row.feed_id]) grouped[row.feed_id] = [];
        grouped[row.feed_id].push(Number(row.amount));
      }
      for (const k of Object.keys(grouped)) {
        if (grouped[k].length > 30) grouped[k] = grouped[k].slice(-30);
      }
      return grouped;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const lastRefresh = feeds?.reduce<string | null>((latest, f) => {
    if (!f.last_refreshed_at) return latest;
    if (!latest || f.last_refreshed_at > latest) return f.last_refreshed_at;
    return latest;
  }, null);

  return (
    <section id="lotteries" className="border-t border-border/40 bg-background py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              LIVE FEED
            </div>
            <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Featured <span className="text-gradient-gold">Lotteries</span>
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Real-time draw times and estimated jackpots, automatically pulled from each lottery&apos;s official site.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastRefresh && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Updated {new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
            <Link to="/lotteries">
              <Button variant="ghost" className="group text-primary hover:text-primary">
                View All
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : feeds && feeds.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {feeds.map((f) => (
              <div
                key={f.id}
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none" aria-hidden>{flagFor(f.country)}</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {f.country}
                    </span>
                  </div>
                  <a
                    href={f.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open official site"
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </a>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{f.name}</h3>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Estimated jackpot</div>
                    <div className="mt-0.5 font-heading text-2xl font-bold text-primary">
                      {formatJackpot(f)}
                    </div>
                  </div>
                  {history?.[f.id] && history[f.id].length >= 2 ? (
                    <Sparkline values={history[f.id]} currency={f.currency} className="shrink-0" />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                      <TrendingUp className="h-3 w-3" /> No trend yet
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-[11px] text-muted-foreground">{f.draw_schedule}</span>
                  <FeedCountdown target={f.next_draw_at} />
                </div>
                <Link
                  to={`/lottery/${feedSlugToLotterySlug[f.slug] ?? f.slug}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Buy ticket — {formatJackpot(f)}
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  to={`/lotteries/${f.slug}/history`}
                  className="mt-2 flex items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  View history
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No lottery feeds yet.
          </div>
        )}
      </div>
    </section>
  );
};

export default LiveJackpotsSection;
