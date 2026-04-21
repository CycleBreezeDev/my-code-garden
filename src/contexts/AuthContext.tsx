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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        setSession(existing);
        setUser(existing?.user ?? null);
        if (existing?.user) {
          supabase
            .from("profiles")
            .select("*")
            .eq("user_id", existing.user.id)
            .maybeSingle()
            .then(({ data }) => setProfile(data as Profile | null))
            .catch(() => {
              /* profile fetch failure is non-fatal */
            });
        }
      })
      .catch((err) => {
        console.error("[Auth] getSession failed", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Safety net: if for any reason neither path resolves within 5s, stop
    // blocking the UI. Better to render an unauthenticated view than a
    // permanently blank page.
    const safetyTimeout = window.setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn("[Auth] loading state forced to false by safety timeout");
        return false;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(safetyTimeout);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
