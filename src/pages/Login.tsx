import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().trim().email({ message: "Invalid email" }).max(255),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(128),
});

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      return;
    }
    navigate(from, { replace: true });
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}${from}`,
    });
    if (error) toast({ title: "OAuth failed", description: error.message, variant: "destructive" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-1/2 items-center justify-center bg-card/50 border-r border-border lg:flex">
        <div className="max-w-md px-12">
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-black text-primary-foreground">E</span>
            </div>
            <span className="font-heading text-2xl font-bold text-foreground">
              Epic<span className="text-primary">Lotto</span>
            </span>
          </Link>
          <h2 className="font-heading text-3xl font-bold mb-4">
            Your Gateway to <span className="text-gradient-gold">Global Jackpots</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Play Powerball, Mega Millions, EuroMillions and more. Real tickets, 100% transparency, syndicate play.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-black text-primary-foreground">E</span>
            </div>
            <span className="font-heading text-lg font-bold text-foreground">
              Epic<span className="text-primary">Lotto</span>
            </span>
          </Link>

          <h1 className="font-heading text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">Sign in to your account to continue</p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/20 mt-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign In <ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center"><span className="bg-background px-3 text-xs text-muted-foreground">or continue with</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="border-border" onClick={() => handleOAuth("google")}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </Button>
              <Button type="button" variant="outline" className="border-border" onClick={() => handleOAuth("apple")}>
                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple
              </Button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
