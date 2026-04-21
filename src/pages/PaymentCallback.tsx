import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const PaymentCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    const reference = params.get("reference") || params.get("trxref") || params.get("tx_ref");
    const type = params.get("type");
    const flwStatus = params.get("status");

    // Wallet top-up callback (Paystack or Flutterwave)
    if (type === "topup") {
      if (flwStatus === "cancelled" || flwStatus === "failed") {
        setStatus("error");
        setMessage("Top-up was cancelled or failed.");
        return;
      }
      setStatus("success");
      setMessage("Top-up received. Your wallet will update shortly.");
      setTimeout(() => navigate("/dashboard"), 2000);
      return;
    }

    if (!reference) {
      setStatus("error");
      setMessage("Missing payment reference.");
      return;
    }

    (async () => {
      try {
        // Recover any Lucky Picks the user submitted before being redirected to Paystack
        let picks: unknown = undefined;
        try {
          const raw = sessionStorage.getItem(`picks:${reference}`);
          if (raw) picks = JSON.parse(raw);
        } catch {
          /* ignore */
        }

        const { data, error } = await supabase.functions.invoke("paystack-verify", {
          body: { reference, picks },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Payment could not be verified");

        // Clean up stashed picks
        try {
          sessionStorage.removeItem(`picks:${reference}`);
        } catch {
          /* ignore */
        }

        setStatus("success");
        setMessage(
          data.picks_saved
            ? `Payment confirmed. You're in the group — ${data.picks_saved} Lucky Pick${data.picks_saved > 1 ? "s" : ""} saved!`
            : "Payment confirmed. You're in the group!",
        );
        queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
        queryClient.invalidateQueries({ queryKey: ["syndicates"] });
        queryClient.invalidateQueries({ queryKey: ["home-syndicates"] });
        setTimeout(() => navigate("/dashboard"), 2000);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Verification failed");
      }
    })();
  }, [params, navigate, queryClient]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          {status === "verifying" && <Loader2 className="mx-auto mb-6 h-12 w-12 animate-spin text-primary" />}
          {status === "success" && <CheckCircle2 className="mx-auto mb-6 h-12 w-12 text-primary" />}
          {status === "error" && <XCircle className="mx-auto mb-6 h-12 w-12 text-destructive" />}

          <h1 className="font-heading text-2xl font-bold mb-3">
            {status === "verifying" && "Verifying payment"}
            {status === "success" && "Payment successful"}
            {status === "error" && "Payment issue"}
          </h1>
          <p className="text-muted-foreground mb-8">{message}</p>

          {status !== "verifying" && (
            <div className="flex justify-center gap-3">
              <Link to="/dashboard"><Button>Go to Dashboard</Button></Link>
              <Link to="/syndicates"><Button variant="outline">Browse Groups</Button></Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentCallback;
