import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LotteryCard from "@/components/LotteryCard";
import { useLotteries } from "@/components/LotteriesSection";
import { Search, Loader2 } from "lucide-react";
import { formatJackpot, secondsUntil, dayName, getColor, getIcon, getDrawDays, getLogo } from "@/lib/lotteryAssets";

const Lotteries = () => {
  const { data: lotteries, isLoading } = useLotteries();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="mb-10">
            <h1 className="font-heading text-4xl font-bold mb-3">
              All <span className="text-gradient-gold">Lotteries</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Browse and play the world's biggest lotteries. Real tickets purchased on your behalf.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 flex-1 max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Search lotteries...</span>
            </div>
            {["All", "USA", "Europe", "UK"].map((filter) => (
              <button
                key={filter}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  filter === "All"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
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
      </main>
      <Footer />
    </div>
  );
};

export default Lotteries;
