import { Home, Ticket, Trophy, Rss, HelpCircle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Item {
  label: string;
  to: string;
  icon: typeof Home;
  /** When true, only matches the exact path (so "/" doesn't stay active everywhere). */
  end?: boolean;
}

/**
 * Mobile-only bottom navigation. Hidden on `md+` where the top Navbar
 * already provides full navigation. Routes that require auth (`/dashboard`,
 * `/feed`) gracefully redirect to `/login` via <ProtectedRoute />.
 */
export const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  const items: Item[] = [
    { label: "Home", to: "/", icon: Home, end: true },
    { label: "My Tickets", to: user ? "/dashboard" : "/login", icon: Ticket },
    { label: "Results", to: "/results", icon: Trophy },
    { label: "Feed", to: user ? "/feed" : "/login", icon: Rss },
    { label: "FAQ", to: "/#how-it-works", icon: HelpCircle },
  ];

  // Don't render on auth screens — they have their own focused layout.
  if (location.pathname === "/login" || location.pathname === "/register") return null;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map(({ label, to, icon: Icon, end }) => {
          // Special-case the FAQ hash link — NavLink doesn't activate on
          // hashes, so we treat it as never-active.
          const isHash = to.includes("#");
          return (
            <li key={label} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                    isActive && !isHash
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-transform",
                        isActive && !isHash && "scale-110",
                      )}
                    />
                    <span className="leading-none">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
