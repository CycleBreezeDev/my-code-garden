import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, Trash2, ArrowLeftRight, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { KycBlockedAlert, parseKycError } from "./KycBlockedAlert";

interface Bank { code: string; name: string; }

const BankCombobox = ({
  banks, value, onChange, loading,
}: { banks: Bank[]; value: string; onChange: (v: string) => void; loading: boolean }) => {
  const [open, setOpen] = useState(false);
  const selected = banks.find((b) => b.code === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          {loading ? "Loading…" : selected ? selected.name : "Select bank"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search banks…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No bank found.</CommandEmpty>
            <CommandGroup>
              {banks.map((b) => (
                <CommandItem
                  key={b.code}
                  value={b.name}
                  onSelect={() => { onChange(b.code); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === b.code ? "opacity-100" : "opacity-0")} />
                  {b.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ComboPicker = ({
  options, value, onChange, placeholder, searchPlaceholder, emptyText,
}: {
  options: { value: string; label: string; keywords?: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.keywords ?? ""}`}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface WithdrawalConfig {
  currency: string;
  destination_type: string;
  min_amount: number;
  max_amount: number | null;
  fee_flat: number;
  fee_percent: number;
  enabled: boolean;
  eta_label: string | null;
  daily_limit: number | null;
}

interface SavedRecipient {
  id: string;
  label: string;
  destination_type: string;
  destination: Record<string, any>;
  provider: string | null;
}

const DEST_CURRENCIES = ["NGN","GHS","KES","ZAR","USD","EUR","GBP"];

const FLW_COUNTRIES = [
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "UG", name: "Uganda", currency: "UGX" },
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "RW", name: "Rwanda", currency: "RWF" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "ET", name: "Ethiopia", currency: "ETB" },
  { code: "ML", name: "Mali", currency: "XOF" },
  { code: "SN", name: "Senegal", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
];

const computeFee = (cfg: WithdrawalConfig | null, amount: number) => {
  if (!cfg) return 0;
  const pct = (cfg.fee_percent / 100) * amount;
  return Math.round((cfg.fee_flat + pct) * 100) / 100;
};

const useDailyUsed = (currency: string, open: boolean, refreshKey: number) => {
  const [used, setUsed] = useState(0);
  useEffect(() => {
    if (!open || !currency) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("amount, currency, destination, status, created_at")
        .gte("created_at", since)
        .in("status", ["pending", "processing", "paid"]);
      if (cancelled) return;
      const total = (data || []).reduce((sum, r: any) => {
        const destCur = r.destination?.fx?.dest_currency || r.currency;
        const destAmt = Number(r.destination?.fx?.dest_amount ?? r.amount);
        return destCur === currency ? sum + destAmt : sum;
      }, 0);
      setUsed(total);
    })();
    return () => { cancelled = true; };
  }, [currency, open, refreshKey]);
  return used;
};

const FeeSummary = ({ cfg, currency, amount, dailyUsed }: { cfg: WithdrawalConfig | null; currency: string; amount: number; dailyUsed?: number }) => {
  if (!cfg) return <p className="text-xs text-muted-foreground">No fee configuration found for {currency} on this destination.</p>;
  const fee = computeFee(cfg, amount);
  const net = Math.max(0, amount - fee);
  const cap = cfg.daily_limit ? Number(cfg.daily_limit) : 0;
  const remaining = cap > 0 ? Math.max(0, cap - (dailyUsed ?? 0)) : null;
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
      <div className="flex justify-between"><span className="text-muted-foreground">Minimum</span><span>{formatMoney(cfg.min_amount, currency)}</span></div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Fee</span>
        <span>{formatMoney(cfg.fee_flat, currency)}{cfg.fee_percent > 0 && <> + {cfg.fee_percent}%</>}{amount > 0 && <> = {formatMoney(fee, currency)}</>}</span>
      </div>
      {amount > 0 && <div className="flex justify-between font-medium"><span>Beneficiary receives</span><span>{formatMoney(net, currency)}</span></div>}
      {cfg.eta_label && <div className="flex justify-between text-muted-foreground"><span>ETA</span><span>{cfg.eta_label}</span></div>}
      {remaining !== null && (
        <div className="flex justify-between border-t border-border pt-1 mt-1">
          <span className="text-muted-foreground">Daily limit ({currency})</span>
          <span className={amount > remaining ? "text-destructive font-medium" : ""}>
            {formatMoney(remaining, currency)} left of {formatMoney(cap, currency)}
          </span>
        </div>
      )}
    </div>
  );
};

const useConfig = (configs: WithdrawalConfig[], currency: string, destType: string) =>
  useMemo(() => configs.find((c) => c.currency === currency && c.destination_type === destType) || null, [configs, currency, destType]);

/** Shared FX + wallet selector block. Output: source currency/amount the user's wallet will be debited. */
interface FxResult { sourceCurrency: string; sourceAmount: number; rate: number; markupPct: number; loading: boolean; error: string }
const useFxQuote = (sourceCurrency: string, destCurrency: string, destAmount: number): FxResult => {
  const [state, setState] = useState<FxResult>({ sourceCurrency, sourceAmount: destAmount, rate: 1, markupPct: 0, loading: false, error: "" });
  useEffect(() => {
    if (!sourceCurrency || !destCurrency || !destAmount || destAmount <= 0) {
      setState((s) => ({ ...s, sourceCurrency, sourceAmount: destAmount || 0, rate: 1, markupPct: 0, error: "" }));
      return;
    }
    if (sourceCurrency === destCurrency) {
      setState({ sourceCurrency, sourceAmount: destAmount, rate: 1, markupPct: 0, loading: false, error: "" });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fx-quote", {
          body: { from: sourceCurrency, to: destCurrency, to_amount: destAmount },
        });
        if (cancelled) return;
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any).error);
        setState({
          sourceCurrency,
          sourceAmount: Number((data as any).from_amount),
          rate: Number((data as any).rate),
          markupPct: Number((data as any).markup_percent),
          loading: false, error: "",
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({ sourceCurrency, sourceAmount: 0, rate: 0, markupPct: 0, loading: false, error: e.message || "Quote failed" });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [sourceCurrency, destCurrency, destAmount]);
  return state;
};

const FxBlock = ({
  destCurrency, destAmount, sourceCurrency, setSourceCurrency, fx,
}: {
  destCurrency: string; destAmount: number;
  sourceCurrency: string; setSourceCurrency: (c: string) => void;
  fx: FxResult;
}) => {
  const { wallets } = useWallet();
  const wallet = wallets.find((w) => w.currency === sourceCurrency);
  const insufficient = wallet && fx.sourceAmount > wallet.available_balance;
  return (
    <div className="space-y-2">
      <Label>Pay from wallet</Label>
      <Select value={sourceCurrency} onValueChange={setSourceCurrency}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {wallets.map((w) => <SelectItem key={w.currency} value={w.currency}>{w.currency} — {formatMoney(w.available_balance, w.currency)} available</SelectItem>)}
        </SelectContent>
      </Select>
      {sourceCurrency && destCurrency && destAmount > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
          {sourceCurrency === destCurrency ? (
            <div className="flex justify-between"><span className="text-muted-foreground">Wallet debit</span><span>{formatMoney(destAmount, destCurrency)}</span></div>
          ) : fx.loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Getting live rate…</div>
          ) : fx.error ? (
            <div className="text-destructive">{fx.error}</div>
          ) : (
            <>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ArrowLeftRight className="h-3 w-3" /> Rate</span><span>1 {sourceCurrency} ≈ {fx.rate.toFixed(4)} {destCurrency}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">FX markup</span><span>{fx.markupPct}%</span></div>
              <div className="flex justify-between font-medium"><span>Wallet debit</span><span>{formatMoney(fx.sourceAmount, sourceCurrency)}</span></div>
            </>
          )}
          {insufficient && <div className="text-destructive">Insufficient {sourceCurrency} balance ({formatMoney(wallet!.available_balance, sourceCurrency)} available).</div>}
        </div>
      )}
    </div>
  );
};

const RecipientPicker = ({ recipients, destType, onPick, onDelete }: {
  recipients: SavedRecipient[]; destType: string;
  onPick: (r: SavedRecipient) => void; onDelete: (id: string) => void;
}) => {
  const matches = recipients.filter((r) => r.destination_type === destType);
  const [selected, setSelected] = useState<string>("");
  if (matches.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label>Saved recipients</Label>
      <div className="flex gap-2">
        <Select value={selected} onValueChange={(v) => { setSelected(v); const r = matches.find((m) => m.id === v); if (r) onPick(r); }}>
          <SelectTrigger><SelectValue placeholder="Pick a saved recipient" /></SelectTrigger>
          <SelectContent>{matches.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        {selected && (
          <Button type="button" variant="ghost" size="icon" onClick={async () => { await onDelete(selected); setSelected(""); }} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const SaveToggle = ({ save, setSave, label, setLabel }: { save: boolean; setSave: (v: boolean) => void; label: string; setLabel: (v: string) => void }) => (
  <div className="space-y-2 rounded-md border border-border p-3">
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={save} onCheckedChange={(v) => setSave(!!v)} />
      Save this account for next time
    </label>
    {save && <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. My GTBank)" className="h-8" />}
  </div>
);

interface SubmitPayload {
  destination_type: string;
  destination: Record<string, unknown>;
  currency: string; // destination
  amount: number;   // destination amount
  source_currency: string;
  source_amount: number;
  save?: { label: string; provider: string | null };
}

const BankSelectFlow = ({
  provider, country, destType, defaultCurrency, configs, recipients, onDeleteRecipient, onSubmit, loading, dialogOpen, refreshKey,
}: {
  provider: "paystack" | "flutterwave"; country: string; destType: string; defaultCurrency: string;
  configs: WithdrawalConfig[]; recipients: SavedRecipient[];
  onDeleteRecipient: (id: string) => Promise<void>;
  loading: boolean; onSubmit: (p: SubmitPayload) => void;
  dialogOpen: boolean; refreshKey: number;
}) => {
  const { wallets } = useWallet();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [amount, setAmount] = useState("");
  const [destCurrency, setDestCurrency] = useState(defaultCurrency);
  const [sourceCurrency, setSourceCurrency] = useState(wallets[0]?.currency || defaultCurrency);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [save, setSave] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");

  useEffect(() => { setDestCurrency(defaultCurrency); }, [defaultCurrency]);
  useEffect(() => { if (!sourceCurrency && wallets[0]) setSourceCurrency(wallets[0].currency); }, [wallets, sourceCurrency]);

  useEffect(() => {
    (async () => {
      setLoadingBanks(true);
      try {
        const url = `https://yxhcxajipfdflpilubpd.supabase.co/functions/v1/bank-list?country=${country}&provider=${provider}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setBanks(data.banks || []);
      } catch (e: any) { toast.error("Could not load banks: " + (e.message || e)); }
      finally { setLoadingBanks(false); }
    })();
  }, [country, provider]);

  useEffect(() => {
    setAccountName(""); setResolveError("");
    if (!bankCode || accountNumber.length < 10) return;
    const t = setTimeout(async () => {
      setResolving(true);
      try {
        const { data, error } = await supabase.functions.invoke("resolve-account", { body: { bank_code: bankCode, account_number: accountNumber, provider } });
        if (error) throw error;
        if ((data as any).account_name) setAccountName((data as any).account_name);
        else setResolveError((data as any).error || "Could not resolve");
      } catch (e: any) { setResolveError(e.message || "Resolve failed"); }
      finally { setResolving(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [bankCode, accountNumber, provider]);

  const cfg = useConfig(configs, destCurrency, destType);
  const amt = Number(amount);
  const fx = useFxQuote(sourceCurrency, destCurrency, amt);
  const wallet = wallets.find((w) => w.currency === sourceCurrency);
  const dailyUsed = useDailyUsed(destCurrency, dialogOpen, refreshKey);
  const dailyRemaining = cfg?.daily_limit ? Math.max(0, Number(cfg.daily_limit) - dailyUsed) : null;
  const aboveDaily = dailyRemaining !== null && amt > dailyRemaining;
  const belowMin = cfg && amt > 0 && amt < cfg.min_amount;
  const insufficient = wallet && fx.sourceAmount > wallet.available_balance;
  const canSubmit = accountName && amt > 0 && !belowMin && !aboveDaily && cfg?.enabled !== false && !fx.loading && !fx.error && !insufficient && fx.sourceAmount > 0;

  return (
    <div className="space-y-3">
      <RecipientPicker recipients={recipients} destType={destType} onPick={(r) => {
        setBankCode(r.destination.bank_code || ""); setAccountNumber(r.destination.account_number || ""); setAccountName(r.destination.account_name || "");
      }} onDelete={onDeleteRecipient} />
      <div className="space-y-2">
        <Label>Bank</Label>
        <BankCombobox banks={banks} value={bankCode} onChange={setBankCode} loading={loadingBanks} />
      </div>
      <div className="space-y-2">
        <Label>Account number</Label>
        <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0123456789" />
      </div>
      <div className="min-h-6 text-sm">
        {resolving && <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Resolving…</span>}
        {accountName && <span className="flex items-center gap-2 text-primary"><Check className="h-3 w-3" /> {accountName}</span>}
        {resolveError && <span className="text-destructive">{resolveError}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Send currency</Label>
          <Input value={destCurrency} disabled />
        </div>
        <div className="space-y-2">
          <Label>Amount ({destCurrency})</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {belowMin && <p className="text-xs text-destructive">Minimum is {formatMoney(cfg!.min_amount, destCurrency)}.</p>}
      {aboveDaily && <p className="text-xs text-destructive">Daily limit reached. {formatMoney(dailyRemaining!, destCurrency)} left today.</p>}
      <FeeSummary cfg={cfg} currency={destCurrency} amount={amt > 0 ? amt : 0} dailyUsed={dailyUsed} />
      <FxBlock destCurrency={destCurrency} destAmount={amt} sourceCurrency={sourceCurrency} setSourceCurrency={setSourceCurrency} fx={fx} />
      <SaveToggle save={save} setSave={setSave} label={saveLabel} setLabel={setSaveLabel} />
      <Button onClick={() => onSubmit({
        destination_type: destType,
        destination: { bank_code: bankCode, account_number: accountNumber, account_name: accountName, country },
        currency: destCurrency, amount: amt,
        source_currency: sourceCurrency, source_amount: fx.sourceAmount,
        save: save ? { label: saveLabel || `${accountName} (${accountNumber.slice(-4)})`, provider } : undefined,
      })} disabled={!canSubmit || loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Withdrawal"}
      </Button>
    </div>
  );
};

const PayPalFlow = ({ onSubmit, loading, configs, recipients, onDeleteRecipient, dialogOpen, refreshKey }: { onSubmit: (p: SubmitPayload) => void; loading: boolean; configs: WithdrawalConfig[]; recipients: SavedRecipient[]; onDeleteRecipient: (id: string) => Promise<void>; dialogOpen: boolean; refreshKey: number }) => {
  const { wallets } = useWallet();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [destCurrency, setDestCurrency] = useState("USD");
  const [sourceCurrency, setSourceCurrency] = useState(wallets[0]?.currency || "USD");
  const [save, setSave] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const cfg = useConfig(configs, destCurrency, "paypal");
  const amt = Number(amount);
  const fx = useFxQuote(sourceCurrency, destCurrency, amt);
  const wallet = wallets.find((w) => w.currency === sourceCurrency);
  const dailyUsed = useDailyUsed(destCurrency, dialogOpen, refreshKey);
  const dailyRemaining = cfg?.daily_limit ? Math.max(0, Number(cfg.daily_limit) - dailyUsed) : null;
  const aboveDaily = dailyRemaining !== null && amt > dailyRemaining;
  const belowMin = cfg && amt > 0 && amt < cfg.min_amount;
  const insufficient = wallet && fx.sourceAmount > wallet.available_balance;
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && amt > 0 && !belowMin && !aboveDaily && !fx.loading && !fx.error && !insufficient && fx.sourceAmount > 0;
  return (
    <div className="space-y-3">
      <RecipientPicker recipients={recipients} destType="paypal" onPick={(r) => setEmail(r.destination.paypal_email || "")} onDelete={onDeleteRecipient} />
      <div className="space-y-2">
        <Label>PayPal email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Send currency</Label>
          <Select value={destCurrency} onValueChange={setDestCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["USD","EUR","GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amount ({destCurrency})</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {belowMin && <p className="text-xs text-destructive">Minimum is {formatMoney(cfg!.min_amount, destCurrency)}.</p>}
      {aboveDaily && <p className="text-xs text-destructive">Daily limit reached. {formatMoney(dailyRemaining!, destCurrency)} left today.</p>}
      <FeeSummary cfg={cfg} currency={destCurrency} amount={amt > 0 ? amt : 0} dailyUsed={dailyUsed} />
      <FxBlock destCurrency={destCurrency} destAmount={amt} sourceCurrency={sourceCurrency} setSourceCurrency={setSourceCurrency} fx={fx} />
      <SaveToggle save={save} setSave={setSave} label={saveLabel} setLabel={setSaveLabel} />
      <p className="text-xs text-muted-foreground">PayPal withdrawals are reviewed and paid by an admin within 1-2 business days.</p>
      <Button disabled={!valid || loading} onClick={() => onSubmit({
        destination_type: "paypal", currency: destCurrency, amount: amt,
        destination: { paypal_email: email },
        source_currency: sourceCurrency, source_amount: fx.sourceAmount,
        save: save ? { label: saveLabel || email, provider: "manual" } : undefined,
      })} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
      </Button>
    </div>
  );
};

const ProviderAccountFlow = ({ kind, onSubmit, loading, configs, recipients, onDeleteRecipient, dialogOpen, refreshKey }: { kind: "paystack_account" | "flutterwave_account"; onSubmit: (p: SubmitPayload) => void; loading: boolean; configs: WithdrawalConfig[]; recipients: SavedRecipient[]; onDeleteRecipient: (id: string) => Promise<void>; dialogOpen: boolean; refreshKey: number }) => {
  const { wallets } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [destCurrency, setDestCurrency] = useState("NGN");
  const [sourceCurrency, setSourceCurrency] = useState(wallets[0]?.currency || "NGN");
  const [save, setSave] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const cfg = useConfig(configs, destCurrency, kind);
  const amt = Number(amount);
  const fx = useFxQuote(sourceCurrency, destCurrency, amt);
  const wallet = wallets.find((w) => w.currency === sourceCurrency);
  const dailyUsed = useDailyUsed(destCurrency, dialogOpen, refreshKey);
  const dailyRemaining = cfg?.daily_limit ? Math.max(0, Number(cfg.daily_limit) - dailyUsed) : null;
  const aboveDaily = dailyRemaining !== null && amt > dailyRemaining;
  const belowMin = cfg && amt > 0 && amt < cfg.min_amount;
  const insufficient = wallet && fx.sourceAmount > wallet.available_balance;
  const valid = recipient.trim().length > 3 && amt > 0 && !belowMin && !aboveDaily && !fx.loading && !fx.error && !insufficient && fx.sourceAmount > 0;
  const label = kind === "paystack_account" ? "Paystack" : "Flutterwave";
  return (
    <div className="space-y-3">
      <RecipientPicker recipients={recipients} destType={kind} onPick={(r) => setRecipient(r.destination.recipient || "")} onDelete={onDeleteRecipient} />
      <div className="space-y-2">
        <Label>{label} recipient (email or ID)</Label>
        <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="recipient@example.com" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Send currency</Label>
          <Select value={destCurrency} onValueChange={setDestCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DEST_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amount ({destCurrency})</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      {belowMin && <p className="text-xs text-destructive">Minimum is {formatMoney(cfg!.min_amount, destCurrency)}.</p>}
      {aboveDaily && <p className="text-xs text-destructive">Daily limit reached. {formatMoney(dailyRemaining!, destCurrency)} left today.</p>}
      <FeeSummary cfg={cfg} currency={destCurrency} amount={amt > 0 ? amt : 0} dailyUsed={dailyUsed} />
      <FxBlock destCurrency={destCurrency} destAmount={amt} sourceCurrency={sourceCurrency} setSourceCurrency={setSourceCurrency} fx={fx} />
      <SaveToggle save={save} setSave={setSave} label={saveLabel} setLabel={setSaveLabel} />
      <Button disabled={!valid || loading} onClick={() => onSubmit({
        destination_type: kind, currency: destCurrency, amount: amt,
        destination: { recipient },
        source_currency: sourceCurrency, source_amount: fx.sourceAmount,
        save: save ? { label: saveLabel || recipient, provider: kind === "paystack_account" ? "paystack" : "flutterwave" } : undefined,
      })} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Withdrawal"}
      </Button>
    </div>
  );
};

export const WithdrawForm = ({ onDone }: { onDone?: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("ng");
  const [intlCountry, setIntlCountry] = useState(FLW_COUNTRIES[0].code);
  const [configs, setConfigs] = useState<WithdrawalConfig[]>([]);
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [kycMsg, setKycMsg] = useState<string | null>(null);

  const refreshRecipients = useCallback(async () => {
    const { data } = await supabase.from("payout_recipients").select("*").order("created_at", { ascending: false });
    setRecipients((data as SavedRecipient[]) || []);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: cfgs }] = await Promise.all([
        supabase.from("withdrawal_configs").select("*"),
        refreshRecipients(),
      ]);
      setConfigs((cfgs as WithdrawalConfig[]) || []);
    })();
  }, [refreshRecipients]);

  const deleteRecipient = useCallback(async (id: string) => {
    const { error } = await supabase.from("payout_recipients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Saved recipient removed"); refreshRecipients(); }
  }, [refreshRecipients]);

  const submit = async (payload: SubmitPayload & { save?: any }) => {
    setLoading(true);
    setKycMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("withdrawal-create", { body: payload });
      const kyc = await parseKycError(error, data);
      if (kyc) { setKycMsg(kyc); return; }
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (payload.save) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: insErr } = await supabase.from("payout_recipients").insert([{
            user_id: user.id,
            label: payload.save.label,
            destination_type: payload.destination_type,
            destination: payload.destination as any,
            provider: payload.save.provider,
          }]);
          if (insErr) toast.error("Couldn't save recipient: " + insErr.message);
          else refreshRecipients();
        }
      }
      const status = (data as any)?.status;
      toast.success(status === "processing" ? "Withdrawal sent to provider" : "Withdrawal request submitted — pending review");
      setRefreshKey((k) => k + 1);
      onDone?.();
    } catch (e: any) {
      const kyc = await parseKycError(e, null);
      if (kyc) setKycMsg(kyc);
      else toast.error(e.message || "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const intlDefaultCurrency = FLW_COUNTRIES.find((c) => c.code === intlCountry)?.currency || "USD";

  return (
    <>
      {kycMsg && <div className="mb-3"><KycBlockedAlert message={kycMsg} onClose={() => onDone?.()} /></div>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 h-auto">
          <TabsTrigger value="ng">NG</TabsTrigger>
          <TabsTrigger value="gh">GH</TabsTrigger>
          <TabsTrigger value="ke">KE</TabsTrigger>
          <TabsTrigger value="za">ZA</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-3 h-auto mt-2">
          <TabsTrigger value="intl">Other</TabsTrigger>
          <TabsTrigger value="paypal">PayPal</TabsTrigger>
          <TabsTrigger value="account">Provider</TabsTrigger>
        </TabsList>

        <TabsContent value="ng" className="mt-4">
          <BankSelectFlow provider="paystack" country="NG" destType="ng_bank" defaultCurrency="NGN" configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} loading={loading} onSubmit={submit} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="gh" className="mt-4">
          <BankSelectFlow provider="paystack" country="GH" destType="gh_bank" defaultCurrency="GHS" configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} loading={loading} onSubmit={submit} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="ke" className="mt-4">
          <BankSelectFlow provider="paystack" country="KE" destType="ke_bank" defaultCurrency="KES" configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} loading={loading} onSubmit={submit} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="za" className="mt-4">
          <BankSelectFlow provider="flutterwave" country="ZA" destType="za_bank" defaultCurrency="ZAR" configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} loading={loading} onSubmit={submit} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="intl" className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label>Country</Label>
            <ComboPicker
              value={intlCountry}
              onChange={setIntlCountry}
              placeholder="Select country"
              searchPlaceholder="Search countries…"
              emptyText="No country found."
              options={FLW_COUNTRIES.map((c) => ({
                value: c.code,
                label: `${c.name} (${c.currency})`,
                keywords: `${c.code} ${c.currency}`,
              }))}
            />
          </div>
          <BankSelectFlow key={intlCountry} provider="flutterwave" country={intlCountry} destType="intl_bank" defaultCurrency={intlDefaultCurrency} configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} loading={loading} onSubmit={submit} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="paypal" className="mt-4">
          <PayPalFlow onSubmit={submit} loading={loading} configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} dialogOpen={true} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="account" className="mt-4 space-y-4">
          <Tabs defaultValue="paystack">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="paystack">Paystack</TabsTrigger>
              <TabsTrigger value="flutterwave">Flutterwave</TabsTrigger>
            </TabsList>
            <TabsContent value="paystack" className="mt-4">
              <ProviderAccountFlow kind="paystack_account" onSubmit={submit} loading={loading} configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} dialogOpen={true} refreshKey={refreshKey} />
            </TabsContent>
            <TabsContent value="flutterwave" className="mt-4">
              <ProviderAccountFlow kind="flutterwave_account" onSubmit={submit} loading={loading} configs={configs} recipients={recipients} onDeleteRecipient={deleteRecipient} dialogOpen={true} refreshKey={refreshKey} />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </>
  );
};

export const WithdrawDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Withdraw</DialogTitle>
          <DialogDescription>Choose a destination — pay from any wallet, we'll convert.</DialogDescription>
        </DialogHeader>
        {open && <WithdrawForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
};
