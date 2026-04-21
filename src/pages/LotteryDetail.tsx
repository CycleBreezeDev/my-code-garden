import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
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
} from "@/lib/lotteryAssets";
import {
  parseFormat,
  quickPick,
  validatePick,
  type NumberFormat,
} from "@/lib/numberFormat";

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

const LotteryDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { wallets, refresh: refreshWallet } = useWallet();

  const [main, setMain] = useState<number[]>([]);
  const [bonus, setBonus] = useState<number[]>([]);
  const [lines, setLines] = useState(1);
  const [buying, setBuying] = useState(false);

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
  const validation =
    validatePick({ share_index: 0, main, bonus }, fmt) ??
    (!upcomingDraw ? "No upcoming draw available" : null) ??
    (drawCountdown <= 0 ? "Draw has closed" : null);

  const insufficientFunds = wallet ? wallet.available_balance < total : true;

  const handleBuy = async () => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (validation || !upcomingDraw) {
      toast.error(validation ?? "Pick your numbers first");
      return;
    }
    if (insufficientFunds) {
      toast.error(`Top up your ${currency} wallet to buy this ticket`);
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
      toast.error(error.message);
      return;
    }
    toast.success("Ticket purchased! 🎟️", {
      description: `${lines} line${lines > 1 ? "s" : ""} for ${lottery.name}`,
    });
    handleClear();
    setLines(1);
    await refreshWallet();
    queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    navigate(`/dashboard?tab=tickets&new=${data}`);
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
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {upcomingDraw ? formatCountdown(drawCountdown) : "TBA"}
                </span>
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
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleQuickPick} variant="outline" className="border-border">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Quick Pick
                  </Button>
                  <Button
                    onClick={handleClear}
                    variant="outline"
                    className="border-border"
                    disabled={main.length === 0 && bonus.length === 0}
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
                            {new Date(r.draw.draw_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
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
                      disabled={lines <= 1}
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
                      disabled={lines >= 50}
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

                <div className="mb-5 space-y-2 border-t border-border pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price per line</span>
                    <span className="text-foreground">
                      {formatPrice(pricePerLine, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lines</span>
                    <span className="text-foreground">×{lines}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-primary">-{Math.round(discount * 100)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">{formatPrice(total, currency)}</span>
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
                  disabled={buying || !!validation || (user ? insufficientFunds : false)}
                  className="mb-3 w-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                >
                  {buying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Ticket className="mr-1 h-4 w-4" />
                      {user ? "Buy Ticket" : "Sign in to buy"}
                    </>
                  )}
                </Button>

                {validation && main.length + bonus.length > 0 && (
                  <p className="mb-2 text-center text-xs text-muted-foreground">{validation}</p>
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
    </div>
  );
};

export default LotteryDetail;
