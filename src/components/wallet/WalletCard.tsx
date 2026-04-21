import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowDownToLine, Wallet as WalletIcon } from "lucide-react";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { KycBanner } from "@/components/KycBanner";

export const WalletCard = () => {
  const { wallets } = useWallet();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><WalletIcon className="h-5 w-5 text-primary" /> Wallet</CardTitle>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/wallet/add-funds"><Plus className="h-4 w-4" /> Add Funds</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/wallet/withdraw"><ArrowDownToLine className="h-4 w-4" /> Withdraw</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <KycBanner />
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">You don't have any wallet balance yet. Add funds to start playing.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {wallets.map((w) => (
              <div key={w.id} className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs uppercase text-muted-foreground">{w.currency}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(w.available_balance, w.currency)}</div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                  <div>
                    <div className="font-medium text-foreground tabular-nums">{formatMoney(w.pending_balance, w.currency)}</div>
                    <div>Pending</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground tabular-nums">{formatMoney(w.lifetime_deposit, w.currency)}</div>
                    <div>Deposited</div>
                  </div>
                  <div>
                    <div className="font-medium text-foreground tabular-nums">{formatMoney(w.lifetime_withdrawn, w.currency)}</div>
                    <div>Withdrawn</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
