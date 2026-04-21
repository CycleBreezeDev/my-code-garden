import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Ticket, Users, Trophy, Wallet, Clock, ArrowUpRight, Bell, Loader2, Receipt, CheckCircle2, Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, secondsUntil } from "@/lib/lotteryAssets";
import MyTicketsSection from "@/components/MyTicketsSection";
import MyPayoutsSection from "@/components/MyPayoutsSection";
import { WalletCard } from "@/components/wallet/WalletCard";
import { TransactionsList } from "@/components/wallet/TransactionsList";

type PickMatch = {
  id: string;
  share_index: number;
  main_match_count: number | null;
  bonus_match_count: number | null;
  matched_at: string | null;
};

type Membership = {
  id: string;
  shares: number;
  amount_paid: number;
  created_at: string;
  payment_reference: string | null;
  syndicate: {
    id: string;
    slug: string;
    name: string;
    total_shares: number;
    sold_shares: number;
    currency: string;
    draw: {
      draw_date: string;
      lottery: { name: string };
    };
  };
  picks?: PickMatch[];
};

const formatCountdown = (s: number) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
};

const Dashboard = () => {
  const { user, profile } = useAuth();

  const { data: memberships, isLoading } = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("syndicate_memberships")
        .select("id, shares, amount_paid, created_at, payment_reference, syndicate:syndicates!inner(id, slug, name, total_shares, sold_shares, currency, draw:lottery_draws!inner(draw_date, lottery:lotteries!inner(name))), picks:syndicate_picks(id, share_index, main_match_count, bonus_match_count, matched_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Membership[]) ?? [];
    },
    enabled: !!user,
  });

  const totalShares = memberships?.reduce((s, m) => s + m.shares, 0) ?? 0;
  const totalSpent = memberships?.reduce((s, m) => s + Number(m.amount_paid), 0) ?? 0;

  const stats = [
    { label: "Active Shares", value: totalShares.toString(), icon: Ticket, change: `${memberships?.length ?? 0} groups` },
    { label: "Syndicates", value: (memberships?.length ?? 0).toString(), icon: Users, change: "joined" },
    { label: "Total Winnings", value: "$0.00", icon: Trophy, change: "Coming soon" },
    { label: "Total Spent", value: formatPrice(totalSpent), icon: Wallet, change: "lifetime" },
  ];

  const displayName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Player";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold">Welcome back, <span className="text-primary">{displayName}</span></h1>
              <p className="text-sm text-muted-foreground mt-1">Here's your lottery activity overview.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="h-4 w-4" />
              </button>
              <Link to="/syndicates">
                <Button className="bg-primary font-semibold text-primary-foreground">
                  <Users className="h-4 w-4 mr-1" />
                  Join a Group
                </Button>
              </Link>
            </div>
          </div>

          <div className="mb-6">
            <WalletCard />
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="font-heading text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                <div className="text-xs text-primary mt-1">{stat.change}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">My Syndicates</h2>
              <Link to="/syndicates">
                <Button variant="ghost" size="sm" className="text-primary text-xs">Browse more</Button>
              </Link>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : memberships && memberships.length > 0 ? (
              <div className="space-y-3">
                {memberships.map((m) => (
                  <div key={m.id} className="rounded-xl bg-secondary/30 border border-border p-4 hover:border-primary/40 transition-colors">
                    <Link to={`/group/${m.syndicate.slug}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{m.syndicate.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.syndicate.draw.lottery.name}</div>
                        <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />{m.shares} share{m.shares > 1 ? "s" : ""}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{m.syndicate.sold_shares}/{m.syndicate.total_shares}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatCountdown(secondsUntil(m.syndicate.draw.draw_date))}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Paid</div>
                        <div className="text-sm font-semibold text-primary">{formatPrice(Number(m.amount_paid), m.syndicate.currency)}</div>
                      </div>
                    </Link>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(m.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {m.payment_reference && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(m.payment_reference!);
                            toast.success("Reference copied");
                          }}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Copy reference"
                        >
                          <Receipt className="h-3 w-3" />
                          <span className="font-mono">{m.payment_reference.slice(0, 14)}{m.payment_reference.length > 14 ? "…" : ""}</span>
                          <Copy className="h-3 w-3 opacity-60" />
                        </button>
                      )}
                    </div>

                    {(() => {
                      const matched = (m.picks ?? []).filter(
                        (p) => p.matched_at && ((p.main_match_count ?? 0) + (p.bonus_match_count ?? 0)) > 0
                      );
                      if (matched.length === 0) return null;
                      const totalMain = matched.reduce((s, p) => s + (p.main_match_count ?? 0), 0);
                      const totalBonus = matched.reduce((s, p) => s + (p.bonus_match_count ?? 0), 0);
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            Your Lucky Pick{matched.length > 1 ? "s" : ""} matched {totalMain} number{totalMain === 1 ? "" : "s"}
                            {totalBonus > 0 ? ` + ${totalBonus} bonus` : ""}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({matched.length} winning line{matched.length > 1 ? "s" : ""})
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">You haven't joined any group tickets yet.</p>
                <Link to="/syndicates">
                  <Button className="bg-primary text-primary-foreground">Browse Groups</Button>
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6">
            <MyPayoutsSection />
          </div>

          <div className="mt-6">
            <MyTicketsSection />
          </div>

          <div className="mt-6">
            <TransactionsList />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
