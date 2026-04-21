import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet as WalletIcon, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatMoney, type Wallet } from "@/contexts/WalletContext";
import type { LuckyPick } from "@/lib/numberFormat";

const QUOTE_TTL_MS = 5 * 60 * 1000;

type Quote = {
  rate: number;
  effective_rate: number;
  markup_percent: number;
  from: string;
  to: string;
  from_amount: number;
  to_amount: number;
  fetchedAt: number;
};

interface Props {
  syndicateId: string;
  syndicateName: string;
  syndicateCurrency: string;
  pricePerShare: number;
  shares: number;
  picks?: LuckyPick[];
  onSuccess: () => void;
  onCancel: () => void;
  onCardFallback: () => void;
  cardFallbackLabel: string;
  cardFallbackPending: boolean;
}

export const SyndicatePayConfirm = ({
  syndicateId,
  syndicateName,
  syndicateCurrency,
  pricePerShare,
  shares,
  picks,
  onSuccess,
  onCancel,
  onCardFallback,
  cardFallbackLabel,
  cardFallbackPending,
}: Props) => {
  const { wallets, refresh } = useWallet();
  const total = pricePerShare * shares;

  // Pick best wallet by default: same-currency first if it has enough, then any with funds
  const sameCcyWallet = wallets.find((w) => w.currency === syndicateCurrency);
  const sortedWallets = useMemo(() => {
    return [...wallets].sort((a, b) => {
      if (a.currency === syndicateCurrency) return -1;
      if (b.currency === syndicateCurrency) return 1;
      return b.available_balance - a.available_balance;
    });
  }, [wallets, syndicateCurrency]);

  const initialPick =
    sameCcyWallet && sameCcyWallet.available_balance >= total
      ? sameCcyWallet.currency
      : sortedWallets[0]?.currency ?? syndicateCurrency;

  const [sourceCurrency, setSourceCurrency] = useState<string>(initialPick);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const sourceWallet: Wallet | undefined = wallets.find((w) => w.currency === sourceCurrency);
  const isSameCcy = sourceCurrency === syndicateCurrency;

  // Tick for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchQuote = async (currency: string) => {
    if (currency === syndicateCurrency) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const { data, error } = await supabase.functions.invoke("fx-quote", {
        body: { from: currency, to: syndicateCurrency, to_amount: total },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuote({
        rate: Number(data.rate),
        effective_rate: Number(data.effective_rate),
        markup_percent: Number(data.markup_percent),
        from: data.from,
        to: data.to,
        from_amount: Number(data.from_amount),
        to_amount: Number(data.to_amount),
        fetchedAt: Date.now(),
      });
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Failed to fetch quote");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  // Fetch quote whenever source currency changes
  useEffect(() => {
    fetchQuote(sourceCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCurrency, syndicateCurrency, total]);

  const quoteAge = quote ? now - quote.fetchedAt : 0;
  const quoteRemainingMs = quote ? Math.max(0, QUOTE_TTL_MS - quoteAge) : 0;
  const quoteExpired = !!quote && quoteRemainingMs <= 0;

  const requiredSourceAmount = isSameCcy ? total : quote?.from_amount ?? 0;
  const balance = sourceWallet?.available_balance ?? 0;
  const canPay = isSameCcy
    ? balance >= total
    : !!quote && !quoteExpired && balance >= requiredSourceAmount;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      let membershipId: string | null = null;
      if (isSameCcy) {
        const { data, error } = await supabase.rpc("wallet_join_syndicate", {
          _syndicate_id: syndicateId,
          _shares: shares,
        });
        if (error) throw error;
        membershipId = data as string;
      } else {
        if (!quote) throw new Error("No quote available");
        const { data, error } = await supabase.rpc("wallet_join_syndicate_fx", {
          _syndicate_id: syndicateId,
          _shares: shares,
          _source_currency: sourceCurrency,
          _quoted_rate: quote.rate,
          _markup_percent: quote.markup_percent,
        });
        if (error) throw error;
        membershipId = data as string;
      }
      // Save Lucky Picks (best-effort; don't fail the join if picks fail)
      const cleaned = (picks ?? []).filter((p) => p.main.length > 0);
      if (membershipId && cleaned.length > 0) {
        try {
          await supabase.rpc("upsert_syndicate_picks", {
            _membership_id: membershipId,
            _picks: cleaned as unknown as never,
          });
        } catch (e) {
          console.warn("Failed to save lucky picks", e);
        }
      }
      await refresh();
      onSuccess();
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Could not complete purchase");
    } finally {
      setSubmitting(false);
    }
  };

  const formatRemaining = () => {
    const s = Math.ceil(quoteRemainingMs / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3 py-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Group</span>
        <span className="font-medium text-foreground">{syndicateName}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Shares</span>
        <span className="font-medium text-foreground">{shares}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-heading text-lg font-bold text-primary">
          {formatMoney(total, syndicateCurrency)}
        </span>
      </div>

      {/* Wallet picker */}
      <div className="space-y-1.5 pt-2">
        <label className="text-xs text-muted-foreground">Pay from wallet</label>
        <Select value={sourceCurrency} onValueChange={setSourceCurrency}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortedWallets.map((w) => (
              <SelectItem key={w.currency} value={w.currency}>
                <span className="flex items-center gap-2">
                  <WalletIcon className="h-3.5 w-3.5" />
                  {w.currency} · {formatMoney(w.available_balance, w.currency)}
                  {w.currency === syndicateCurrency ? " (same currency)" : ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quote / FX details */}
      {!isSameCcy && (
        <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
          {quoteLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching live rate…
            </div>
          ) : quote ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Live rate</span>
                <span className="font-mono text-foreground">
                  1 {quote.from} = {quote.rate.toFixed(4)} {quote.to}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Markup</span>
                <span className="text-foreground">{quote.markup_percent.toFixed(2)}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Effective rate</span>
                <span className="font-mono text-foreground">
                  1 {quote.from} = {quote.effective_rate.toFixed(4)} {quote.to}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-foreground">
                  <span className="font-semibold">{formatMoney(quote.from_amount, quote.from)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold">{formatMoney(quote.to_amount, quote.to)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => fetchQuote(sourceCurrency)}
                  disabled={quoteLoading}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
              <div className={`text-[11px] ${quoteExpired ? "text-destructive" : "text-muted-foreground"}`}>
                {quoteExpired ? "Quote expired — refresh to continue" : `Quote locked for ${formatRemaining()}`}
              </div>
            </>
          ) : quoteError ? (
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive">{quoteError}</span>
              <button
                type="button"
                onClick={() => fetchQuote(sourceCurrency)}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Wallet status */}
      <div
        className={`rounded-xl border p-3 flex items-center justify-between ${
          canPay ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"
        }`}
      >
        <div className="flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-primary" />
          <div>
            <div className="text-xs text-muted-foreground">{sourceCurrency} wallet balance</div>
            <div className="text-sm font-semibold text-foreground">
              {formatMoney(balance, sourceCurrency)}
            </div>
          </div>
        </div>
        {canPay ? (
          <span className="text-xs font-medium text-primary">Sufficient</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Need {formatMoney(requiredSourceAmount, sourceCurrency)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button
          onClick={handleConfirm}
          disabled={!canPay || submitting || cardFallbackPending}
          className="w-full bg-primary text-primary-foreground"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSameCcy ? (
            <>Pay {formatMoney(total, syndicateCurrency)} from wallet</>
          ) : (
            <>
              Pay {formatMoney(requiredSourceAmount, sourceCurrency)} ({sourceCurrency} → {syndicateCurrency})
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCardFallback}
          disabled={submitting || cardFallbackPending}
          className="w-full"
        >
          {cardFallbackPending ? <Loader2 className="h-4 w-4 animate-spin" /> : cardFallbackLabel}
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={submitting || cardFallbackPending}
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
};
