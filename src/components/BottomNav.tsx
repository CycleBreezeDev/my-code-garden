import { Home, Ticket, Trophy, Rss, HelpCircle } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Smoothly scroll an element with the given id into view, accounting for
 * the fixed top navbar (~5rem). Returns true if the element was found.
 */
const smoothScrollToId = (id: string): boolean => {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
  return true;
};

interface Item {
  label: string;
  to: string;
  icon: typeof Home;
  /**
   * Pathname prefixes that should highlight this item. The item is
   * considered active when the current pathname matches `to` exactly
   * OR starts with any of `matchPrefixes` followed by "/" (so "/feed"
   * matches "/feed/123" but not "/feedback").
   */
  matchPrefixes?: string[];
  /** Treat this item as never-active (used for hash links like FAQ). */
  alwaysInactive?: boolean;
}

/**
 * Returns true when the bottom-nav item should be visually active for
 * the current pathname. We deliberately ignore the auth-redirected `to`
 * (e.g. `/login`) when checking — "My Tickets" should still highlight
 * on `/dashboard` even if a logged-out user's link points to `/login`.
 */
const isItemActive = (pathname: string, item: Item): boolean => {
  if (item.alwaysInactive) return false;
  for (const prefix of item.matchPrefixes ?? [item.to]) {
    if (prefix === "/") {
      if (pathname === "/") return true;
      continue;
    }
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
  }
  return false;
};

/**
 * Mobile-only bottom navigation. Hidden on `md+` where the top Navbar
 * already provides full navigation.
 */
export const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // When the route changes to "/" with #how-it-works, smooth-scroll once
  // the section has rendered (handles cross-page FAQ navigation).
  useEffect(() => {
    if (location.pathname === "/" && location.hash === "#how-it-works") {
      // Wait one frame so the home page sections are mounted.
      const id = window.requestAnimationFrame(() => {
        smoothScrollToId("how-it-works");
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [location.pathname, location.hash]);

  const items: Item[] = [
    {
      label: "Home",
      to: "/",
      icon: Home,
      matchPrefixes: ["/"],
    },
    {
      label: "My Tickets",
      to: user ? "/dashboard?tab=tickets" : "/login",
      icon: Ticket,
      // Highlight across the whole dashboard/wallet area, regardless of
      // whether the user is signed in (link target may differ).
      matchPrefixes: ["/dashboard", "/wallet", "/kyc"],
    },
    {
      label: "Results",
      to: "/results",
      icon: Trophy,
      matchPrefixes: ["/results", "/lottery", "/lotteries"],
    },
    {
      label: "Feed",
      to: user ? "/feed" : "/login",
      icon: Rss,
      matchPrefixes: ["/feed", "/notifications", "/messages", "/u"],
    },
    {
      label: "FAQ",
      to: "/#how-it-works",
      icon: HelpCircle,
      alwaysInactive: true,
    },
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
        {items.map((item) => {
          const active = isItemActive(location.pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.label} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 transition-transform", active && "scale-110")}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

// Exported for unit tests.
export const __test__ = { isItemActive };
