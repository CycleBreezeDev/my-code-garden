import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Calendar, Loader2, Receipt, Ticket as TicketIcon } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, getColor, getIcon, getLogo } from "@/lib/lotteryAssets";

// ----------------------------------------------------------------
// Row shape returned by the embedded select below.
// Kept locally so we don't need regenerated Supabase types yet.
// ----------------------------------------------------------------
type PurchasedTicket = {
  id: string;
  draw_id: string;
  main_numbers: number[];
  bonus_numbers: number[] | null;
  lines: number;
  total_paid: number;
  currency: string;
  status: "active" | "drawn" | "won" | "lost" | "refunded" | "cancelled";
  scanner_status: "pending" | "uploaded" | "verified" | "failed";
  refunded_at: string | null;
  refund_reason: string | null;
  payment_reference: string | null;
  created_at: string;
  lottery: {
    id: string;
    slug: string;
    name: string;
    color: string | null;
    icon: string | null;
    logo_url: string | null;
  } | null;
  draw: {
    draw_date: string;
    status: string;
  } | null;
};

// Status -> chip styling. Semantic tokens only.
const STATUS_STYLES: Record<PurchasedTicket["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-primary/10 text-primary" },
  drawn: { label: "Drawn", className: "bg-secondary text-foreground" },
  won: { label: "Won", className: "bg-emerald-500/15 text-emerald-500" },
  lost: { label: "Lost", className: "bg-muted text-muted-foreground" },
  refunded: { label: "Refunded", className: "bg-amber-500/15 text-amber-500" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
};

const SCANNER_STYLES: Record<PurchasedTicket["scanner_status"], { label: string; className: string } | null> = {
  pending: { label: "Scan pending", className: "bg-muted text-muted-foreground" },
  uploaded: { label: "Scan uploaded", className: "bg-primary/10 text-primary" },
  verified: { label: "Scan verified", className: "bg-emerald-500/15 text-emerald-500" },
  failed: { label: "Scan failed", className: "bg-destructive/10 text-destructive" },
};

const formatDrawDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

// Single ticket card. Mobile-first stacking, switches to a row on sm+.
const TicketRow = ({ t }: { t: PurchasedTicket }) => {
  const lottery = t.lottery;
  const color = getColor(lottery);
  const icon = getIcon(lottery);
  const logo = getLogo(lottery);
  const statusInfo = STATUS_STYLES[t.status] ?? STATUS_STYLES.active;
  const scannerInfo = SCANNER_STYLES[t.scanner_status];

  return (
    <article className="rounded-xl border border-border bg-secondary/20 p-4 transition-colors hover:border-primary/40">
      <header className="mb-3 flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {logo ? (
            <img src={logo} alt={lottery?.name ?? "Lottery"} className="h-8 w-8 object-contain" />
          ) : (
            icon
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {lottery ? (
              <Link
                to={`/lottery/${lottery.slug}`}
                className="text-sm font-semibold text-foreground hover:text-primary"
              >
                {lottery.name}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-foreground">Ticket</span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
            {scannerInfo && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${scannerInfo.className}`}
                title="Physical ticket scan status"
              >
                {scannerInfo.label}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Draw {formatDrawDate(t.draw?.draw_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <TicketIcon className="h-3 w-3" />
              {t.lines} line{t.lines === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</div>
          <div className="text-sm font-semibold text-primary">
            {formatPrice(Number(t.total_paid), t.currency)}
          </div>
        </div>
      </header>

      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Main
          </span>
          {t.main_numbers.map((n, i) => (
            <span
              key={`m-${i}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground"
              style={{ backgroundColor: color }}
            >
              {n}
            </span>
          ))}
        </div>
        {(t.bonus_numbers?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Bonus
            </span>
            {(t.bonus_numbers ?? []).map((n, i) => (
              <span
                key={`b-${i}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border-2 text-xs font-bold"
                style={{ borderColor: color, color }}
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {t.status === "refunded" && (
        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-500">
          Refunded
          {t.refunded_at
            ? ` ${new Date(t.refunded_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`
            : ""}
          {t.refund_reason ? ` — ${t.refund_reason}` : ""}
        </div>
      )}

      {t.payment_reference && (
        <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
          <Receipt className="h-3 w-3" />
          {t.payment_reference.length > 32
            ? `${t.payment_reference.slice(0, 32)}…`
            : t.payment_reference}
        </div>
      )}
    </article>
  );
};

const MyPurchasedTicketsList = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: async (): Promise<PurchasedTicket[]> => {
      // The `tickets` table may not yet exist in older deployments — cast the
      // builder to `any` so the type-check doesn't block the build before the
      // migration is applied. The catch in the wrapper turns a missing-relation
      // error into an empty list (handled in `enabled`/`error` paths instead).
      const { data: rows, error: err } = await (supabase as unknown as {
        from: (table: string) => {
          select: (sel: string) => {
            order: (col: string, opts: { ascending: boolean }) => Promise<{
              data: PurchasedTicket[] | null;
              error: { message: string; code?: string } | null;
            }>;
          };
        };
      })
        .from("tickets")
        .select(
          "id, draw_id, main_numbers, bonus_numbers, lines, total_paid, currency, status, scanner_status, refunded_at, refund_reason, payment_reference, created_at, lottery:lotteries(id, slug, name, color, icon, logo_url), draw:lottery_draws(draw_date, status)"
        )
        .order("created_at", { ascending: false });

      if (err) {
        // Treat "relation does not exist" as empty so the dashboard stays usable
        // before the migration lands.
        if (/relation .* does not exist|schema cache/i.test(err.message)) {
          return [];
        }
        throw new Error(err.message);
      }
      return rows ?? [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
        Couldn't load your tickets: {(error as Error).message}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-secondary/20 p-6 text-center">
        <TicketIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You haven't purchased any tickets yet.
        </p>
        <Link
          to="/lotteries"
          className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Browse lotteries
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((t) => (
        <TicketRow key={t.id} t={t} />
      ))}
    </div>
  );
};

export default MyPurchasedTicketsList;
