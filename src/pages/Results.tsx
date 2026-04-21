import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Calendar, Loader2, RefreshCw, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getColor, getIcon, getLogo, formatJackpot } from "@/lib/lotteryAssets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ResultRow = {
  id: string;
  winning_numbers: number[];
  bonus_numbers: number[] | null;
  total_winners: number;
  jackpot_won: number | null;
  draw: {
    draw_date: string;
    jackpot_amount: number;
    currency: string;
    lottery: { slug: string; name: string; color: string | null; icon: string | null; draw_days: string | null; logo_url: string | null };
  };
};

const Results = () => {
  const { data: results, isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: async (): Promise<ResultRow[]> => {
      const { data, error } = await supabase
        .from("draw_results")
        .select("id, winning_numbers, bonus_numbers, total_winners, jackpot_won, draw:lottery_draws!inner(draw_date, jackpot_amount, currency, lottery:lotteries!inner(slug, name, color, icon, draw_days, logo_url))")
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as ResultRow[]) ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold mb-3">
              Draw <span className="text-gradient-gold">Results</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Latest lottery draw results. Check if your numbers matched.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {results?.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">No results yet.</div>
              )}
              {results?.map((result) => {
                const lottery = result.draw.lottery;
                const color = getColor(lottery);
                const icon = getIcon(lottery);
                const logo = getLogo(lottery);
                const won = result.total_winners > 0;
                return (
                  <div key={result.id} className="rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/20">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl text-sm font-bold shrink-0"
                          style={{ backgroundColor: `${color}15`, color }}
                        >
                          {logo ? (
                            <img src={logo} alt={lottery.name} className="h-8 w-8 object-contain" loading="lazy" />
                          ) : (
                            icon
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{result.draw.lottery.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(result.draw.draw_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-wrap">
                        <div className="flex gap-1.5">
                          {result.winning_numbers.map((n, i) => (
                            <span key={i} className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary border border-border text-sm font-medium text-foreground">{n}</span>
                          ))}
                          {result.bonus_numbers?.map((n, i) => (
                            <span key={`b-${i}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-sm font-medium text-primary">{n}</span>
                          ))}
                        </div>

                        <div className="text-right min-w-[80px]">
                          <div className="text-xs text-muted-foreground">Jackpot</div>
                          <div className="text-sm font-semibold text-foreground">{formatJackpot(result.draw.jackpot_amount, result.draw.currency)}</div>
                        </div>

                        <div className={`rounded-lg px-2.5 py-1 text-xs font-medium ${won ? "bg-green-500/10 text-green-400" : "bg-secondary text-muted-foreground"}`}>
                          {won ? "Won" : "Rolled Over"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Results;
