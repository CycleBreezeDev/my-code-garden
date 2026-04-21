import { Button } from "@/components/ui/button";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUnreadContactCount } from "@/hooks/useUnreadContactCount";
import { WalletPill } from "./WalletPill";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./social/NotificationBell";
import { MessagesPeek } from "./messaging/MessagesPeek";
import { ThemeToggle } from "./ThemeToggle";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const unreadContacts = useUnreadContactCount(isAdmin);
  const isHome = location.pathname === "/";

  const navLinks = [
    { label: "Lotteries", href: "/lotteries" },
    { label: "Group Tickets", href: "/syndicates" },
    { label: "How It Works", href: isHome ? "#how-it-works" : "/#how-it-works" },
    { label: "Results", href: "/results" },
    ...(user ? [{ label: "Feed", href: "/feed" }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-black text-primary-foreground">E</span>
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-foreground">
            Epic<span className="text-primary">Lotto</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {isAdmin && unreadContacts > 0 && (
                <Link to="/admin" aria-label={`${unreadContacts} new contact submissions`}
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {unreadContacts > 99 ? "99+" : unreadContacts}
                </Link>
              )}
              <WalletPill />
              <MessagesPeek />
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-primary font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            className="rounded-lg p-2 text-foreground transition-colors hover:bg-secondary"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-border/40 bg-background/95 backdrop-blur-2xl px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full border-border">Dashboard</Button>
                  </Link>
                  <Button variant="ghost" className="w-full" onClick={() => { handleSignOut(); setMobileOpen(false); }}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full border-border">Sign In</Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-primary text-primary-foreground">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
