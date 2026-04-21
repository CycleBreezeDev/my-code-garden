import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { formatDrawDate } from "@/lib/lotteryAssets";

interface LotteryCardProps {
  name: string;
  country: string;
  jackpot: string;
  drawDays: string;
  icon: string;
  color: string;
  slug?: string;
  logoUrl?: string;
  nextDraw?: string;
  nextDrawDay?: string;
  nextDrawAt?: string;
  countdownSeconds?: number;
}

const CountdownTimer = ({ totalSeconds }: { totalSeconds: number }) => {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number) => String(n).padStart(2, "0").split("");

  const units = [
    { label: "DAYS", digits: pad(days) },
    { label: "HOURS", digits: pad(hours) },
    { label: "MINUTES", digits: pad(minutes) },
    { label: "SECONDS", digits: pad(seconds) },
  ];

  return (
    <div className="flex items-center justify-center gap-3">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5">
            {unit.digits.map((d, j) => (
              <span
                key={j}
                className="flex h-8 w-7 items-center justify-center rounded bg-background text-sm font-bold text-foreground border border-border"
              >
                {d}
              </span>
            ))}
          </div>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const LotteryCard = ({ name, country, jackpot, drawDays, icon, color, slug, logoUrl, nextDraw, nextDrawDay, nextDrawAt, countdownSeconds }: LotteryCardProps) => {
  const resolvedLogo = logoUrl;
  return (
    <div className="group flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-card p-8 text-center transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      {/* Logo circle */}
      <div
        className="mb-5 flex h-28 w-28 items-center justify-center rounded-full border-4 overflow-hidden"
        style={{ borderColor: `${color}40`, background: `radial-gradient(circle, ${color}10, ${color}05)` }}
      >
        {resolvedLogo ? (
          <img src={resolvedLogo} alt={name} className="h-20 w-20 object-contain" loading="lazy" />
        ) : (
          <span className="text-2xl font-black tracking-tight" style={{ color }}>
            {icon}
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="mb-1 text-lg font-bold text-card-foreground">{name} <span className="font-normal text-muted-foreground">({country})</span></h3>

      {/* Jackpot */}
      <div className="mb-4 font-heading text-3xl font-bold text-primary">
        {jackpot}
      </div>

      {/* Countdown label */}
      <div className="mb-3 text-sm text-muted-foreground">
        Time left to play <span className="font-medium text-card-foreground">{nextDrawDay || drawDays.split("&")[0].trim()}</span> draw:
      </div>

      {/* Countdown timer */}
      <div className="mb-2">
        <CountdownTimer totalSeconds={countdownSeconds || 86400} />
      </div>

      {/* Absolute draw time in CAT (with viewer-local appended) */}
      {nextDrawAt && (
        <div className="mb-6 text-[10px] text-muted-foreground">
          {formatDrawDate(nextDrawAt, "full")}
        </div>
      )}
      {!nextDrawAt && <div className="mb-6" />}

      {/* Play button */}
      <Link to={`/lottery/${slug || name.toLowerCase().replace(/\s/g, '-')}`} className="w-full">
        <Button className="w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 text-base py-5">
          Play Now
        </Button>
      </Link>
    </div>
  );
};

export default LotteryCard;
