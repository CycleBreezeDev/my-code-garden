import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authLog, serializeError } from "@/lib/authLogger";

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
    authLog.info("AuthProvider.retry", "user-initiated retry of session restore");
    setError(null);
    setLoading(true);
    setRetryTick((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const startedAt = performance.now();
    authLog.info("AuthProvider.init", "starting session restore", {
      retryTick,
      online: typeof navigator !== "undefined" ? navigator.onLine : "unknown",
      href: typeof window !== "undefined" ? window.location.href : "unknown",
    });

    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      authLog.info("AuthProvider.onAuthStateChange", event, {
        hasSession: !!newSession,
        userId: newSession?.user?.id ?? null,
      });
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
            .then(({ data, error: profileError }) => {
              if (profileError) {
                authLog.warn("AuthProvider.profileFetch", "profile fetch failed (listener)", serializeError(profileError));
                return;
              }
              setProfile(data as Profile | null);
            });
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
      .then(({ data: { session: existing }, error: sessionError }) => {
        if (cancelled) return;
        const elapsed = Math.round(performance.now() - startedAt);
        if (sessionError) {
          authLog.error("AuthProvider.getSession", `resolved with error in ${elapsed}ms`, serializeError(sessionError));
          setError(sessionError instanceof Error ? sessionError : new Error(String(sessionError)));
          return;
        }
        authLog.info("AuthProvider.getSession", `resolved in ${elapsed}ms`, {
          hasSession: !!existing,
          userId: existing?.user?.id ?? null,
        });
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
                authLog.warn("AuthProvider.profileFetch", "profile fetch failed (init)", serializeError(profileError));
                return;
              }
              setProfile(data as Profile | null);
            });
        }
      })
      .catch((err) => {
        const elapsed = Math.round(performance.now() - startedAt);
        authLog.error("AuthProvider.getSession", `rejected in ${elapsed}ms`, serializeError(err));
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
          authLog.warn("AuthProvider.safetyTimeout", "loading forced to false after 5000ms — getSession never resolved", {
            online: typeof navigator !== "undefined" ? navigator.onLine : "unknown",
          });
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
