import { useState } from "react";
import { Navigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Loader2, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useKyc } from "@/hooks/useKyc";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COUNTRIES = [
  { code: "NG", name: "Nigeria" }, { code: "GH", name: "Ghana" }, { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" }, { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "OTHER", name: "Other" },
];
const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "bvn", label: "BVN (Nigeria)" },
  { value: "nin", label: "NIN (Nigeria)" },
  { value: "voters_card", label: "Voter's Card" },
];

const Kyc = () => {
  const { user, loading } = useAuth();
  const { profile, tiers, currentTier, loading: kycLoading, refetch } = useKyc();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    country: "",
    id_type: "",
    id_number: "",
    dob: "",
  });
  const [files, setFiles] = useState<{ id_doc?: File; selfie?: File; por?: File }>({});

  if (loading || kycLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  const uploadFile = async (file: File, slot: string) => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("kyc-docs").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!form.full_name || !form.country || !form.id_type || !form.id_number) {
      toast.error("Please complete all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const id_doc_path = files.id_doc ? await uploadFile(files.id_doc, "id") : null;
      const selfie_path = files.selfie ? await uploadFile(files.selfie, "selfie") : null;
      const por_path = files.por ? await uploadFile(files.por, "por") : null;

      const { data, error } = await supabase.functions.invoke("kyc-submit", {
        body: { ...form, id_doc_path, selfie_path, por_path },
      });
      if (error || (data as { error?: string })?.error) {
        throw new Error(error?.message || (data as { error?: string }).error);
      }
      toast.success("Submitted for review");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = () => {
    const s = profile?.status || "unverified";
    const map: Record<string, { icon: typeof Clock; cls: string; label: string }> = {
      approved: { icon: CheckCircle2, cls: "bg-primary/15 text-primary", label: "Approved" },
      pending: { icon: Clock, cls: "bg-secondary text-muted-foreground", label: "Under Review" },
      rejected: { icon: XCircle, cls: "bg-destructive/15 text-destructive", label: "Rejected" },
      unverified: { icon: ShieldCheck, cls: "bg-muted text-muted-foreground", label: "Unverified" },
    };
    const cfg = map[s] || map.unverified;
    const Icon = cfg.icon;
    return <Badge className={`gap-1 ${cfg.cls}`}><Icon className="h-3 w-3" />{cfg.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Identity Verification</h1>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your verification status</span>
                {statusBadge()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                {tiers.map((t) => {
                  const active = (profile?.tier ?? 0) === t.tier;
                  return (
                    <div key={t.tier} className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs uppercase text-muted-foreground">Tier {t.tier}</div>
                        {active && <Badge variant="outline" className="text-[10px]">Current</Badge>}
                      </div>
                      <div className="mt-1 text-sm font-semibold">{t.name}</div>
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Daily: ${Number(t.daily_limit_usd).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Monthly: ${Number(t.monthly_limit_usd).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
              {currentTier && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Current limits: <strong>${Number(currentTier.daily_limit_usd).toLocaleString()}/day</strong> ·{" "}
                  <strong>${Number(currentTier.monthly_limit_usd).toLocaleString()}/month</strong>
                </p>
              )}
              {profile?.status === "rejected" && profile.rejection_reason && (
                <p className="mt-3 text-sm text-destructive">Reason: {profile.rejection_reason}</p>
              )}
            </CardContent>
          </Card>

          {profile?.status === "approved" ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
                <p className="text-sm text-muted-foreground">You're verified at Tier {profile.tier}.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{profile?.status === "pending" ? "Submission under review" : "Submit for review"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Full legal name</Label>
                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="As shown on your ID" />
                  </div>
                  <div>
                    <Label>Date of birth</Label>
                    <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ID type</Label>
                    <Select value={form.id_type} onValueChange={(v) => setForm({ ...form, id_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                      <SelectContent>
                        {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>ID / Document number</Label>
                    <Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <FileSlot label="ID document" file={files.id_doc} onChange={(f) => setFiles({ ...files, id_doc: f })} />
                  <FileSlot label="Selfie" file={files.selfie} onChange={(f) => setFiles({ ...files, selfie: f })} />
                  <FileSlot label="Proof of residence" file={files.por} onChange={(f) => setFiles({ ...files, por: f })} />
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : "Submit for review"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

const FileSlot = ({ label, file, onChange }: { label: string; file?: File; onChange: (f: File) => void }) => (
  <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center hover:border-primary/40">
    <Upload className="h-5 w-5 text-muted-foreground" />
    <span className="text-xs font-medium text-foreground">{label}</span>
    <span className="truncate text-[11px] text-muted-foreground">{file?.name || "Click to upload"}</span>
    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
  </label>
);

export default Kyc;
