import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
  X,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet } from "@/contexts/WalletContext";
import {
  formatJackpot,
  formatPrice,
  getColor,
  getIcon,
  getLogo,
  secondsUntil,
  formatDrawDate,
} from "@/lib/lotteryAssets";
import {
  parseFormat,
  quickPick,
  type NumberFormat,
} from "@/lib/numberFormat";
import { downloadTicketReceipt } from "@/lib/ticketReceipt";

// ----------------------------------------------------------------
// Data
// ----------------------------------------------------------------

type DrawRow = {
  id: string;
  draw_date: string;
  jackpot_amount: number;
  currency: string;
  status: string;
};

type ResultRow = {
  id: string;
  winning_numbers: number[];
  bonus_numbers: number[] | null;
  draw: { draw_date: string; jackpot_amount: number; currency: string };
};

type LotteryRow = {
  id: string;
  slug: string;
  name: string;
  country: string | null;
  color: string | null;
  icon: string | null;
  logo_url: string | null;
  draw_days: string | null;
  number_format: unknown;
  price_per_line: number;
  draws: DrawRow[];
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const formatCountdown = (secs: number) => {
  if (secs <= 0) return "Closed";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const range = (min: number, max: number) => {
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
};

// Multi-line discount: matches the existing UX pattern in the page.
const discountFor = (lines: number) => (lines >= 10 ? 0.2 : lines >= 5 ? 0.1 : 0);

// ----------------------------------------------------------------
// Number-pad subcomponent — keeps the page render tidy.
// ----------------------------------------------------------------

const NumberPad = ({
  label,
  min,
  max,
  required,
  selected,
  onToggle,
  color,
  disabled = false,
}: {
  label: string;
  min: number;
  max: number;
  required: number;
  selected: number[];
  onToggle: (n: number) => void;
  color: string;
  /** When true, every number button is non-interactive (e.g. during purchase). */
  disabled?: boolean;
}) => {
  const numbers = useMemo(() => range(min, max), [min, max]);
  return (
    <div aria-busy={disabled}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label} ({min}–{max})
        </span>
        <span className="text-xs text-muted-foreground">
          {selected.length}/{required}
        </span>
      </div>
      <div className={`grid grid-cols-7 gap-1.5 sm:grid-cols-10 ${disabled ? "opacity-60" : ""}`}>
        {numbers.map((n) => {
          const isSelected = selected.includes(n);
          const isFull = selected.length >= required && !isSelected;
          const isDisabled = disabled || isFull;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onToggle(n)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "text-primary-foreground shadow-md"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
              style={
                isSelected
                  ? { backgroundColor: color, boxShadow: `0 4px 12px ${color}40` }
                  : undefined
              }
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// Selection persistence — keyed per-lottery so navigating between
// lotteries doesn't leak picks across them. We use localStorage with a
// 24h TTL so users keep their picks across a refresh but don't see a
// stale draft from days ago. URL query params are intentionally avoided
// because main+bonus arrays would clutter share-links and break SSR
// crawlers; localStorage is private to the browser and survives reload.
const STORAGE_PREFIX = "lottery-pick:v2:";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

type LineSlot = { main: number[]; bonus: number[] };
type StoredPick = { lines: LineSlot[]; activeIdx: number; savedAt: number };

const emptyLine = (): LineSlot => ({ main: [], bonus: [] });

const loadStoredPick = (slug: string): StoredPick | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPick> & {
      // backwards-compat: v1 stored a single main/bonus pair
      main?: number[];
      bonus?: number[];
    };
    if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_PREFIX + slug);
      return null;
    }
    if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
      const lines = parsed.lines.slice(0, 50).map((l) => ({
        main: Array.isArray(l?.main) ? l.main.filter((n) => Number.isFinite(n)) : [],
        bonus: Array.isArray(l?.bonus) ? l.bonus.filter((n) => Number.isFinite(n)) : [],
      }));
      const activeIdx = Math.min(
        Math.max(0, Math.floor(parsed.activeIdx ?? 0)),
        lines.length - 1,
      );
      return { lines, activeIdx, savedAt: parsed.savedAt };
    }
    // Legacy v1 fallback — migrate single line into the new array shape.
    if (Array.isArray(parsed.main) || Array.isArray(parsed.bonus)) {
      return {
        lines: [
          {
            main: (parsed.main ?? []).filter((n) => Number.isFinite(n)),
            bonus: (parsed.bonus ?? []).filter((n) => Number.isFinite(n)),
          },
        ],
        activeIdx: 0,
        savedAt: parsed.savedAt,
      };
    }
    return null;
  } catch {
    return null;
  }
};

const clearStoredPick = (slug: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + slug);
    // Also wipe the legacy v1 key so we don't resurrect stale picks.
    window.localStorage.removeItem("lottery-pick:v1:" + slug);
  } catch {
    /* ignore quota / private-mode errors */
  }
};

const LotteryDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { wallets, refresh: refreshWallet } = useWallet();

  // Lazy initial state hydrates synchronously from localStorage so the
  // first paint already shows the persisted picks (no flicker).
  const initial = useMemo(() => (slug ? loadStoredPick(slug) : null), [slug]);
  const [lineSlots, setLineSlots] = useState<LineSlot[]>(initial?.lines ?? [emptyLine()]);
  const [activeIdx, setActiveIdx] = useState<number>(initial?.activeIdx ?? 0);
  const [buying, setBuying] = useState(false);

  const lines = lineSlots.length;
  const safeActiveIdx = Math.min(activeIdx, lines - 1);
  const activeLine = lineSlots[safeActiveIdx] ?? emptyLine();
  const main = activeLine.main;
  const bonus = activeLine.bonus;

  const updateLine = (idx: number, updater: (l: LineSlot) => LineSlot) =>
    setLineSlots((prev) => prev.map((l, i) => (i === idx ? updater(l) : l)));

  // Snapshot of the just-purchased ticket(s) for the confirmation dialog.
  type Confirmation = {
    ticketIds: string[];
    drawDate: string;
    lines: LineSlot[];
    total: number;
    currency: string;
    pricePerLine: number;
    discount: number;
    paymentReference: string;
  };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Persist picks whenever they change. Empty selections clear the slot
  // so we don't waste storage on a blank slate.
  useEffect(() => {
    if (!slug) return;
    const allEmpty = lineSlots.every((l) => l.main.length === 0 && l.bonus.length === 0);
    if (allEmpty && lineSlots.length === 1) {
      clearStoredPick(slug);
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + slug,
        JSON.stringify({ lines: lineSlots, activeIdx: safeActiveIdx, savedAt: Date.now() } satisfies StoredPick),
      );
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [slug, lineSlots, safeActiveIdx]);

  // ----- Lottery + upcoming draw ---------------------------------
  const { data: lottery, isLoading } = useQuery({
    queryKey: ["lottery-detail", slug],
    queryFn: async (): Promise<LotteryRow | null> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select(
          "id, slug, name, country, color, icon, logo_url, draw_days, number_format, price_per_line, draws:lottery_draws(id, draw_date, jackpot_amount, currency, status)"
        )
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as LotteryRow) ?? null;
    },
    enabled: !!slug,
  });

  // ----- Recent results ------------------------------------------
  const { data: recentResults } = useQuery({
    queryKey: ["lottery-recent-results", lottery?.id],
    queryFn: async (): Promise<ResultRow[]> => {
      if (!lottery) return [];
      const { data, error } = await supabase
        .from("draw_results")
        .select(
          "id, winning_numbers, bonus_numbers, draw:lottery_draws!inner(draw_date, jackpot_amount, currency, lottery_id)"
        )
        .eq("draw.lottery_id", lottery.id)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data as unknown as ResultRow[]) ?? [];
    },
    enabled: !!lottery?.id,
  });

  // ----- Loading / not-found -------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="flex justify-center py-32 pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20">
          <div className="mx-auto max-w-2xl px-6 py-20 text-center">
            <h1 className="font-heading text-2xl font-bold">Lottery not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The lottery you're looking for doesn't exist or is no longer active.
            </p>
            <Button asChild className="mt-6">
              <Link to="/lotteries">Browse lotteries</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const fmt: NumberFormat = parseFormat(lottery.number_format);
  const upcomingDraw =
    (lottery.draws ?? [])
      .filter((d) => d.status === "upcoming" && secondsUntil(d.draw_date) > 0)
      .sort((a, b) => +new Date(a.draw_date) - +new Date(b.draw_date))[0] ?? null;

  const color = getColor(lottery);
  const icon = getIcon(lottery);
  const logo = getLogo(lottery);
  const currency = upcomingDraw?.currency ?? "USD";
  const wallet = wallets.find((w) => w.currency === currency);
  const drawCountdown = upcomingDraw ? secondsUntil(upcomingDraw.draw_date) : 0;

  // ----- Pricing --------------------------------------------------
  const pricePerLine = Number(lottery.price_per_line ?? 4.99);
  const discount = discountFor(lines);
  const subtotal = pricePerLine * lines;
  const total = +(subtotal * (1 - discount)).toFixed(2);

  // ----- Picker handlers -----------------------------------------
  // All handlers operate on the *active* line so the user can build
  // each line independently.
  const toggleMain = (n: number) =>
    updateLine(safeActiveIdx, (l) => ({
      ...l,
      main: l.main.includes(n)
        ? l.main.filter((x) => x !== n)
        : l.main.length < fmt.main.count
          ? [...l.main, n].sort((a, b) => a - b)
          : l.main,
    }));

  const toggleBonus = (n: number) =>
    updateLine(safeActiveIdx, (l) => ({
      ...l,
      bonus: l.bonus.includes(n)
        ? l.bonus.filter((x) => x !== n)
        : l.bonus.length < fmt.bonus.count
          ? [...l.bonus, n].sort((a, b) => a - b)
          : l.bonus,
    }));

  const handleQuickPick = () =>
    updateLine(safeActiveIdx, () => ({
      main: quickPick(fmt.main.count, fmt.main.min, fmt.main.max),
      bonus: fmt.bonus.count > 0 ? quickPick(fmt.bonus.count, fmt.bonus.min, fmt.bonus.max) : [],
    }));

  // Fill *every* incomplete line with a fresh quick pick — handy when
  // the user has bumped the line count up but hasn't picked numbers yet.
  const handleQuickPickAll = () =>
    setLineSlots((prev) =>
      prev.map((l) =>
        l.main.length === fmt.main.count && (fmt.bonus.count === 0 || l.bonus.length === fmt.bonus.count)
          ? l
          : {
              main: quickPick(fmt.main.count, fmt.main.min, fmt.main.max),
              bonus: fmt.bonus.count > 0 ? quickPick(fmt.bonus.count, fmt.bonus.min, fmt.bonus.max) : [],
            },
      ),
    );

  const handleClear = () => updateLine(safeActiveIdx, () => emptyLine());

  // Adjust the number of lines. Adding pushes empty slots so the user
  // can pick fresh numbers per line; removing trims from the end and
  // keeps the active tab valid.
  const setLines = (next: number | ((n: number) => number)) =>
    setLineSlots((prev) => {
      const target = Math.min(50, Math.max(1, typeof next === "function" ? next(prev.length) : next));
      if (target === prev.length) return prev;
      if (target > prev.length) {
        return [...prev, ...Array.from({ length: target - prev.length }, emptyLine)];
      }
      return prev.slice(0, target);
    });

  const removeLine = (idx: number) => {
    if (lineSlots.length <= 1) return;
    setLineSlots((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((cur) => Math.max(0, Math.min(cur, lineSlots.length - 2)));
  };

  // ----- Buy ------------------------------------------------------
  // The picker UI guarantees count, range, and uniqueness — only the
  // states that the user can't fix from this page (no upcoming draw,
  // draw already closed, or empty picks) gate the Buy button. The only
  // *inline* error we show is insufficient wallet balance.
  const isLineComplete = (l: LineSlot) =>
    l.main.length === fmt.main.count && (fmt.bonus.count === 0 || l.bonus.length === fmt.bonus.count);
  const completedLines = lineSlots.filter(isLineComplete).length;
  const allLinesReady = completedLines === lineSlots.length && lineSlots.length > 0;
  const picksReady = allLinesReady;
  const drawAvailable = !!upcomingDraw && drawCountdown > 0;

  const insufficientFunds = wallet ? wallet.available_balance < total : true;

  const handleBuy = async () => {
    // Re-entry guard
    if (buying) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (!picksReady || !upcomingDraw) return;
    if (insufficientFunds) {
      navigate("/wallet/add-funds");
      return;
    }

    setBuying(true);

    // Send each distinct line as its own RPC call so users get separate
    // ticket records per line. We submit sequentially so an early failure
    // (e.g. wallet drained) doesn't burn the remaining balance silently.
    type RpcResp = { data: string | null; error: { message: string } | null };
    const rpc = supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<RpcResp>;

    const ticketIds: string[] = [];
    let firstError: { message: string } | null = null;
    for (const line of lineSlots) {
      const { data, error } = await rpc("wallet_buy_ticket", {
        _draw_id: upcomingDraw.id,
        _main: line.main,
        _bonus: line.bonus,
        _lines: 1,
      });
      if (error) {
        firstError = error;
        break;
      }
      if (data) ticketIds.push(data);
    }

    setBuying(false);

    if (firstError) {
      const raw = firstError.message ?? "";
      const lower = raw.toLowerCase();

      if (lower.includes("insufficient wallet balance")) {
        toast.error("Not enough funds", {
          description: `Top up your ${currency} wallet to cover ${formatPrice(total, currency)}.`,
          action: { label: "Add funds", onClick: () => navigate("/wallet/add-funds") },
        });
      } else if (lower.includes("wallet not found")) {
        toast.error(`No ${currency} wallet yet`, {
          description: `Add funds to create your ${currency} wallet, then try again.`,
          action: { label: "Add funds", onClick: () => navigate("/wallet/add-funds") },
        });
      } else if (lower.includes("draw has already closed") || lower.includes("not open for sale")) {
        toast.error("This draw is closed", {
          description: "Sales have ended for this draw. Pick the next one when it opens.",
        });
        queryClient.invalidateQueries({ queryKey: ["lottery-detail", slug] });
      } else if (lower.includes("draw not found")) {
        toast.error("Draw unavailable", {
          description: "We couldn't find that draw — please refresh and try again.",
        });
        queryClient.invalidateQueries({ queryKey: ["lottery-detail", slug] });
      } else if (lower.includes("lottery is not active")) {
        toast.error("Lottery paused", { description: "Ticket sales are paused for this lottery right now." });
      } else if (lower.includes("invalid line count")) {
        toast.error("Invalid quantity", { description: "Choose between 1 and 100 lines." });
      } else if (lower.includes("main numbers are required") || lower.includes("invalid pick")) {
        toast.error("Invalid pick", { description: "Re-select your numbers and try again." });
      } else if (lower.includes("not authenticated")) {
        toast.error("Please sign in", { description: "Your session expired — sign in to continue." });
        navigate("/login");
      } else {
        toast.error("Couldn't complete purchase", { description: raw || "Please try again in a moment." });
      }
      // If some lines went through before the failure, refresh state so
      // wallet balance and tickets list reflect what was charged.
      if (ticketIds.length > 0) {
        await refreshWallet();
        queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      }
      return;
    }

    const refTicketId = ticketIds[0] ?? "";
    setConfirmation({
      ticketIds,
      drawDate: upcomingDraw.draw_date,
      lines: lineSlots.map((l) => ({ main: [...l.main], bonus: [...l.bonus] })),
      total,
      currency,
      pricePerLine,
      discount,
      paymentReference: refTicketId ? `ticket:${refTicketId}` : "",
    });
    toast.success("Ticket purchased! 🎟️", {
      description: `${lines} line${lines > 1 ? "s" : ""} for ${lottery.name}`,
    });
    setLineSlots([emptyLine()]);
    setActiveIdx(0);
    if (slug) clearStoredPick(slug);
    await refreshWallet();
    queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
  };

  // ----- Render ---------------------------------------------------
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-7xl px-6 py-12">
          {/* Header */}
          <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-2xl font-bold"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {logo ? (
                  <img src={logo} alt={lottery.name} className="h-12 w-12 object-contain" />
                ) : (
                  icon
                )}
              </div>
              <div>
                <h1 className="font-heading text-3xl font-bold">{lottery.name}</h1>
                <p className="text-sm text-muted-foreground">{lottery.country ?? ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Jackpot
                </div>
                <div className="font-heading text-3xl font-bold text-primary">
                  {upcomingDraw
                    ? formatJackpot(Number(upcomingDraw.jackpot_amount), currency)
                    : "TBA"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 rounded-xl border border-border bg-card px-4 py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {upcomingDraw ? formatCountdown(drawCountdown) : "TBA"}
                  </span>
                </div>
                {upcomingDraw && (
                  <span className="text-[10px] text-muted-foreground">
                    {formatDrawDate(upcomingDraw.draw_date, "full")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* ============================================== */}
            {/* Picker                                          */}
            {/* ============================================== */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Pick your numbers</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Select {fmt.main.count} main number{fmt.main.count > 1 ? "s" : ""}
                      {fmt.bonus.count > 0
                        ? ` and ${fmt.bonus.count} bonus number${fmt.bonus.count > 1 ? "s" : ""}`
                        : ""}{" "}
                      per line, or use Quick Pick.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-1">
                    <button
                      type="button"
                      onClick={() => setLines((n) => n - 1)}
                      disabled={buying || lines <= 1}
                      aria-label="Remove a line"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[3.5rem] text-center text-xs font-medium text-foreground">
                      {lines} line{lines === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((n) => n + 1)}
                      disabled={buying || lines >= 50}
                      aria-label="Add a line"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Per-line tabs — visible only when buying more than one
                    line. Each chip shows progress (e.g. 5/5+1) so users
                    spot incomplete lines at a glance. */}
                {lines > 1 && (
                  <div className="mb-5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                    {lineSlots.map((l, idx) => {
                      const isActive = idx === safeActiveIdx;
                      const complete = isLineComplete(l);
                      return (
                        <div
                          key={idx}
                          className={`group relative flex shrink-0 items-center rounded-xl border transition-all ${
                            isActive
                              ? "border-primary bg-primary/10 shadow-sm"
                              : complete
                                ? "border-border bg-secondary/40 hover:bg-secondary/70"
                                : "border-dashed border-border bg-secondary/20 hover:bg-secondary/40"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveIdx(idx)}
                            disabled={buying}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-foreground"
                          >
                            <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                              Line {idx + 1}
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                                complete
                                  ? "bg-primary/20 text-primary"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {l.main.length}/{fmt.main.count}
                              {fmt.bonus.count > 0 ? `+${l.bonus.length}/${fmt.bonus.count}` : ""}
                            </span>
                          </button>
                          {lineSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              disabled={buying}
                              aria-label={`Remove line ${idx + 1}`}
                              className="mr-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mb-6">
                  <NumberPad
                    label={lines > 1 ? `Line ${safeActiveIdx + 1} · Main numbers` : "Main numbers"}
                    min={fmt.main.min}
                    max={fmt.main.max}
                    required={fmt.main.count}
                    selected={main}
                    onToggle={toggleMain}
                    color={color}
                    disabled={buying}
                  />
                </div>

                {fmt.bonus.count > 0 && (
                  <div className="mb-6">
                    <NumberPad
                      label={lines > 1 ? `Line ${safeActiveIdx + 1} · Bonus numbers` : "Bonus numbers"}
                      min={fmt.bonus.min}
                      max={fmt.bonus.max}
                      required={fmt.bonus.count}
                      selected={bonus}
                      onToggle={toggleBonus}
                      color={color}
                      disabled={buying}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleQuickPick}
                    variant="outline"
                    className="border-border"
                    disabled={buying}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Quick Pick this line
                  </Button>
                  {lines > 1 && (
                    <Button
                      onClick={handleQuickPickAll}
                      variant="outline"
                      className="border-border"
                      disabled={buying || allLinesReady}
                    >
                      <Shuffle className="mr-1.5 h-4 w-4" />
                      Fill empty lines
                    </Button>
                  )}
                  <Button
                    onClick={handleClear}
                    variant="outline"
                    className="border-border"
                    disabled={buying || (main.length === 0 && bonus.length === 0)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Clear line
                  </Button>
                </div>
              </div>

              {/* Recent results */}
              {recentResults && recentResults.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold text-foreground">Recent results</h2>
                  <div className="space-y-3">
                    {recentResults.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4"
                      >
                        <div>
                          <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDrawDate(r.draw.draw_date, "dateOnly")}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {r.winning_numbers.map((n, i) => (
                              <span
                                key={`m-${i}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-foreground"
                              >
                                {n}
                              </span>
                            ))}
                            {(r.bonus_numbers ?? []).map((n, i) => (
                              <span
                                key={`b-${i}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-medium text-primary"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Jackpot</div>
                          <div className="text-sm font-semibold text-foreground">
                            {formatJackpot(Number(r.draw.jackpot_amount), r.draw.currency)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ============================================== */}
            {/* Order summary                                   */}
            {/* ============================================== */}
            <div className="space-y-5">
              <div className="sticky top-24 rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-5 text-lg font-semibold text-foreground">Order summary</h2>

                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    <span>Your lines</span>
                    <span className="normal-case tracking-normal text-[10px] text-muted-foreground">
                      {completedLines}/{lines} ready
                    </span>
                  </div>
                  <div className="space-y-2">
                    {lineSlots.map((l, idx) => {
                      const complete = isLineComplete(l);
                      const isActive = idx === safeActiveIdx;
                      const isEmpty = l.main.length === 0 && l.bonus.length === 0;
                      return (
                        <button
                          key={`sum-${idx}`}
                          type="button"
                          onClick={() => setActiveIdx(idx)}
                          disabled={buying}
                          className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                            isActive
                              ? "border-primary/60 bg-primary/5"
                              : "border-border bg-secondary/30 hover:bg-secondary/60"
                          }`}
                        >
                          <span className="w-12 shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            L{idx + 1}
                          </span>
                          {isEmpty ? (
                            <span className="text-xs italic text-muted-foreground">
                              Tap to pick numbers
                            </span>
                          ) : (
                            <div className="flex flex-1 flex-wrap items-center gap-1">
                              {l.main.map((n) => (
                                <span
                                  key={`s-m-${idx}-${n}`}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-primary-foreground"
                                  style={{ backgroundColor: color }}
                                >
                                  {n}
                                </span>
                              ))}
                              {l.bonus.map((n) => (
                                <span
                                  key={`s-b-${idx}-${n}`}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary"
                                >
                                  {n}
                                </span>
                              ))}
                            </div>
                          )}
                          {!complete && !isEmpty && (
                            <span className="ml-auto shrink-0 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                              Incomplete
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {discount > 0 && (
                    <div className="mt-3 text-xs font-medium text-primary">
                      🎉 {Math.round(discount * 100)}% multi-line discount applied!
                    </div>
                  )}
                </div>

                {/* Live price breakdown — recomputes on every selection /
                    line change because pricePerLine, lines, subtotal,
                    discount and total are derived in render. */}
                <div
                  className="mb-5 space-y-2 border-t border-border pt-4"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price per line</span>
                    <span className="tabular-nums text-foreground">
                      {formatPrice(pricePerLine, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Lines <span className="text-xs">×{lines}</span>
                    </span>
                    <span className="tabular-nums text-foreground">
                      {formatPrice(subtotal, currency)}
                    </span>
                  </div>
                  {discount > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-primary">
                        Discount <span className="text-xs">({Math.round(discount * 100)}%)</span>
                      </span>
                      <span className="tabular-nums font-medium text-primary">
                        −{formatPrice(+(subtotal - total).toFixed(2), currency)}
                      </span>
                    </div>
                  ) : (
                    // Surface the next discount tier so users see the value
                    // of buying more lines without us being pushy about it.
                    <div className="flex items-center justify-between rounded-md bg-secondary/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                      <span>
                        Add {5 - lines} more line{5 - lines === 1 ? "" : "s"} for 10% off
                      </span>
                      <span className="font-medium text-primary">10%</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-border pt-3">
                    <span className="text-sm font-medium text-foreground">Total</span>
                    <span className="font-heading text-2xl font-bold tabular-nums text-primary transition-all">
                      {formatPrice(total, currency)}
                    </span>
                  </div>
                </div>

                {wallet ? (
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <WalletIcon className="h-3 w-3" />
                      {currency} balance
                    </span>
                    <span
                      className={
                        insufficientFunds ? "font-semibold text-destructive" : "font-semibold text-foreground"
                      }
                    >
                      {formatPrice(wallet.available_balance, currency)}
                    </span>
                  </div>
                ) : user ? (
                  <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    No {currency} wallet — top up to buy.
                  </div>
                ) : null}

                <Button
                  onClick={handleBuy}
                  disabled={buying || !picksReady || !drawAvailable}
                  aria-busy={buying}
                  aria-live="polite"
                  className="mb-3 w-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                >
                  {buying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing purchase…
                    </>
                  ) : (
                    <>
                      <Ticket className="mr-1 h-4 w-4" />
                      {user ? "Buy Ticket" : "Sign in to buy"}
                    </>
                  )}
                </Button>

                {/* Only inline error: insufficient balance (the picker
                    prevents wrong counts/ranges/duplicates by design). */}
                {user && wallet && insufficientFunds && picksReady && drawAvailable && (
                  <p className="mb-2 text-center text-xs font-medium text-destructive">
                    Not enough {currency} to cover {formatPrice(total, currency)}. Tap Buy to top up.
                  </p>
                )}

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

      {/* ===================================================== */}
      {/* Purchase confirmation                                   */}
      {/* ===================================================== */}
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent className="max-w-md">
          {confirmation && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-7 w-7 text-primary" />
                </div>
                <DialogTitle className="text-center">Ticket confirmed</DialogTitle>
                <DialogDescription className="text-center">
                  Your {lottery.name} ticket is locked in for the{" "}
                  {formatDrawDate(confirmation.drawDate, "full")}{" "}
                  draw.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Numbers per line */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Your numbers</span>
                    <span>
                      {confirmation.lines.length} line{confirmation.lines.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {confirmation.lines.map((l, idx) => (
                      <div
                        key={`cl-${idx}`}
                        className="rounded-lg border border-border bg-card p-2"
                      >
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Line {idx + 1}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {l.main.map((n, i) => (
                            <span
                              key={`cm-${idx}-${i}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-primary-foreground"
                              style={{ backgroundColor: color }}
                            >
                              {n}
                            </span>
                          ))}
                          {l.bonus.map((n, i) => (
                            <span
                              key={`cb-${idx}-${i}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md border-2 text-xs font-bold"
                              style={{ borderColor: color, color }}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost breakdown */}
                <div className="space-y-1.5 rounded-xl border border-border p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Price per line</span>
                    <span className="tabular-nums">
                      {formatPrice(confirmation.pricePerLine, confirmation.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      Lines <span className="text-xs">×{confirmation.lines.length}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(
                        +(confirmation.pricePerLine * confirmation.lines.length).toFixed(2),
                        confirmation.currency,
                      )}
                    </span>
                  </div>
                  {confirmation.discount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Discount ({Math.round(confirmation.discount * 100)}%)</span>
                      <span className="tabular-nums">
                        −
                        {formatPrice(
                          +(
                            confirmation.pricePerLine * confirmation.lines.length -
                            confirmation.total
                          ).toFixed(2),
                          confirmation.currency,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-sm font-medium text-foreground">Total paid</span>
                    <span className="font-heading text-xl font-bold tabular-nums text-primary">
                      {formatPrice(confirmation.total, confirmation.currency)}
                    </span>
                  </div>
                </div>

                {/* Reference (copy-to-clipboard) — first ticket id */}
                {confirmation.ticketIds[0] && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(confirmation.ticketIds.join(","));
                      toast.success(
                        confirmation.ticketIds.length > 1 ? "Ticket IDs copied" : "Ticket ID copied",
                      );
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    title="Copy ticket ID"
                  >
                    <span className="font-mono">
                      {confirmation.ticketIds[0].slice(0, 8)}…
                      {confirmation.ticketIds[0].slice(-4)}
                      {confirmation.ticketIds.length > 1 && ` (+${confirmation.ticketIds.length - 1} more)`}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Copy className="h-3 w-3" />
                      Copy ID{confirmation.ticketIds.length > 1 ? "s" : ""}
                    </span>
                  </button>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const first = confirmation.lines[0] ?? { main: [], bonus: [] };
                    downloadTicketReceipt({
                      ticketId: confirmation.ticketIds[0] ?? "",
                      lotteryName: lottery.name,
                      drawDate: confirmation.drawDate,
                      main: first.main,
                      bonus: first.bonus,
                      lines: confirmation.lines.length,
                      pricePerLine: confirmation.pricePerLine,
                      discount: confirmation.discount,
                      total: confirmation.total,
                      currency: confirmation.currency,
                      paymentReference: confirmation.paymentReference,
                      buyerEmail: user?.email ?? null,
                      brandColor: color,
                    });
                    toast.success("Receipt downloaded");
                  }}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download receipt
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setConfirmation(null)}
                >
                  Buy another
                </Button>
                <Button
                  className="w-full bg-primary text-primary-foreground sm:w-auto"
                  onClick={() => {
                    const id = confirmation.ticketIds[0] ?? "";
                    setConfirmation(null);
                    navigate(`/dashboard?tab=tickets${id ? `&new=${id}` : ""}`);
                  }}
                >
                  <Ticket className="mr-1.5 h-4 w-4" />
                  View in My Tickets
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LotteryDetail;
