import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setState("invalid");
          return;
        }
        if (data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error) {
      setError(error.message);
      setState("error");
      return;
    }
    if ((data as { success?: boolean })?.success) setState("done");
    else setState("already");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email preferences</CardTitle>
          <CardDescription>Manage your email subscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying link…
            </div>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm">Click below to unsubscribe from emails.</p>
              <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
            </>
          )}
          {state === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </div>
          )}
          {state === "done" && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <p>You've been unsubscribed. You won't receive any further emails.</p>
            </div>
          )}
          {state === "already" && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
              <p>This email address is already unsubscribed.</p>
            </div>
          )}
          {state === "invalid" && (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <p>This link is invalid or has expired.</p>
            </div>
          )}
          {state === "error" && (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <p>Something went wrong: {error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
