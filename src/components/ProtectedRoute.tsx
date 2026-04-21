import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { authLog } from "@/lib/authLogger";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  const enteredAt = useRef<number>(performance.now());
  const loggedDecision = useRef(false);

  // Log entry into the guard once per mount
  useEffect(() => {
    authLog.info("ProtectedRoute.mount", "guard entered", {
      path: location.pathname,
      initialLoading: loading,
      hasUser: !!user,
    });
    return () => {
      authLog.debug("ProtectedRoute.unmount", "guard left", { path: location.pathname });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn if the loading state stays true for too long — usually the smoking
  // gun for the "blank /messages page" symptom.
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => {
      authLog.warn("ProtectedRoute.stuckLoading", "still loading after 4000ms", {
        path: location.pathname,
        elapsedMs: Math.round(performance.now() - enteredAt.current),
      });
    }, 4000);
    return () => window.clearTimeout(t);
  }, [loading, location.pathname]);

  // Log auth errors that surface through the context
  useEffect(() => {
    if (error) {
      authLog.error("ProtectedRoute.authError", "AuthContext reported an error", {
        path: location.pathname,
        message: error.message,
      });
    }
  }, [error, location.pathname]);

  // Log final decision (allowed / redirect) exactly once
  useEffect(() => {
    if (loading || loggedDecision.current) return;
    loggedDecision.current = true;
    if (!user) {
      authLog.info("ProtectedRoute.decision", "redirecting to /login (no user)", {
        path: location.pathname,
        elapsedMs: Math.round(performance.now() - enteredAt.current),
      });
    } else {
      authLog.info("ProtectedRoute.decision", "rendering protected children", {
        path: location.pathname,
        userId: user.id,
        elapsedMs: Math.round(performance.now() - enteredAt.current),
      });
    }
  }, [loading, user, location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground"
          aria-hidden
        />
        <div className="text-sm text-foreground/80">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
