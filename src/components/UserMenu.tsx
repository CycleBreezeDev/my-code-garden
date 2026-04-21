import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, LayoutDashboard, Wallet as WalletIcon, Plus, ArrowDownToLine, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AddFundsDialog } from "./wallet/AddFundsDialog";
import { WithdrawDialog } from "./wallet/WithdrawDialog";

export const UserMenu = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [add, setAdd] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  if (!user) return null;
  const initial = (profile?.full_name || user.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initial}</span>
            <span className="hidden sm:inline">Account</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{profile?.full_name || user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/dashboard")}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/dashboard?tab=wallet")}>
            <WalletIcon className="h-4 w-4" /> Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAdd(true)}>
            <Plus className="h-4 w-4" /> Add Funds
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWithdraw(true)}>
            <ArrowDownToLine className="h-4 w-4" /> Withdraw
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4" /> Admin
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddFundsDialog open={add} onOpenChange={setAdd} />
      <WithdrawDialog open={withdraw} onOpenChange={setWithdraw} />
    </>
  );
};
