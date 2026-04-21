import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Star, Shield, Eye, Ticket, SlidersHorizontal, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { getColor, getLogo, formatJackpot, formatPrice, secondsUntil, dayName, formatDrawDate } from "@/lib/lotteryAssets";
import { DisplayPrice } from "@/components/DisplayPrice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SyndicateRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  total_shares: number;
  sold_shares: number;
  price_per_share: number;
  currency: string;
  status: string;
  draw: {
    id: string;
    draw_date: string;
    jackpot_amount: number;
    currency: string;
    lottery: { slug: string; name: string; color: string | null; icon: string | null; draw_days: string | null; logo_url: string | null };
  };
};

const CountdownTimer = ({ totalSeconds }: { totalSeconds: number }) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  useEffect(() => {
    setRemaining(totalSeconds);
    const interval = setInterval(() => setRemaining((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [totalSeconds]);
  const d = Math.floor(remaining / 86400);
  const h = Math.floor((remaining % 86400) / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0").split("");
  const units = [
    { label: "DAYS", digits: pad(d) },
    { label: "HRS", digits: pad(h) },
    { label: "MIN", digits: pad(m) },
    { label: "SEC", digits: pad(s) },
  ];
  return (
    <div className="flex items-center justify-center gap-2">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center gap-0.5">
          <div className="flex gap-0.5">
            {u.digits.map((digit, j) => (
              <span key={j} className="flex h-7 w-6 items-center justify-center rounded bg-background text-xs font-bold text-foreground border border-border">{digit}</span>
            ))}
          </div>
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{u.label}</span>
        </div>
      ))}
    </div>
  );
};

const Syndicates = () => {
  const [sortBy, setSortBy] = useState("popular");

  const { data: syndicates, isLoading } = useQuery({
    queryKey: ["syndicates"],
    queryFn: async (): Promise<SyndicateRow[]> => {
      const { data, error } = await supabase
        .from("syndicates")
        .select("id, slug, name, description, total_shares, sold_shares, price_per_share, currency, status, draw:lottery_draws!inner(id, draw_date, jackpot_amount, currency, lottery:lotteries!inner(slug, name, color, icon, draw_days, logo_url))")
        .eq("status", "open");
      if (error) throw error;
      return (data as unknown as SyndicateRow[]) ?? [];
    },
  });

  const sorted = useMemo(() => {
    const arr = [...(syndicates ?? [])];
    switch (sortBy) {
      case "jackpot-desc": return arr.sort((a, b) => b.draw.jackpot_amount - a.draw.jackpot_amount);
      case "jackpot-asc": return arr.sort((a, b) => a.draw.jackpot_amount - b.draw.jackpot_amount);
      case "spots-desc": return arr.sort((a, b) => (b.total_shares - b.sold_shares) - (a.total_shares - a.sold_shares));
      case "spots-asc": return arr.sort((a, b) => (a.total_shares - a.sold_shares) - (b.total_shares - b.sold_shares));
      case "price-asc": return arr.sort((a, b) => a.price_per_share - b.price_per_share);
      case "price-desc": return arr.sort((a, b) => b.price_per_share - a.price_per_share);
      default: return arr.sort((a, b) => b.sold_shares / b.total_shares - a.sold_shares / a.total_shares);
    }
  }, [syndicates, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <Users className="h-3 w-3" />
              50/50 Syndicate
            </div>
            <h1 className="font-heading text-4xl font-bold mb-3">
              Group <span className="text-gradient-gold">Tickets</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Pool your tickets with other players. 50% of winnings go to the ticket buyer, 50% is shared equally among all group members.
            </p>
          </div>

          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Ticket, label: "Join a Group", desc: "Pick a group and buy your share" },
              { icon: Users, label: "Pool Tickets", desc: "More tickets = better odds collectively" },
              { icon: Shield, label: "Share Winnings", desc: "50/50 split — fair and transparent" },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{step.label}</h3>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="font-medium text-foreground">Sort by</span>
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[220px] rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="jackpot-desc">Jackpot: High → Low</SelectItem>
                <SelectItem value="jackpot-asc">Jackpot: Low → High</SelectItem>
                <SelectItem value="spots-desc">Spots Left: Most</SelectItem>
                <SelectItem value="spots-asc">Spots Left: Fewest</SelectItem>
                <SelectItem value="price-asc">Price: Low → High</SelectItem>
                <SelectItem value="price-desc">Price: High → Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((group) => {
                const lottery = group.draw.lottery;
                const color = getColor(lottery);
                const logo = getLogo(lottery);
                const popular = group.sold_shares / group.total_shares > 0.7;
                return (
                  <div
                    key={group.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-center transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5"
                  >
                    {popular && (
                      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                        <Star className="h-2.5 w-2.5" />
                        Popular
                      </div>
                    )}
                    <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
                    <div className="flex flex-1 flex-col p-6">
                      <div
                        className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 overflow-hidden"
                        style={{ borderColor: `${color}40`, background: `radial-gradient(circle, ${color}10, ${color}05)` }}
                      >
                        {logo ? (
                          <img src={logo} alt={lottery.name} className="h-14 w-14 object-contain" loading="lazy" />
                        ) : (
                          <Users className="h-6 w-6" style={{ color }} />
                        )}
                      </div>
                      <h3 className="mb-0.5 text-base font-bold text-card-foreground">{group.name}</h3>
                      <p className="mb-3 text-xs text-muted-foreground">{group.draw.lottery.name} • {group.total_shares} shares</p>
                      <div className="mb-3 font-heading text-2xl font-bold text-primary">
                        {formatJackpot(group.draw.jackpot_amount, group.draw.currency)}
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{group.sold_shares}/{group.total_shares} members</span>
                          <span className="font-semibold text-primary">
                            <DisplayPrice amount={group.price_per_share} sourceCurrency={group.currency} />/share
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(group.sold_shares / group.total_shares) * 100}%` }} />
                        </div>
                      </div>
                      <div className="mb-2 text-xs text-muted-foreground">
                        Time left to play <span className="font-medium text-card-foreground">{dayName(group.draw.draw_date)}</span> draw:
                      </div>
                      <div className="mb-5">
                        <CountdownTimer totalSeconds={secondsUntil(group.draw.draw_date)} />
                      </div>
                      <Link to={`/group/${group.slug}`} className="mt-auto w-full">
                        <Button className="w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5">
                          Join Group
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground">
            {[
              { icon: Shield, text: "100% scanned & verified tickets" },
              { icon: Users, text: "Fair 50/50 split guaranteed" },
              { icon: Eye, text: "Full transparency in control panel" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Syndicates;
