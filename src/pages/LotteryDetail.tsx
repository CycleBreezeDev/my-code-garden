import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { Clock, Calendar, Ticket, Minus, Plus, ShieldCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatJackpot, secondsUntil, getColor, getIcon } from "@/lib/lotteryAssets";

const LotteryDetail = () => {
  const { slug } = useParams();
  const [draws, setDraws] = useState(1);

  const { data: lotteryData, isLoading } = useQuery({
    queryKey: ["lottery-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("slug, name, country, color, icon, draw_days, logo_url, draws:lottery_draws(draw_date, jackpot_amount, currency, status)")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading || !lotteryData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20 flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>
        <Footer />
      </div>
    );
  }

  const upcomingDraw = (lotteryData.draws ?? []).find((d: any) => d.status === "upcoming");
  const lottery = {
    name: lotteryData.name,
    country: lotteryData.country ?? "",
    color: getColor(lotteryData as any),
    icon: getIcon(lotteryData as any),
    jackpot: upcomingDraw ? formatJackpot(Number(upcomingDraw.jackpot_amount), upcomingDraw.currency) : "TBA",
    nextDraw: upcomingDraw ? `${Math.floor(secondsUntil(upcomingDraw.draw_date) / 86400)}d ${Math.floor((secondsUntil(upcomingDraw.draw_date) % 86400) / 3600)}h` : "TBA",
  };

  const pricePerLine = 4.99;
  const discount = draws >= 10 ? 0.2 : draws >= 5 ? 0.1 : 0;
  const total = (pricePerLine * draws * (1 - discount)).toFixed(2);

  // Mock numbers
  const mainNumbers = 5;
  const bonusNumbers = 1;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold"
                style={{ backgroundColor: `${lottery.color}15`, color: lottery.color }}
              >
                {lottery.icon}
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold">{lottery.name}</h1>
                <p className="text-sm text-muted-foreground">{lottery.country}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Jackpot</div>
                <div className="font-heading text-3xl font-bold text-primary">{lottery.jackpot}</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{lottery.nextDraw}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Number picker mock */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Pick Your Numbers</h2>
                <p className="mb-6 text-sm text-muted-foreground">Select {mainNumbers} main numbers and {bonusNumbers} bonus number, or use Quick Pick.</p>
                
                {/* Number grid mock */}
                <div className="mb-6">
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Main Numbers (1-69)</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 35 }, (_, i) => i + 1).map((n) => {
                      const selected = [7, 14, 21, 35, 42].includes(n);
                      return (
                        <button
                          key={n}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                    <span className="flex items-center text-xs text-muted-foreground px-2">...69</span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Bonus Number (1-26)</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 26 }, (_, i) => i + 1).map((n) => {
                      const selected = n === 15;
                      return (
                        <button
                          key={n}
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="border-border">Quick Pick</Button>
                  <Button variant="outline" className="border-border">Clear All</Button>
                </div>
              </div>

              {/* Past results mock */}
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">Recent Results</h2>
                <div className="space-y-3">
                  {[
                    { date: "Apr 9, 2026", numbers: [3, 17, 28, 42, 55], bonus: 12, jackpot: "$780M" },
                    { date: "Apr 6, 2026", numbers: [8, 22, 31, 44, 60], bonus: 5, jackpot: "$720M" },
                    { date: "Apr 2, 2026", numbers: [1, 14, 25, 38, 67], bonus: 19, jackpot: "$650M" },
                  ].map((result) => (
                    <div key={result.date} className="flex items-center justify-between rounded-xl bg-secondary/30 border border-border p-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1.5">{result.date}</div>
                        <div className="flex gap-1.5">
                          {result.numbers.map((n) => (
                            <span key={n} className="flex h-8 w-8 items-center justify-center rounded-lg bg-card border border-border text-xs font-medium text-foreground">
                              {n}
                            </span>
                          ))}
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-medium text-primary">
                            {result.bonus}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Jackpot</div>
                        <div className="text-sm font-semibold text-foreground">{result.jackpot}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-card p-6 sticky top-24">
                <h2 className="mb-5 text-lg font-semibold text-foreground">Order Summary</h2>
                
                <div className="mb-5">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Selected Numbers</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[7, 14, 21, 35, 42].map((n) => (
                      <span key={n} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{n}</span>
                    ))}
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-sm font-bold text-primary">15</span>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">Number of Draws</div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setDraws(Math.max(1, draws - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-secondary/80"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-lg font-semibold text-foreground w-8 text-center">{draws}</span>
                    <button
                      onClick={() => setDraws(draws + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground hover:bg-secondary/80"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {discount > 0 && (
                    <div className="mt-2 text-xs font-medium text-primary">
                      🎉 {discount * 100}% multi-draw discount applied!
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 mb-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price per line</span>
                    <span className="text-foreground">${pricePerLine}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Draws</span>
                    <span className="text-foreground">×{draws}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-primary">-{discount * 100}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">${total}</span>
                  </div>
                </div>

                <Button className="w-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 mb-3">
                  <Ticket className="h-4 w-4 mr-1" />
                  Buy Ticket
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  <span>100% scanned & verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LotteryDetail;
