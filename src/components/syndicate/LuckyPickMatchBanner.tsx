import { Link } from "react-router-dom";
import { Trophy, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MatchedPickSummary = {
  syndicateName: string;
  syndicateSlug: string;
  drawDate: string;
  shareIndex: number;
  mainMatches: number;
  bonusMatches: number;
  matchedAt: string;
  /** Total picks scored across all the user's syndicates for this latest draw. */
  totalPicksScored: number;
  /** Picks with at least 2 main matches — drives the "X notable picks" line. */
  notablePickCount: number;
};

interface Props {
  summary: MatchedPickSummary | null;
}

/**
 * Banner on /dashboard that highlights the user's best Lucky Pick result
 * for the most recently scored draw. Hides itself when there's nothing yet.
 */
export const LuckyPickMatchBanner = ({ summary }: Props) => {
  if (!summary) return null;

  const { mainMatches, bonusMatches, syndicateName, syndicateSlug, shareIndex, notablePickCount } = summary;
  const total = mainMatches + bonusMatches;
  const isBig = mainMatches >= 3;

  // Headline tuned to the magnitude of the best result.
  const headline = total === 0
    ? "Latest draw published"
    : isBig
      ? `🎉 You matched ${mainMatches} numbers!`
      : `Your Lucky Pick matched ${mainMatches} number${mainMatches === 1 ? "" : "s"}`;

  const subline = total === 0
    ? "Your picks didn't hit this time — better luck next draw!"
    : `Best result: Share ${shareIndex} in ${syndicateName}` +
      (bonusMatches > 0 ? ` · +${bonusMatches} bonus` : "") +
      (notablePickCount > 1 ? ` · ${notablePickCount} notable picks total` : "");

  const Icon = isBig ? Trophy : Sparkles;

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
        isBig
          ? "border-accent/40 bg-accent/10"
          : total > 0
            ? "border-primary/30 bg-primary/5"
            : "border-border bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isBig ? "bg-accent/20 text-accent-foreground" : "bg-primary/15 text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold text-foreground sm:text-lg">{headline}</h2>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>
      </div>
      <Button asChild size="sm" variant={isBig ? "default" : "outline"}>
        <Link to={`/group/${syndicateSlug}`}>
          View group <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
};
