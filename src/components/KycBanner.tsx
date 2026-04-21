import { Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { useKyc } from "@/hooks/useKyc";

export const KycBanner = () => {
  const { profile, currentTier, loading } = useKyc();
  if (loading) return null;
  const status = profile?.status || "unverified";

  if (status === "approved") {
    return (
      <Link to="/kyc" className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-foreground">Verified · Tier {profile?.tier}</span>
        <span className="ml-auto text-muted-foreground">
          ${Number(currentTier?.monthly_limit_usd ?? 0).toLocaleString()}/mo
        </span>
      </Link>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>Verification under review</span>
      </div>
    );
  }
  return (
    <Link to="/kyc" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs hover:bg-destructive/10">
      <ShieldAlert className="h-4 w-4 text-destructive" />
      <span className="font-medium text-foreground">Verify identity to raise limits</span>
      <span className="ml-auto text-muted-foreground">Currently ${Number(currentTier?.monthly_limit_usd ?? 50).toLocaleString()}/mo</span>
    </Link>
  );
};
