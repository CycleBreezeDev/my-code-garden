import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const retry = () => {
    setError(null);
    setLoading(true);
    setRetryTick((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer profile fetch to avoid deadlocks
        setTimeout(() => {
          supabase
            .from("profiles")
            .select("*")
            .eq("user_id", newSession.user.id)
            .maybeSingle()
            .then(({ data }) => setProfile(data as Profile | null));
        }, 0);
      } else {
        setProfile(null);
      }
    });

    // Always release `loading` even if getSession() rejects (e.g. transient
    // network failure on the published site). Without a .catch, a rejected
    // promise leaves loading=true forever and ProtectedRoute renders a
    // blank "Loading…" screen indefinitely.
    supabase.auth
      .getSession()
      .then(({ data: { session: existing } }) => {
        if (cancelled) return;
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          supabase
            .from("profiles")
            .select("*")
            .eq("user_id", existing.user.id)
            .maybeSingle()
            .then(({ data, error: profileError }) => {
              if (profileError) {
                /* profile fetch failure is non-fatal */
                return;
              }
              setProfile(data as Profile | null);
            });
        }
      })
      .catch((err) => {
        console.error("[Auth] getSession failed", err);
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    // Safety net: if for any reason neither path resolves within 5s, stop
    // blocking the UI. Better to render an unauthenticated view than a
    // permanently blank page.
    const safetyTimeout = window.setTimeout(() => {
      if (cancelled) return;
      setLoading((prev) => {
        if (prev) {
          console.warn("[Auth] loading state forced to false by safety timeout");
          setError((prevErr) => prevErr ?? new Error("Authentication timed out. Please retry."));
        }
        return false;
      });
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(safetyTimeout);
    };
  }, [retryTick]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, error, retry, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
