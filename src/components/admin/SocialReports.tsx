import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

const STATUSES = ["open", "reviewing", "resolved", "dismissed"];

export const SocialReports = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState("open");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("social_reports").select("*").order("created_at", { ascending: false }).limit(200);
    setReports((data ?? []) as Report[]);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, status: string) => {
    const { error } = await supabase.from("social_reports").update({
      status, resolution_note: notes[id] || null,
      resolved_at: ["resolved","dismissed"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Marked ${status}`); load(); }
  };

  const filtered = reports.filter((r) => r.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Social reports</h2>
        <Badge variant="outline">{reports.filter(r => r.status === "open").length} open</Badge>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">{s} ({reports.filter(r => r.status === s).length})</TabsTrigger>
          ))}
        </TabsList>
        {STATUSES.map((s) => (
          <TabsContent key={s} value={s} className="space-y-3">
            {filtered.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">Nothing here.</Card>
            ) : filtered.map((r) => (
              <Card key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm">
                      <Badge variant="outline" className="mr-2 capitalize">{r.target_type}</Badge>
                      <code className="text-xs text-muted-foreground">{r.target_id.slice(0, 8)}…</code>
                    </div>
                    <div className="mt-2 text-sm text-foreground">{r.reason}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Reported {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                {r.resolution_note && <div className="rounded bg-secondary px-3 py-2 text-xs">{r.resolution_note}</div>}
                {r.status === "open" || r.status === "reviewing" ? (
                  <>
                    <Textarea
                      placeholder="Resolution note (optional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      {r.status === "open" && <Button size="sm" variant="outline" onClick={() => update(r.id, "reviewing")}>Start review</Button>}
                      <Button size="sm" onClick={() => update(r.id, "resolved")}>Resolve</Button>
                      <Button size="sm" variant="ghost" onClick={() => update(r.id, "dismissed")}>Dismiss</Button>
                    </div>
                  </>
                ) : null}
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
