import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Trophy,
  Wallet,
  ArrowLeftRight,
  Palette,
  Inbox,
  ShieldCheck,
  Flag,
  ListChecks,
  KeyRound,
  Github,
  Shield,
  LogOut,
  Home,
  Loader2,
  Settings2,
  Users,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Insights",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/admin/draws", label: "Draws", icon: Trophy },
      { to: "/admin/syndicates", label: "Syndicates", icon: Users },
      { to: "/admin/syndicate-picks", label: "Lucky Picks", icon: ListChecks },
      { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
      { to: "/admin/withdrawal-configs", label: "Payout Configs", icon: Settings2 },
      { to: "/admin/fx", label: "FX Pairs", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Content",
    items: [
      { to: "/admin/lotteries", label: "Lotteries & Branding", icon: Palette },
      { to: "/admin/contact", label: "Contact Inbox", icon: Inbox },
    ],
  },
  {
    title: "Trust & Safety",
    items: [
      { to: "/admin/kyc", label: "KYC", icon: ShieldCheck },
      { to: "/admin/reports", label: "Social Reports", icon: Flag },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/secrets", label: "Secrets Audit", icon: KeyRound },
      { to: "/admin/github", label: "GitHub Sync", icon: Github },
    ],
  },
];

export const AdminLayout = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h1 className="font-heading text-xl font-bold text-foreground">
            Admin only
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Page title from current path
  const allItems = SECTIONS.flatMap((s) => s.items);
  const current =
    allItems.find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to),
    ) ?? allItems[0];

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">Admin Console</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {user.email}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <NavLink
            to="/"
            className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <Home className="h-4 w-4" /> Back to site
          </NavLink>
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <current.icon className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <h1 className="truncate font-heading text-lg font-bold text-foreground">
                {current.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Button asChild variant="outline" size="sm">
              <NavLink to="/">
                <Home className="h-4 w-4" />
              </NavLink>
            </Button>
          </div>
        </header>

        {/* Mobile section pills */}
        <div className="border-b border-border bg-card/50 px-4 py-2 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {allItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
