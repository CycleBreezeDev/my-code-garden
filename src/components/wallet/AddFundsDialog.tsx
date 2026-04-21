import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { KycBlockedAlert, parseKycError } from "./KycBlockedAlert";

const CURRENCIES = [
  { code: "USD", label: "US Dollar", providers: ["paystack", "flutterwave"] },
  { code: "NGN", label: "Nigerian Naira", providers: ["paystack", "flutterwave"] },
  { code: "GHS", label: "Ghanaian Cedi", providers: ["paystack", "flutterwave"] },
  { code: "KES", label: "Kenyan Shilling", providers: ["paystack", "flutterwave"] },
  { code: "ZAR", label: "South African Rand", providers: ["flutterwave"] },
];

export const AddFundsForm = ({ onDone }: { onDone?: () => void }) => {
  const [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("paystack");
  const [loading, setLoading] = useState(false);
  const [kycMsg, setKycMsg] = useState<string | null>(null);

  const cur = CURRENCIES.find((c) => c.code === currency)!;
  const availableProviders = cur.providers;
  if (!availableProviders.includes(provider)) setProvider(availableProviders[0]);

  const submit = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);
    setKycMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-init-topup", {
        body: { currency, amount: amt, provider },
      });
      const kyc = await parseKycError(error, data);
      if (kyc) { setKycMsg(kyc); setLoading(false); return; }
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data?.error || "Failed to start checkout");
      }
    } catch (e: any) {
      const kyc = await parseKycError(e, null);
      if (kyc) setKycMsg(kyc);
      else toast.error(e.message || "Top-up failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {kycMsg && <KycBlockedAlert message={kycMsg} onClose={() => onDone?.()} />}
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.code} — {c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Amount ({currency})</Label>
        <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="space-y-2">
        <Label>Payment Provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {availableProviders.includes("paystack") && <SelectItem value="paystack">Paystack</SelectItem>}
            {availableProviders.includes("flutterwave") && <SelectItem value="flutterwave">Flutterwave</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={submit} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue to Payment"}
      </Button>
    </div>
  );
};

export const AddFundsDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
          <DialogDescription>Top up your wallet via Paystack or Flutterwave.</DialogDescription>
        </DialogHeader>
        <AddFundsForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};
