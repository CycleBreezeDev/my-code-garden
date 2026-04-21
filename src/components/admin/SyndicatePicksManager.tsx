import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ListChecks, Download, Check, Shuffle, Wand2 } from "lucide-react";
import { toast } from "sonner";

type SynRow = {
  id: string;
  name: string;
  slug: string;
  picks_lock_offset_minutes: number;
  draw: { draw_date: string; lottery: { name: string } };
};

type PickRow = {
  id: string;
  share_index: number;
  main_numbers: number[];
  bonus_numbers: number[];
  status: "pending" | "included" | "quick_picked";
  user_id: string;
  membership_id: string;
};

const SyndicatePicksManager = () => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: syndicates, isLoading: synLoading } = useQuery({
    queryKey: ["admin-syndicates-picks"],
    queryFn: async (): Promise<SynRow[]> => {
      const { data, error } = await supabase
        .from("syndicates")
        .select(
          "id, name, slug, picks_lock_offset_minutes, draw:lottery_draws!inner(draw_date, lottery:lotteries!inner(name))"
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as SynRow[]) ?? [];
    },
  });

  const { data: picks, isLoading: picksLoading } = useQuery({
    queryKey: ["admin-picks", selected],
    enabled: !!selected,
    queryFn: async (): Promise<PickRow[]> => {
      const { data, error } = await supabase
        .from("syndicate_picks")
        .select("id, share_index, main_numbers, bonus_numbers, status, user_id, membership_id")
        .eq("syndicate_id", selected)
        .order("share_index");
      if (error) throw error;
      return (data ?? []) as PickRow[];
    },
  });

  const updateStatus = async (id: string, status: PickRow["status"]) => {
    const { error } = await supabase
      .from("syndicate_picks")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pick updated");
    qc.invalidateQueries({ queryKey: ["admin-picks", selected] });
  };

  const exportCsv = () => {
    if (!picks || picks.length === 0) return;
    const syn = syndicates?.find((s) => s.id === selected);
    const header = ["share_index", "main_numbers", "bonus_numbers", "status", "user_id", "membership_id"];
    const rows = picks.map((p) => [
      p.share_index,
      p.main_numbers.join(" "),
      p.bonus_numbers.join(" "),
      p.status,
      p.user_id,
      p.membership_id,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `picks-${syn?.slug ?? selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedSyn = syndicates?.find((s) => s.id === selected);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-bold text-foreground">
          Syndicate Lucky Picks
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pick a syndicate
          </h3>
          {synLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : syndicates && syndicates.length > 0 ? (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {syndicates.map((s) => {
                const isSel = s.id === selected;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                      isSel ? "border-primary bg-primary/5" : "border-border bg-secondary/20 hover:border-primary/40"
                    }`}
                  >
                    <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.draw.lottery.name} · {new Date(s.draw.draw_date).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No syndicates found.</p>
          )}
        </div>

        <div>
          {!selectedSyn ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <ListChecks className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a syndicate to view picks</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedSyn.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Lock offset: {selectedSyn.picks_lock_offset_minutes} min before draw
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      const ok = window.confirm(
                        "Finalize picks?\n\nThis will:\n• Promote all submitted user picks to 'included'\n• Backfill Quick Picks for any share without a pick\n\nRun this once the bundle is locked."
                      );
                      if (!ok) return;
                      const { data, error } = await supabase.rpc("finalize_syndicate_picks", {
                        _syndicate_id: selected,
                      });
                      if (error) {
                        toast.error(error.message);
                        return;
                      }
                      const r = (data ?? {}) as { promoted?: number; quick_picks_added?: number };
                      toast.success(
                        `Finalized · ${r.promoted ?? 0} promoted, ${r.quick_picks_added ?? 0} Quick Picks added`
                      );
                      qc.invalidateQueries({ queryKey: ["admin-picks", selected] });
                    }}
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5" /> Finalize picks
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportCsv}
                    disabled={!picks || picks.length === 0}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                  </Button>
                </div>
              </div>

              {picksLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : picks && picks.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/30">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Main</th>
                        <th className="px-2 py-2">Bonus</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {picks.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-2 py-2 font-mono">{p.share_index}</td>
                          <td className="px-2 py-2 font-mono">{p.main_numbers.join(", ")}</td>
                          <td className="px-2 py-2 font-mono">{p.bonus_numbers.join(", ") || "—"}</td>
                          <td className="px-2 py-2">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                p.status === "included"
                                  ? "bg-primary/15 text-primary"
                                  : p.status === "quick_picked"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-accent/15 text-accent-foreground"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => updateStatus(p.id, "included")}
                                disabled={p.status === "included"}
                              >
                                <Check className="h-3 w-3" /> Inc
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() => updateStatus(p.id, "quick_picked")}
                                disabled={p.status === "quick_picked"}
                              >
                                <Shuffle className="h-3 w-3" /> QP
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No member picks submitted yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyndicatePicksManager;
