import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Save, Trash2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";

type Pair = {
  id: string;
  base_currency: string;
  quote_currency: string;
  markup_percent: number;
  enabled: boolean;
};

const emptyDraft = (): Omit<Pair, "id"> => ({
  base_currency: "USD",
  quote_currency: "EUR",
  markup_percent: 1.5,
  enabled: true,
});

export const FxPairsManager = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Partial<Pair>>>({});
  const [draft, setDraft] = useState<Omit<Pair, "id"> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: pairs, isLoading } = useQuery({
    queryKey: ["admin-fx-pairs"],
    queryFn: async (): Promise<Pair[]> => {
      const { data, error } = await supabase
        .from("fx_pairs")
        .select("*")
        .order("base_currency")
        .order("quote_currency");
      if (error) throw error;
      return (data ?? []) as Pair[];
    },
  });

  const setField = (id: string, patch: Partial<Pair>) =>
    setEditing((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const merged = (p: Pair): Pair => ({ ...p, ...editing[p.id] });

  const saveRow = async (p: Pair) => {
    const m = merged(p);
    setSaving(p.id);
    try {
      const { error } = await supabase
        .from("fx_pairs")
        .update({
          base_currency: m.base_currency.toUpperCase().trim(),
          quote_currency: m.quote_currency.toUpperCase().trim(),
          markup_percent: Number(m.markup_percent) || 0,
          enabled: m.enabled,
        })
        .eq("id", p.id);
      if (error) throw error;
      toast.success("Saved");
      setEditing((e) => {
        const { [p.id]: _, ...rest } = e;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["admin-fx-pairs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const deleteRow = async (p: Pair) => {
    if (!confirm(`Delete ${p.base_currency} → ${p.quote_currency}?`)) return;
    setSaving(p.id);
    try {
      const { error } = await supabase.from("fx_pairs").delete().eq("id", p.id);
      if (error) throw error;
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-fx-pairs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(null);
    }
  };

  const createDraft = async () => {
    if (!draft) return;
    setSaving("__new");
    try {
      const { error } = await supabase.from("fx_pairs").insert({
        base_currency: draft.base_currency.toUpperCase().trim(),
        quote_currency: draft.quote_currency.toUpperCase().trim(),
        markup_percent: Number(draft.markup_percent) || 0,
        enabled: draft.enabled,
      });
      if (error) throw error;
      toast.success("Created");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["admin-fx-pairs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">FX pairs</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDraft(draft ? null : emptyDraft())}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          {draft ? "Cancel" : "Add"}
        </Button>
      </div>

      {draft && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <PairForm
            value={draft as Pair}
            onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))}
          />
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={createDraft} disabled={saving === "__new"}>
              {saving === "__new" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : pairs && pairs.length > 0 ? (
        <div className="space-y-3">
          {pairs.map((p) => {
            const m = merged(p);
            const dirty = !!editing[p.id];
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 ${
                  dirty ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-foreground">
                    {m.base_currency} → {m.quote_currency} · {Number(m.markup_percent).toFixed(2)}%
                  </div>
                  <div className="flex items-center gap-1">
                    {dirty && (
                      <Button
                        size="sm"
                        onClick={() => saveRow(p)}
                        disabled={saving === p.id}
                        className="h-7 gap-1 px-2"
                      >
                        {saving === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                        Save
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRow(p)}
                      disabled={saving === p.id}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <PairForm value={m} onChange={(patch) => setField(p.id, patch)} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No FX pairs yet.</p>
      )}
    </div>
  );
};

const PairForm = ({
  value,
  onChange,
}: {
  value: Pair;
  onChange: (p: Partial<Pair>) => void;
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Base currency">
        <Input
          value={value.base_currency}
          onChange={(e) => onChange({ base_currency: e.target.value })}
          maxLength={6}
          className="h-8 uppercase"
        />
      </Field>
      <Field label="Quote currency">
        <Input
          value={value.quote_currency}
          onChange={(e) => onChange({ quote_currency: e.target.value })}
          maxLength={6}
          className="h-8 uppercase"
        />
      </Field>
      <Field label="Markup percent">
        <Input
          type="number"
          step="0.01"
          value={value.markup_percent ?? ""}
          onChange={(e) => onChange({ markup_percent: Number(e.target.value) })}
          className="h-8"
        />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5">
        <Label className="text-xs">Enabled</Label>
        <Switch
          checked={value.enabled}
          onCheckedChange={(v) => onChange({ enabled: v })}
        />
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
    <div className="mt-1">{children}</div>
  </div>
);
