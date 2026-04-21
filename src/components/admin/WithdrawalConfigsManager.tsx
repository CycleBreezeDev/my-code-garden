import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Save, Trash2, Settings2 } from "lucide-react";
import { toast } from "sonner";

type Cfg = {
  id: string;
  currency: string;
  destination_type: string;
  enabled: boolean;
  min_amount: number;
  max_amount: number | null;
  daily_limit: number | null;
  fee_flat: number;
  fee_percent: number;
  eta_label: string | null;
};

const DEST_TYPES = [
  "ng_bank", "gh_bank", "ke_bank", "za_bank", "intl_bank",
  "paypal", "paystack_account", "flutterwave_account",
];

const emptyDraft = (): Omit<Cfg, "id"> => ({
  currency: "USD",
  destination_type: "ng_bank",
  enabled: true,
  min_amount: 0,
  max_amount: null,
  daily_limit: null,
  fee_flat: 0,
  fee_percent: 0,
  eta_label: "",
});

export const WithdrawalConfigsManager = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, Partial<Cfg>>>({});
  const [draft, setDraft] = useState<Omit<Cfg, "id"> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["admin-withdrawal-configs"],
    queryFn: async (): Promise<Cfg[]> => {
      const { data, error } = await supabase
        .from("withdrawal_configs")
        .select("*")
        .order("currency")
        .order("destination_type");
      if (error) throw error;
      return (data ?? []) as Cfg[];
    },
  });

  const setField = (id: string, patch: Partial<Cfg>) =>
    setEditing((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const merged = (c: Cfg): Cfg => ({ ...c, ...editing[c.id] });

  const saveRow = async (c: Cfg) => {
    const m = merged(c);
    setSaving(c.id);
    try {
      const { error } = await supabase
        .from("withdrawal_configs")
        .update({
          currency: m.currency.toUpperCase().trim(),
          destination_type: m.destination_type.trim(),
          enabled: m.enabled,
          min_amount: Number(m.min_amount) || 0,
          max_amount: m.max_amount === null || (m.max_amount as unknown as string) === "" ? null : Number(m.max_amount),
          daily_limit: m.daily_limit === null || (m.daily_limit as unknown as string) === "" ? null : Number(m.daily_limit),
          fee_flat: Number(m.fee_flat) || 0,
          fee_percent: Number(m.fee_percent) || 0,
          eta_label: m.eta_label || null,
        })
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Saved");
      setEditing((e) => {
        const { [c.id]: _, ...rest } = e;
        return rest;
      });
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-configs"] });
      qc.invalidateQueries({ queryKey: ["withdrawal-configs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const deleteRow = async (c: Cfg) => {
    if (!confirm(`Delete ${c.currency} / ${c.destination_type}?`)) return;
    setSaving(c.id);
    try {
      const { error } = await supabase.from("withdrawal_configs").delete().eq("id", c.id);
      if (error) throw error;
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-configs"] });
      qc.invalidateQueries({ queryKey: ["withdrawal-configs"] });
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
      const { error } = await supabase.from("withdrawal_configs").insert({
        currency: draft.currency.toUpperCase().trim(),
        destination_type: draft.destination_type.trim(),
        enabled: draft.enabled,
        min_amount: Number(draft.min_amount) || 0,
        max_amount: draft.max_amount === null || (draft.max_amount as unknown as string) === "" ? null : Number(draft.max_amount),
        daily_limit: draft.daily_limit === null || (draft.daily_limit as unknown as string) === "" ? null : Number(draft.daily_limit),
        fee_flat: Number(draft.fee_flat) || 0,
        fee_percent: Number(draft.fee_percent) || 0,
        eta_label: draft.eta_label || null,
      });
      if (error) throw error;
      toast.success("Created");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["admin-withdrawal-configs"] });
      qc.invalidateQueries({ queryKey: ["withdrawal-configs"] });
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
          <Settings2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Withdrawal configs</h2>
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
          <ConfigForm
            value={draft as Cfg}
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
      ) : configs && configs.length > 0 ? (
        <div className="space-y-3">
          {configs.map((c) => {
            const m = merged(c);
            const dirty = !!editing[c.id];
            return (
              <div
                key={c.id}
                className={`rounded-xl border p-3 ${
                  dirty ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-foreground">
                    {m.currency} · {m.destination_type}
                  </div>
                  <div className="flex items-center gap-1">
                    {dirty && (
                      <Button
                        size="sm"
                        onClick={() => saveRow(c)}
                        disabled={saving === c.id}
                        className="h-7 gap-1 px-2"
                      >
                        {saving === c.id ? (
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
                      onClick={() => deleteRow(c)}
                      disabled={saving === c.id}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <ConfigForm value={m} onChange={(p) => setField(c.id, p)} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No configs yet.</p>
      )}
    </div>
  );
};

const ConfigForm = ({
  value,
  onChange,
}: {
  value: Cfg;
  onChange: (p: Partial<Cfg>) => void;
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Currency">
        <Input
          value={value.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
          className="h-8"
        />
      </Field>
      <Field label="Destination type">
        <select
          value={value.destination_type}
          onChange={(e) => onChange({ destination_type: e.target.value })}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        >
          {DEST_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Min amount">
        <Input
          type="number"
          step="0.01"
          value={value.min_amount ?? ""}
          onChange={(e) => onChange({ min_amount: Number(e.target.value) })}
          className="h-8"
        />
      </Field>
      <Field label="Max amount (blank = none)">
        <Input
          type="number"
          step="0.01"
          value={value.max_amount ?? ""}
          onChange={(e) =>
            onChange({ max_amount: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="h-8"
        />
      </Field>
      <Field label="Daily limit (blank = none)">
        <Input
          type="number"
          step="0.01"
          value={value.daily_limit ?? ""}
          onChange={(e) =>
            onChange({ daily_limit: e.target.value === "" ? null : Number(e.target.value) })
          }
          className="h-8"
        />
      </Field>
      <Field label="Fee flat">
        <Input
          type="number"
          step="0.01"
          value={value.fee_flat ?? ""}
          onChange={(e) => onChange({ fee_flat: Number(e.target.value) })}
          className="h-8"
        />
      </Field>
      <Field label="Fee percent">
        <Input
          type="number"
          step="0.01"
          value={value.fee_percent ?? ""}
          onChange={(e) => onChange({ fee_percent: Number(e.target.value) })}
          className="h-8"
        />
      </Field>
      <Field label="ETA label">
        <Input
          value={value.eta_label ?? ""}
          onChange={(e) => onChange({ eta_label: e.target.value })}
          placeholder="e.g. Within 24h"
          className="h-8"
        />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 sm:col-span-2">
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
