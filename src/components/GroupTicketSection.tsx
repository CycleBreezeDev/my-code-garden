import { Button } from "@/components/ui/button";
import { Users, ArrowRight, Star, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getColor, getLogo, formatJackpot, formatPrice, secondsUntil, dayName } from "@/lib/lotteryAssets";
import { DisplayPrice } from "@/components/DisplayPrice";

type SyndicateRow = {
  id: string;
  slug: string;
  name: string;
  total_shares: number;
  sold_shares: number;
  price_per_share: number;
  currency: string;
  draw: {
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

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0").split("");

  const units = [
    { label: "DAYS", digits: pad(days) },
    { label: "HRS", digits: pad(hours) },
    { label: "MIN", digits: pad(minutes) },
    { label: "SEC", digits: pad(seconds) },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {units.map((unit) => (
        <div key={unit.label} className="flex flex-col items-center gap-0.5">
          <div className="flex gap-0.5">
            {unit.digits.map((d, j) => (
              <span key={j} className="flex h-7 w-6 items-center justify-center rounded bg-background text-xs font-bold text-foreground border border-border">
                {d}
              </span>
            ))}
          </div>
          <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{unit.label}</span>
        </div>
      ))}
    </div>
  );
};

const GroupTicketSection = () => {
  const { data: syndicates, isLoading } = useQuery({
    queryKey: ["home-syndicates"],
    queryFn: async (): Promise<SyndicateRow[]> => {
      const { data, error } = await supabase
        .from("syndicates")
        .select("id, slug, name, total_shares, sold_shares, price_per_share, currency, draw:lottery_draws!inner(draw_date, jackpot_amount, currency, lottery:lotteries!inner(slug, name, color, icon, draw_days, logo_url))")
        .eq("status", "open");
      if (error) throw error;
      return (data as unknown as SyndicateRow[]) ?? [];
    },
  });

  return (
    <section id="group-tickets" className="border-y border-border/50 bg-secondary/20 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <Users className="h-3 w-3" />
              50/50 Syndicate
            </div>
            <h2 className="mb-3 font-heading text-3xl font-bold lg:text-4xl">
              Group <span className="text-gradient-gold">Tickets</span>
            </h2>
            <p className="max-w-xl text-base text-muted-foreground">
              Pool your tickets with other players. 50% of winnings go to the ticket buyer, 50% is shared equally among all group members.
            </p>
          </div>
          <Link to="/syndicates">
            <Button variant="ghost" className="group text-primary hover:text-primary">
              View All Groups
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>

        {/* How it works mini */}
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", label: "Join a Group", desc: "Pick a group and buy your share" },
            { step: "2", label: "Pool Tickets", desc: "More tickets = better odds collectively" },
            { step: "3", label: "Share Winnings", desc: "50/50 split — fair and transparent" },
          ].map((s) => (
            <div key={s.step} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                {s.step}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{s.label}</h4>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Group ticket cards */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(syndicates ?? []).map((group) => {
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
                      {formatJackpot(Number(group.draw.jackpot_amount), group.draw.currency)}
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{group.sold_shares}/{group.total_shares} members</span>
                        <span className="font-semibold text-primary">
                          <DisplayPrice amount={Number(group.price_per_share)} sourceCurrency={group.currency} />/share
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(group.sold_shares / group.total_shares) * 100}%` }}
                        />
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
      </div>
    </section>
  );
};

export default GroupTicketSection;
