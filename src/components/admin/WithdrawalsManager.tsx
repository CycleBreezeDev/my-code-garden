import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WithdrawalRow {
  id: string;
  user_id: string;
  currency: string;
  amount: number;
  net_amount: number;
  fee: number;
  destination_type: string;
  destination: any;
  provider: string;
  provider_ref: string | null;
  status: string;
  failure_reason: string | null;
  created_at: string;
  fx_rate: number | null;
  fx_markup_percent: number | null;
  source_amount: number | null;
  source_currency: string | null;
}

export const WithdrawalsManager = () => {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setRows((data as WithdrawalRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const act = async (id: string, action: "mark_paid" | "reject") => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke("withdrawal-admin-action", {
        body: { withdrawal_id: id, action, reference: refs[id] || null, reason: action === "reject" ? "Admin rejected" : null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === "mark_paid" ? "Marked paid" : "Rejected & refunded");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Withdrawal Requests</CardTitle></CardHeader>
      <CardContent>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawal requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {r.amount.toFixed(2)} {r.currency} <span className="text-muted-foreground">→ {r.destination_type} ({r.provider})</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.destination?.account_name || r.destination?.paypal_email || r.destination?.recipient || "—"}
                      {r.destination?.account_number ? ` · ${r.destination.account_number}` : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    {r.source_amount != null && r.source_currency && (
                      <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                        From {r.source_amount.toFixed(2)} {r.source_currency}
                        {" → "}{r.amount.toFixed(2)} {r.currency}
                        {r.fx_rate != null && (
                          <> · 1 {r.source_currency} = {Number(r.fx_rate).toFixed(4)} {r.currency}</>
                        )}
                        {r.fx_markup_percent != null && (
                          <> · markup {Number(r.fx_markup_percent).toFixed(2)}%</>
                        )}
                      </div>
                    )}
                    {r.failure_reason && <div className="text-[11px] text-destructive">{r.failure_reason}</div>}
                  </div>
                  <Badge variant={r.status === "paid" ? "default" : r.status === "failed" || r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                </div>
                {(r.status === "pending" || r.status === "processing" || r.status === "failed") && (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      value={refs[r.id] || ""}
                      onChange={(e) => setRefs((s) => ({ ...s, [r.id]: e.target.value }))}
                      placeholder="External reference (optional)"
                      className="h-8 max-w-xs"
                    />
                    <Button size="sm" disabled={busyId === r.id} onClick={() => act(r.id, "mark_paid")}>Mark paid</Button>
                    <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "reject")}>Reject & refund</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
