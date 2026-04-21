import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

/**
 * Post-signup landing page that tells the user to confirm their email before
 * they can sign in. The signup flow on /register passes the email via
 * `location.state.email` so we can show a precise instruction and offer a
 * one-click "Resend confirmation" action.
 */
const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const stateEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(stateEmail);
  const [resending, setResending] = useState(false);

  // If the user clicks the email link and gets auto-signed-in, send them onward.
  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleResend = async () => {
    if (!email) {
      toast({
        title: "Enter your email",
        description: "Type the address you signed up with so we can resend the link.",
        variant: "destructive",
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
      toast({ title: "Couldn't resend", description: error.message, variant: "destructive" });
      return;
    }
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
              disabled={resending}
              variant="outline"
              className="w-full border-border"
            >
              {resending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Resend confirmation email
            </Button>
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
