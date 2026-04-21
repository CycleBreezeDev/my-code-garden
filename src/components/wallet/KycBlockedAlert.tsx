import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const KycBlockedAlert = ({ message, onClose }: { message: string; onClose?: () => void }) => (
  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
    <div className="flex items-start gap-2">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">Identity verification required</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
        <div className="mt-2 flex gap-2">
          <Button asChild size="sm" onClick={onClose}>
            <Link to="/kyc">Verify identity</Link>
          </Button>
        </div>
      </div>
    </div>
  </div>
);

/** Parses an error from supabase.functions.invoke() and returns the KYC message if it's a 403 KYC block. */
export const parseKycError = async (error: unknown, data: unknown): Promise<string | null> => {
  const d = data as { error?: string; kyc?: { reason?: string; allowed?: boolean } } | null;
  if (d?.kyc && d.kyc.allowed === false) return d.kyc.reason || d.error || "Your current KYC tier doesn't allow this transaction.";
  // FunctionsHttpError exposes .context.response (a Response) that we can read
  const err = error as { context?: { response?: Response }; message?: string } | null;
  if (err?.context?.response) {
    try {
      const body = await err.context.response.clone().json();
      if (body?.kyc && body.kyc.allowed === false) return body.kyc.reason || body.error || "Your current KYC tier doesn't allow this transaction.";
      if (typeof body?.error === "string" && /kyc|tier|verification/i.test(body.error)) return body.error;
    } catch { /* ignore */ }
  }
  if (err?.message && /kyc|tier|verification/i.test(err.message)) return err.message;
  return null;
};
