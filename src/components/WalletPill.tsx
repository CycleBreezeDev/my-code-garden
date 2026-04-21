import { useState } from "react";
import { Wallet as WalletIcon, Plus, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWallet, formatMoney } from "@/contexts/WalletContext";
import { AddFundsDialog } from "./wallet/AddFundsDialog";
import { WithdrawDialog } from "./wallet/WithdrawDialog";

export const WalletPill = () => {
  const { wallets, primary } = useWallet();
  const [add, setAdd] = useState(false);
  const [withdraw, setWithdraw] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-primary/15 hover:shadow-md dark:border-transparent dark:bg-secondary/60 dark:hover:bg-secondary"
          >
            <WalletIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {primary ? formatMoney(primary.available_balance, primary.currency) : "$0.00"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Balances</div>
          {wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet yet. Add funds to get started.</p>
          ) : (
            <ul className="space-y-1.5">
              {wallets.map((w) => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{w.currency}</span>
                  <span className="tabular-nums">{formatMoney(w.available_balance, w.currency)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => setAdd(true)} className="gap-1"><Plus className="h-3.5 w-3.5" />Add</Button>
            <Button size="sm" variant="outline" onClick={() => setWithdraw(true)} className="gap-1"><ArrowDownToLine className="h-3.5 w-3.5" />Withdraw</Button>
          </div>
        </PopoverContent>
      </Popover>
      <AddFundsDialog open={add} onOpenChange={setAdd} />
      <WithdrawDialog open={withdraw} onOpenChange={setWithdraw} />
    </>
  );
};
