import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Wallet,
  Trophy,
  TrendingUp,
  Inbox,
  Banknote,
  ArrowDownToLine,
  ArrowUpToLine,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Counts = {
  profiles: number;
  syndicates: number;
  draws: number;
  pendingWithdrawals: number;
  newContacts: number;
};

type WalletAgg = {
  totalAvailable: number;
  totalPending: number;
  lifetimeDeposits: number;
  lifetimeWithdrawn: number;
};

type RecentDeposit = {
  id: string;
  amount: number;
  currency: string;
  created_at: string;
  status: string;
  user_id: string;
};

type RecentWithdrawal = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "info";
}) => {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-500",
    warning: "bg-amber-500/10 text-amber-500",
    info: "bg-sky-500/10 text-sky-500",
  }[accent];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-heading text-2xl font-bold text-foreground tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
};

const Section = ({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {action}
    </div>
    {children}
  </div>
);

export const AdminOverview = () => {
  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["admin-overview-counts"],
    queryFn: async (): Promise<Counts> => {
      const [profiles, syndicates, draws, pending, contacts] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("syndicates").select("id", { count: "exact", head: true }),
        supabase.from("lottery_draws").select("id", { count: "exact", head: true }),
        supabase
          .from("withdrawal_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "processing"]),
        supabase
          .from("contact_submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
      ]);
      return {
        profiles: profiles.count ?? 0,
        syndicates: syndicates.count ?? 0,
        draws: draws.count ?? 0,
        pendingWithdrawals: pending.count ?? 0,
        newContacts: contacts.count ?? 0,
      };
    },
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ["admin-overview-wallets"],
    queryFn: async (): Promise<WalletAgg> => {
      const { data, error } = await supabase
        .from("wallets")
        .select("available_balance, pending_balance, lifetime_deposit, lifetime_withdrawn")
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        available_balance: number;
        pending_balance: number;
        lifetime_deposit: number;
        lifetime_withdrawn: number;
      }>;
      return rows.reduce<WalletAgg>(
        (acc, r) => ({
          totalAvailable: acc.totalAvailable + Number(r.available_balance ?? 0),
          totalPending: acc.totalPending + Number(r.pending_balance ?? 0),
          lifetimeDeposits: acc.lifetimeDeposits + Number(r.lifetime_deposit ?? 0),
          lifetimeWithdrawn: acc.lifetimeWithdrawn + Number(r.lifetime_withdrawn ?? 0),
        }),
        { totalAvailable: 0, totalPending: 0, lifetimeDeposits: 0, lifetimeWithdrawn: 0 },
      );
    },
  });

  const { data: recentDeposits } = useQuery({
    queryKey: ["admin-overview-deposits"],
    queryFn: async (): Promise<RecentDeposit[]> => {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("id, amount, currency, created_at, status, user_id")
        .eq("kind", "deposit")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RecentDeposit[];
    },
  });

  const { data: recentWithdrawals } = useQuery({
    queryKey: ["admin-overview-withdrawals"],
    queryFn: async (): Promise<RecentWithdrawal[]> => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("id, amount, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RecentWithdrawal[];
    },
  });

  const isLoading = countsLoading || walletsLoading;

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Dashboard
        </p>
        <h2 className="mt-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Operations overview
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time snapshot of users, wallets, syndicates, and operational queues.
        </p>
      </div>

      {/* User & content KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Registered users"
          value={isLoading ? "—" : formatNumber(counts?.profiles ?? 0)}
          hint="Profiles in the system"
          accent="primary"
        />
        <KpiCard
          icon={Trophy}
          label="Syndicates"
          value={isLoading ? "—" : formatNumber(counts?.syndicates ?? 0)}
          hint="All-time syndicates created"
          accent="info"
        />
        <KpiCard
          icon={TrendingUp}
          label="Lottery draws"
          value={isLoading ? "—" : formatNumber(counts?.draws ?? 0)}
          hint="Tracked draws"
          accent="success"
        />
        <KpiCard
          icon={Inbox}
          label="New messages"
          value={isLoading ? "—" : formatNumber(counts?.newContacts ?? 0)}
          hint="Unread contact submissions"
          accent="warning"
        />
      </div>

      {/* Money KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Available balance"
          value={isLoading ? "—" : formatNumber(wallets?.totalAvailable ?? 0)}
          hint="Sum across all wallets"
          accent="primary"
        />
        <KpiCard
          icon={Banknote}
          label="Pending balance"
          value={isLoading ? "—" : formatNumber(wallets?.totalPending ?? 0)}
          hint="Holds & in-flight"
          accent="warning"
        />
        <KpiCard
          icon={ArrowDownToLine}
          label="Lifetime deposits"
          value={isLoading ? "—" : formatNumber(wallets?.lifetimeDeposits ?? 0)}
          hint="Cumulative inflow"
          accent="success"
        />
        <KpiCard
          icon={ArrowUpToLine}
          label="Lifetime withdrawn"
          value={isLoading ? "—" : formatNumber(wallets?.lifetimeWithdrawn ?? 0)}
          hint="Cumulative payouts"
          accent="info"
        />
      </div>

      {/* Operational queues */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Recent deposits"
          action={
            <span className="text-[11px] text-muted-foreground">Last 8 transactions</span>
          }
        >
          {!recentDeposits ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : recentDeposits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No deposits yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentDeposits.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      +{formatNumber(Number(d.amount))} {d.currency}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })} · user {d.user_id.slice(0, 8)}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      d.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Withdrawal queue"
          action={
            <span className="text-[11px] text-muted-foreground">
              {counts?.pendingWithdrawals ?? 0} pending
            </span>
          }
        >
          {!recentWithdrawals ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : recentWithdrawals.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No withdrawal requests.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentWithdrawals.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      −{formatNumber(Number(w.amount))} {w.currency}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      w.status === "paid"
                        ? "bg-emerald-500/15 text-emerald-500"
                        : w.status === "rejected" || w.status === "failed"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-amber-500/15 text-amber-500"
                    }`}
                  >
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
};

export default AdminOverview;
