import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  LayoutGrid,
  WalletMinimal,
  PlusCircle,
  ArrowDownCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AddFundsDialog } from "./wallet/AddFundsDialog";
import { WithdrawDialog } from "./wallet/WithdrawDialog";

/**
 * Shared item style for the account dropdown:
 *  - `gap-3` adds breathing room between icon and label
 *  - `py-2` makes rows taller and easier to tap
 *  - icons are muted at rest, brighten to primary on hover/focus
 *  - `[&_svg]:size-4` keeps every icon a consistent 16px
 */
const itemClass =
  "gap-3 py-2 cursor-pointer focus:bg-accent/60 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-primary hover:[&_svg]:text-primary transition-colors";

export const UserMenu = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const [add, setAdd] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  if (!user) return null;
  const initial = (profile?.full_name || user.email || "?").charAt(0).toUpperCase();
  const displayName = profile?.full_name || user.email;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initial}
            </span>
            <span className="hidden sm:inline">Account</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 p-1.5">
          <DropdownMenuLabel className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            {profile?.full_name && user.email && (
              <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClass} onClick={() => navigate("/dashboard")}>
            <LayoutGrid />
            <span>Dashboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => navigate("/dashboard?tab=wallet")}>
            <WalletMinimal />
            <span>Wallet</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => setAdd(true)}>
            <PlusCircle />
            <span>Add Funds</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onClick={() => setWithdraw(true)}>
            <ArrowDownCircle />
            <span>Withdraw</span>
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={itemClass} onClick={() => navigate("/admin")}>
                <ShieldCheck />
                <span>Admin</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={`${itemClass} text-destructive focus:text-destructive focus:[&_svg]:text-destructive hover:[&_svg]:text-destructive`}
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddFundsDialog open={add} onOpenChange={setAdd} />
      <WithdrawDialog open={withdraw} onOpenChange={setWithdraw} />
    </>
  );
};
