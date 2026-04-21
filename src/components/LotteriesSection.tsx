import LotteryCard from "./LotteryCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatJackpot, secondsUntil, dayName, getColor, getIcon, getDrawDays, getLogo } from "@/lib/lotteryAssets";

type LotteryWithDraw = {
  slug: string;
  name: string;
  country: string | null;
  color: string | null;
  icon: string | null;
  draw_days: string | null;
  logo_url: string | null;
  draws: { draw_date: string; jackpot_amount: number; currency: string }[];
};

export const useLotteries = () =>
  useQuery({
    queryKey: ["home-lotteries"],
    queryFn: async (): Promise<LotteryWithDraw[]> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("slug, name, country, color, icon, draw_days, logo_url, draws:lottery_draws(draw_date, jackpot_amount, currency, status)")
        .eq("is_active", true);
      if (error) throw error;
      return ((data as any[]) ?? []).map((l) => ({
        slug: l.slug,
        name: l.name,
        country: l.country,
        color: l.color,
        icon: l.icon,
        draw_days: l.draw_days,
        logo_url: l.logo_url,
        draws: (l.draws ?? []).filter((d: any) => d.status === "upcoming"),
      }));
    },
  });

const LotteriesSection = () => {
  const { data: lotteries, isLoading } = useLotteries();

  return (
    <section id="lotteries" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="mb-3 font-heading text-3xl font-bold lg:text-4xl">
              Featured <span className="text-gradient-gold">Lotteries</span>
            </h2>
            <p className="max-w-xl text-base text-muted-foreground">
              Access the world's biggest jackpots with up to 20% off multi-draw purchases.
            </p>
          </div>
          <Link to="/lotteries">
            <Button variant="ghost" className="group text-primary hover:text-primary">
              View All
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(lotteries ?? []).map((lottery) => {
              const draw = lottery.draws[0];
              return (
                <LotteryCard
                  key={lottery.slug}
                  name={lottery.name}
                  country={lottery.country ?? ""}
                  jackpot={draw ? formatJackpot(Number(draw.jackpot_amount), draw.currency) : "TBA"}
                  drawDays={getDrawDays(lottery)}
                  icon={getIcon(lottery)}
                  color={getColor(lottery)}
                  logoUrl={getLogo(lottery)}
                  slug={lottery.slug}
                  nextDrawDay={draw ? dayName(draw.draw_date) : undefined}
                  nextDrawAt={draw ? draw.draw_date : undefined}
                  countdownSeconds={draw ? secondsUntil(draw.draw_date) : 0}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default LotteriesSection;
