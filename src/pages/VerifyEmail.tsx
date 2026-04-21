import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

/**
 * Post-signup landing page that tells the user to confirm their email before
 * they can sign in. The signup flow on /register passes the email via
 * `location.state.email` so we can show a precise instruction and offer a
 * one-click "Resend confirmation" action.
 */
const RESEND_COOLDOWN_SECONDS = 60;
const VERIFICATION_POLL_MS = 4000;
const VERIFICATION_CHANNEL = "epiclotto-auth";
const VERIFIED_FLAG_KEY = "verify-email:verified-at";
const cooldownKey = (e: string) => `verify-email:resend-until:${e.trim().toLowerCase()}`;

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const stateEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(stateEmail);
  const [resending, setResending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  // Detected externally (sibling tab / direct GET) — drives the success card.
  const [verifiedExternally, setVerifiedExternally] = useState(false);
  const redirectingRef = useRef(false);

  // Restore any active cooldown for the current email from localStorage so a
  // refresh or revisit can't bypass the limit. Re-runs whenever the email
  // string changes (e.g. user types into the resend input).
  useEffect(() => {
    if (!email) {
      setCooldownUntil(0);
      return;
    }
    try {
      const raw = localStorage.getItem(cooldownKey(email));
      const until = raw ? Number(raw) : 0;
      setCooldownUntil(until > Date.now() ? until : 0);
    } catch {
      setCooldownUntil(0);
    }
  }, [email]);

  // Tick once per second only while a cooldown is active to drive the
  // countdown label without re-rendering the whole page in the idle state.
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil, now]);

  const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isCoolingDown = remainingSeconds > 0;

  // If the user clicks the email link and gets auto-signed-in, send them onward.
  useEffect(() => {
    if (!authLoading && user) navigate("/dashboard", { replace: true });
  }, [user, authLoading, navigate]);

  // Wait for auth to resolve before deciding what to render to avoid flashing
  // the "missing email" guard while the session is still being restored.
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Page guard — already signed in: nudge them to the dashboard / login instead
  // of showing a confusing "check your email" screen.
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">You're already signed in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like your account is active. Head to your dashboard to keep playing.
          </p>
          <div className="mt-6 grid gap-2">
            <Button asChild className="w-full bg-primary text-primary-foreground">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full border-border">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Page guard — landed here without a signup context (no email in state and
  // none typed yet). Offer a clear path to /login or /register instead of an
  // empty resend form.
  if (!stateEmail && !email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Nothing to verify here</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We don't have a pending sign-up on this device. If you've already confirmed your email,
              just sign in. Otherwise, create an account to get started.
            </p>
            <div className="mt-6 grid gap-2">
              <Button asChild className="w-full bg-primary text-primary-foreground">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full border-border">
                <Link to="/register">Create an account</Link>
              </Button>
              <button
                type="button"
                onClick={() => setEmail(" ")}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Or resend confirmation to a different address
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const startCooldown = (seconds: number) => {
    const until = Date.now() + seconds * 1000;
    setCooldownUntil(until);
    setNow(Date.now());
    try {
      if (email) localStorage.setItem(cooldownKey(email), String(until));
    } catch {
      // localStorage may be unavailable (private mode) — in-memory state still
      // enforces the cooldown for this tab.
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({
        title: "Enter your email",
        description: "Type the address you signed up with so we can resend the link.",
        variant: "destructive",
      });
      return;
    }
    if (isCoolingDown) {
      toast({
        title: "Hold on a moment",
        description: `You can request another email in ${remainingSeconds}s.`,
      });
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) {
      // Honor server-side rate-limit hints when present (e.g. "for security
      // purposes, you can only request this after 47 seconds").
      const match = /after (\d+)\s*seconds?/i.exec(error.message);
      if (match) {
        startCooldown(Math.min(Number(match[1]), 300));
      }
      toast({ title: "Couldn't resend", description: error.message, variant: "destructive" });
      return;
    }
    startCooldown(RESEND_COOLDOWN_SECONDS);
    toast({
      title: "Confirmation sent",
      description: `Check ${email} (and spam) for the activation link.`,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>

          <h1 className="font-heading text-2xl font-bold text-foreground">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            {email ? (
              <span className="font-semibold text-foreground">{email}</span>
            ) : (
              <span className="font-semibold text-foreground">your email</span>
            )}
            . Click the link to activate your account before signing in.
          </p>

          <ul className="mt-6 space-y-2 text-left text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              The link expires in 24 hours.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              No email? Check your spam or promotions folder.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Use the same device/browser for the smoothest sign-in.
            </li>
          </ul>

          <div className="mt-6 space-y-3">
            {!stateEmail && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            )}
            <Button
              onClick={handleResend}
              disabled={resending || isCoolingDown}
              variant="outline"
              className="w-full border-border"
              aria-live="polite"
            >
              {resending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isCoolingDown
                ? `Resend available in ${remainingSeconds}s`
                : "Resend confirmation email"}
            </Button>
            {isCoolingDown && (
              <p className="text-center text-[11px] text-muted-foreground">
                To protect your inbox, you can request another email every {RESEND_COOLDOWN_SECONDS} seconds.
              </p>
            )}
            <Button asChild className="w-full bg-primary text-primary-foreground">
              <Link to="/login">I've confirmed — sign in</Link>
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Wrong address?{" "}
          <Link to="/register" className="text-primary hover:underline">
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmail;
