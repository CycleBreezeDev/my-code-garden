import { NavLink } from "react-router-dom";
import { Plus, ArrowDownToLine, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/wallet/add-funds", label: "Add Funds", icon: Plus },
  { to: "/wallet/withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { to: "/wallet/transactions", label: "Transactions", icon: Receipt },
];

export const WalletSubNav = () => {
  return (
    <nav
      aria-label="Wallet sections"
      className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1"
    >
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};
