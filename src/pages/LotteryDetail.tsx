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
  Sparkles,
  Ticket,
  Trash2,
  Wallet as WalletIcon,
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
const STORAGE_PREFIX = "lottery-pick:v1:";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

type StoredPick = { main: number[]; bonus: number[]; lines: number; savedAt: number };

const loadStoredPick = (slug: string): StoredPick | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPick>;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > STORAGE_TTL_MS ||
      !Array.isArray(parsed.main) ||
      !Array.isArray(parsed.bonus) ||
      typeof parsed.lines !== "number"
    ) {
      window.localStorage.removeItem(STORAGE_PREFIX + slug);
      return null;
    }
    return {
      main: parsed.main.filter((n) => Number.isFinite(n)),
      bonus: parsed.bonus.filter((n) => Number.isFinite(n)),
      lines: Math.min(50, Math.max(1, Math.floor(parsed.lines))),
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
};

const clearStoredPick = (slug: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + slug);
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
  const [main, setMain] = useState<number[]>(initial?.main ?? []);
  const [bonus, setBonus] = useState<number[]>(initial?.bonus ?? []);
  const [lines, setLines] = useState(initial?.lines ?? 1);
  const [buying, setBuying] = useState(false);

  // Snapshot of the just-purchased ticket for the confirmation dialog.
  // Captured *before* state is cleared so the dialog can show what was
  // actually bought even after picks reset to empty.
  type Confirmation = {
    ticketId: string;
    drawDate: string;
    main: number[];
    bonus: number[];
    lines: number;
    total: number;
    currency: string;
    pricePerLine: number;
    discount: number;
    paymentReference: string;
  };
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // Persist picks + lines whenever they change. Empty selections clear
  // the slot so we don't waste storage on a blank slate. Wrapped in a
  // try/catch because Safari private mode can throw on setItem.
  useEffect(() => {
    if (!slug) return;
    if (main.length === 0 && bonus.length === 0 && lines === 1) {
      clearStoredPick(slug);
      return;
    }
    try {
      window.localStorage.setItem(
        STORAGE_PREFIX + slug,
        JSON.stringify({ main, bonus, lines, savedAt: Date.now() } satisfies StoredPick)
      );
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [slug, main, bonus, lines]);

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
  const toggleMain = (n: number) =>
    setMain((s) =>
      s.includes(n) ? s.filter((x) => x !== n) : s.length < fmt.main.count ? [...s, n].sort((a, b) => a - b) : s
    );

  const toggleBonus = (n: number) =>
    setBonus((s) =>
      s.includes(n)
        ? s.filter((x) => x !== n)
        : s.length < fmt.bonus.count
          ? [...s, n].sort((a, b) => a - b)
          : s
    );

  const handleQuickPick = () => {
    setMain(quickPick(fmt.main.count, fmt.main.min, fmt.main.max));
    setBonus(fmt.bonus.count > 0 ? quickPick(fmt.bonus.count, fmt.bonus.min, fmt.bonus.max) : []);
  };

  const handleClear = () => {
    setMain([]);
    setBonus([]);
  };

  // ----- Buy ------------------------------------------------------
  // The picker UI guarantees count, range, and uniqueness — only the
  // states that the user can't fix from this page (no upcoming draw,
  // draw already closed, or empty picks) gate the Buy button. The only
  // *inline* error we show is insufficient wallet balance.
  const picksReady =
    main.length === fmt.main.count &&
    (fmt.bonus.count === 0 || bonus.length === fmt.bonus.count);
  const drawAvailable = !!upcomingDraw && drawCountdown > 0;

  const insufficientFunds = wallet ? wallet.available_balance < total : true;

  const handleBuy = async () => {
    // Re-entry guard: if a purchase is already in flight, ignore
    // additional clicks / Enter-key repeats so we never fire
    // wallet_buy_ticket twice for the same selection.
    if (buying) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (!picksReady || !upcomingDraw) {
      // Button is disabled in this state — nothing to surface.
      return;
    }
    if (insufficientFunds) {
      // Inline error already visible; also redirect to top-up.
      navigate("/wallet/add-funds");
      return;
    }

    setBuying(true);
    // The generated Supabase types may not include the new RPC yet — cast
    // the function name so the typecheck doesn't block the build until
    // types regenerate after the migration is applied.
    const { data, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: string | null; error: { message: string } | null }>)(
      "wallet_buy_ticket",
      { _draw_id: upcomingDraw.id, _main: main, _bonus: bonus, _lines: lines }
    );
    setBuying(false);

    if (error) {
      // Map known PostgreSQL `RAISE EXCEPTION` strings from wallet_buy_ticket
      // into friendly, actionable toasts. Anything unmatched falls through
      // to a generic message with the raw text in the description.
      const raw = error.message ?? "";
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
        // Refresh the lottery so the countdown / upcoming draw updates.
        queryClient.invalidateQueries({ queryKey: ["lottery-detail", slug] });
      } else if (lower.includes("draw not found")) {
        toast.error("Draw unavailable", { description: "We couldn't find that draw — please refresh and try again." });
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
      return;
    }
    // Snapshot the purchase *before* clearing the picker so the
    // confirmation dialog reflects what was actually bought.
    const ticketId = data ?? "";
    setConfirmation({
      ticketId,
      drawDate: upcomingDraw.draw_date,
      main: [...main],
      bonus: [...bonus],
      lines,
      total,
      currency,
      pricePerLine,
      discount,
      paymentReference: ticketId ? `ticket:${ticketId}` : "",
    });
    toast.success("Ticket purchased! 🎟️", {
      description: `${lines} line${lines > 1 ? "s" : ""} for ${lottery.name}`,
    });
    handleClear();
    setLines(1);
    if (slug) clearStoredPick(slug);
    await refreshWallet();
    queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    // Don't auto-redirect — let the confirmation dialog drive next steps.
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
                <h2 className="mb-1 text-lg font-semibold text-foreground">Pick your numbers</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Select {fmt.main.count} main number{fmt.main.count > 1 ? "s" : ""}
                  {fmt.bonus.count > 0
                    ? ` and ${fmt.bonus.count} bonus number${fmt.bonus.count > 1 ? "s" : ""}`
                    : ""}
                  , or use Quick Pick.
                </p>

                <div className="mb-6">
                  <NumberPad
                    label="Main numbers"
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
                      label="Bonus numbers"
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

                <div className="flex gap-3">
                  <Button
                    onClick={handleQuickPick}
                    variant="outline"
                    className="border-border"
                    disabled={buying}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Quick Pick
                  </Button>
                  <Button
                    onClick={handleClear}
                    variant="outline"
                    className="border-border"
                    disabled={buying || (main.length === 0 && bonus.length === 0)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Clear All
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
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Selected numbers
                  </div>
                  {main.length === 0 && bonus.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Pick numbers to get started.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {main.map((n) => (
                        <span
                          key={`s-m-${n}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground"
                          style={{ backgroundColor: color }}
                        >
                          {n}
                        </span>
                      ))}
                      {bonus.map((n) => (
                        <span
                          key={`s-b-${n}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-5">
                  <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Quantity (lines)
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setLines((n) => Math.max(1, n - 1))}
                      disabled={buying || lines <= 1}
                      aria-label="Decrease lines"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold text-foreground">
                      {lines}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLines((n) => Math.min(50, n + 1))}
                      disabled={buying || lines >= 50}
                      aria-label="Increase lines"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {discount > 0 && (
                    <div className="mt-2 text-xs font-medium text-primary">
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
                {/* Numbers — repeated per line for clarity */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <span>Your numbers</span>
                    <span>
                      {confirmation.lines} line{confirmation.lines === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Main
                      </span>
                      {confirmation.main.map((n, i) => (
                        <span
                          key={`cm-${i}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground"
                          style={{ backgroundColor: color }}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                    {confirmation.bonus.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Bonus
                        </span>
                        {confirmation.bonus.map((n, i) => (
                          <span
                            key={`cb-${i}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-bold"
                            style={{ borderColor: color, color }}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
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
                      Lines <span className="text-xs">×{confirmation.lines}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatPrice(
                        +(confirmation.pricePerLine * confirmation.lines).toFixed(2),
                        confirmation.currency
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
                            confirmation.pricePerLine * confirmation.lines -
                            confirmation.total
                          ).toFixed(2),
                          confirmation.currency
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

                {/* Reference (copy-to-clipboard) */}
                {confirmation.ticketId && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(confirmation.ticketId);
                      toast.success("Ticket ID copied");
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    title="Copy ticket ID"
                  >
                    <span className="font-mono">
                      {confirmation.ticketId.slice(0, 8)}…
                      {confirmation.ticketId.slice(-4)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Copy className="h-3 w-3" />
                      Copy ID
                    </span>
                  </button>
                )}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    downloadTicketReceipt({
                      ticketId: confirmation.ticketId,
                      lotteryName: lottery.name,
                      drawDate: confirmation.drawDate,
                      main: confirmation.main,
                      bonus: confirmation.bonus,
                      lines: confirmation.lines,
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
                    const id = confirmation.ticketId;
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
