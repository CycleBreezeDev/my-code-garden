import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Profile = {
  user_id: string;
  full_name: string | null;
  country: string | null;
  id_type: string | null;
  id_number: string | null;
  dob: string | null;
  status: string;
  tier: number;
  rejection_reason: string | null;
  updated_at: string;
};
type Doc = { id: string; doc_type: string; storage_path: string; user_id: string };
type Tier = { id: string; tier: number; name: string; daily_limit_usd: number; monthly_limit_usd: number };

export const KycManager = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [tierChoice, setTierChoice] = useState<Record<string, string>>({});

  const profilesQ = useQuery({
    queryKey: ["admin-kyc-profiles", filter],
    queryFn: async () => {
      let q = supabase.from("kyc_profiles").select("*").order("updated_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Profile[]) ?? [];
    },
  });

  const docsQ = useQuery({
    queryKey: ["admin-kyc-docs"],
    queryFn: async () => {
      const { data } = await supabase.from("kyc_documents").select("id, doc_type, storage_path, user_id").order("created_at", { ascending: false }).limit(500);
      return (data as Doc[]) ?? [];
    },
  });

  const tiersQ = useQuery({
    queryKey: ["admin-kyc-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("kyc_tiers").select("*").order("tier");
      return (data as Tier[]) ?? [];
    },
  });

  const docsByUser = (uid: string) => (docsQ.data || []).filter((d) => d.user_id === uid);

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("kyc-docs").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) return toast.error("Could not open document");
    window.open(data.signedUrl, "_blank");
  };

  const act = async (user_id: string, action: "approve" | "reject") => {
    setBusy(user_id);
    try {
      const tier = action === "approve" ? Number(tierChoice[user_id] || 1) : 0;
      const { data, error } = await supabase.functions.invoke("kyc-admin-action", {
        body: { user_id, action, tier, reason: reasons[user_id] || null },
      });
      if (error || (data as { error?: string })?.error) throw new Error(error?.message || (data as { error?: string }).error);
      toast.success(action === "approve" ? `Approved at Tier ${tier}` : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-kyc-profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const updateTier = async (id: string, patch: Partial<Tier>) => {
    const { error } = await supabase.from("kyc_tiers").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tier updated");
    qc.invalidateQueries({ queryKey: ["admin-kyc-tiers"] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> KYC Management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tier limits editor */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Tier limits (USD)</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(tiersQ.data || []).map((t) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">Tier {t.tier}</div>
                <div className="text-sm font-semibold">{t.name}</div>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Daily</label>
                    <Input type="number" defaultValue={t.daily_limit_usd}
                      onBlur={(e) => Number(e.target.value) !== Number(t.daily_limit_usd) && updateTier(t.id, { daily_limit_usd: Number(e.target.value) })}
                      className="h-8" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Monthly</label>
                    <Input type="number" defaultValue={t.monthly_limit_usd}
                      onBlur={(e) => Number(e.target.value) !== Number(t.monthly_limit_usd) && updateTier(t.id, { monthly_limit_usd: Number(e.target.value) })}
                      className="h-8" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submissions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Submissions</h3>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {profilesQ.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (profilesQ.data || []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No submissions.</p>
          ) : (
            <div className="space-y-2">
              {profilesQ.data!.map((p) => {
                const userDocs = docsByUser(p.user_id);
                return (
                  <div key={p.user_id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{p.full_name || "—"}</div>
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                          <Badge variant="outline" className="text-[10px]">Tier {p.tier}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {p.country || "—"} · {p.id_type || "—"} · {p.id_number || "—"} · DOB {p.dob || "—"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">User: {p.user_id}</div>
                        {userDocs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {userDocs.map((d) => (
                              <button key={d.id} onClick={() => openDoc(d.storage_path)}
                                className="inline-flex items-center gap-1 rounded-md bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary">
                                <FileText className="h-3 w-3" />{d.doc_type}<ExternalLink className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        )}
                        {p.rejection_reason && <p className="mt-1 text-xs text-destructive">{p.rejection_reason}</p>}
                      </div>
                    </div>

                    {p.status !== "approved" && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto_auto]">
                        <Select value={tierChoice[p.user_id] || "1"} onValueChange={(v) => setTierChoice({ ...tierChoice, [p.user_id]: v })}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Approve at Tier 1</SelectItem>
                            <SelectItem value="2">Approve at Tier 2</SelectItem>
                            <SelectItem value="3">Approve at Tier 3</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Reason (optional for approve, required for reject)"
                          value={reasons[p.user_id] || ""} onChange={(e) => setReasons({ ...reasons, [p.user_id]: e.target.value })}
                          className="h-9" />
                        <Button size="sm" disabled={busy === p.user_id} onClick={() => act(p.user_id, "approve")}>Approve</Button>
                        <Button size="sm" variant="outline" disabled={busy === p.user_id} onClick={() => act(p.user_id, "reject")}>Reject</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
