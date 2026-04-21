import { useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Users, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SyndicateRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  total_shares: number;
  sold_shares: number;
  price_per_share: number;
  currency: string;
  status: string;
  draw: {
    id: string;
    draw_date: string;
    lottery: { name: string };
  };
};

type DrawOption = {
  id: string;
  draw_date: string;
  currency: string;
  lottery: { name: string };
};

const STATUSES = ["open", "full", "drawing", "completed", "cancelled"] as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

const syndicateSchema = z.object({
  draw_id: z.string().uuid("Pick a draw"),
  name: z.string().trim().min(2, "Name too short").max(80, "Name too long"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug too short")
    .max(60, "Slug too long")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and dashes only"),
  description: z.string().trim().max(500, "Too long").optional().or(z.literal("")),
  total_shares: z.coerce.number().int().min(1, "≥ 1").max(1000, "≤ 1000"),
  price_per_share: z.coerce.number().min(0.01, "> 0"),
  currency: z
    .string()
    .trim()
    .length(3, "3-letter ISO code")
    .transform((s) => s.toUpperCase()),
});

type FormState = {
  draw_id: string;
  name: string;
  slug: string;
  description: string;
  total_shares: string;
  price_per_share: string;
  currency: string;
  status: (typeof STATUSES)[number];
};

const emptyForm: FormState = {
  draw_id: "",
  name: "",
  slug: "",
  description: "",
  total_shares: "100",
  price_per_share: "5",
  currency: "USD",
  status: "open",
};

export const SyndicatesManager = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<SyndicateRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: syndicates, isLoading } = useQuery({
    queryKey: ["admin-syndicates"],
    queryFn: async (): Promise<SyndicateRow[]> => {
      const { data, error } = await supabase
        .from("syndicates")
        .select(
          "id, name, slug, description, total_shares, sold_shares, price_per_share, currency, status, draw:lottery_draws!inner(id, draw_date, lottery:lotteries!inner(name))",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as SyndicateRow[]) ?? [];
    },
  });

  const { data: draws } = useQuery({
    queryKey: ["admin-syndicate-draws"],
    queryFn: async (): Promise<DrawOption[]> => {
      const { data, error } = await supabase
        .from("lottery_draws")
        .select("id, draw_date, currency, lottery:lotteries!inner(name)")
        .order("draw_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as unknown as DrawOption[]) ?? [];
    },
  });

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
  };

  const startEdit = (row: SyndicateRow) => {
    setEditing(row);
    setForm({
      draw_id: row.draw.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      total_shares: String(row.total_shares),
      price_per_share: String(row.price_per_share),
      currency: row.currency,
      status: (STATUSES.includes(row.status as never)
        ? row.status
        : "open") as (typeof STATUSES)[number],
    });
    setErrors({});
  };

  const onNameChange = (name: string) => {
    setForm((p) => ({
      ...p,
      name,
      // Only auto-fill slug if creating and slug looks untouched
      slug: !editing && (p.slug === "" || p.slug === slugify(p.name)) ? slugify(name) : p.slug,
    }));
  };

  const onDrawChange = (id: string) => {
    const draw = draws?.find((d) => d.id === id);
    setForm((p) => ({
      ...p,
      draw_id: id,
      currency: draw?.currency ?? p.currency,
    }));
  };

  const handleSave = async () => {
    const parsed = syndicateSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as string] = issue.message;
      }
      setErrors(next);
      return;
    }
    if (editing && parsed.data.total_shares < editing.sold_shares) {
      setErrors({
        total_shares: `Cannot drop below ${editing.sold_shares} (already sold)`,
      });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        draw_id: parsed.data.draw_id,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        total_shares: parsed.data.total_shares,
        price_per_share: parsed.data.price_per_share,
        currency: parsed.data.currency,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase
          .from("syndicates")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Syndicate updated");
      } else {
        const { error } = await supabase.from("syndicates").insert(payload);
        if (error) throw error;
        toast.success("Syndicate created");
      }
      startNew();
      qc.invalidateQueries({ queryKey: ["admin-syndicates"] });
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      if (msg.toLowerCase().includes("duplicate") && msg.toLowerCase().includes("slug")) {
        setErrors({ slug: "Slug already in use" });
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("syndicates").delete().eq("id", deletingId);
      if (error) throw error;
      toast.success("Syndicate deleted");
      if (editing?.id === deletingId) startNew();
      qc.invalidateQueries({ queryKey: ["admin-syndicates"] });
      qc.invalidateQueries({ queryKey: ["syndicates"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
      setDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* List */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Existing syndicates</h2>
            <Button onClick={startNew} size="sm" variant="outline">
              <Plus className="mr-1.5 h-4 w-4" /> New
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : syndicates && syndicates.length > 0 ? (
            <div className="space-y-2">
              {syndicates.map((s) => {
                const isEditing = editing?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isEditing
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => startEdit(s)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {s.name}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              s.status === "open"
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {s.draw.lottery.name} ·{" "}
                          {new Date(s.draw.draw_date).toLocaleDateString()}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {s.sold_shares}/{s.total_shares} shares ·{" "}
                          {formatMoney(s.price_per_share, s.currency)}/share
                        </div>
                      </button>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(s)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => confirmDelete(s.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No syndicates yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create one on the right to populate the Group Ticket page.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            {editing ? "Edit syndicate" : "New syndicate"}
          </h2>

          {(!draws || draws.length === 0) && !editing ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
              No draws found. Create a draw first under <strong>Draw Results</strong>.
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Draw</Label>
                <Select value={form.draw_id} onValueChange={onDrawChange}>
                  <SelectTrigger
                    className={`mt-1 ${errors.draw_id ? "border-destructive" : ""}`}
                  >
                    <SelectValue placeholder="Select a draw" />
                  </SelectTrigger>
                  <SelectContent>
                    {(draws ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.lottery.name} ·{" "}
                        {new Date(d.draw_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.draw_id && (
                  <p className="mt-1 text-[11px] text-destructive">{errors.draw_id}</p>
                )}
              </div>

              <div>
                <Label htmlFor="syn-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="syn-name"
                  placeholder="e.g. Friday Night Powerball Pool"
                  value={form.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  className={`mt-1 ${errors.name ? "border-destructive" : ""}`}
                />
                {errors.name && (
                  <p className="mt-1 text-[11px] text-destructive">{errors.name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="syn-slug" className="text-xs">
                  Slug
                </Label>
                <Input
                  id="syn-slug"
                  placeholder="friday-night-powerball"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slug: slugify(e.target.value) }))
                  }
                  className={`mt-1 ${errors.slug ? "border-destructive" : ""}`}
                />
                {errors.slug && (
                  <p className="mt-1 text-[11px] text-destructive">{errors.slug}</p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Public URL: /group/{form.slug || "..."}
                </p>
              </div>

              <div>
                <Label htmlFor="syn-desc" className="text-xs">
                  Description (optional)
                </Label>
                <Textarea
                  id="syn-desc"
                  rows={2}
                  placeholder="Short pitch shown on the group page"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="syn-shares" className="text-xs">
                    Total shares
                  </Label>
                  <Input
                    id="syn-shares"
                    type="number"
                    min={1}
                    value={form.total_shares}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, total_shares: e.target.value }))
                    }
                    className={`mt-1 ${errors.total_shares ? "border-destructive" : ""}`}
                  />
                  {errors.total_shares && (
                    <p className="mt-1 text-[11px] text-destructive">
                      {errors.total_shares}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="syn-price" className="text-xs">
                    Price / share
                  </Label>
                  <Input
                    id="syn-price"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={form.price_per_share}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, price_per_share: e.target.value }))
                    }
                    className={`mt-1 ${errors.price_per_share ? "border-destructive" : ""}`}
                  />
                  {errors.price_per_share && (
                    <p className="mt-1 text-[11px] text-destructive">
                      {errors.price_per_share}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="syn-cur" className="text-xs">
                    Currency
                  </Label>
                  <Input
                    id="syn-cur"
                    maxLength={3}
                    value={form.currency}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                    }
                    className={`mt-1 uppercase ${errors.currency ? "border-destructive" : ""}`}
                  />
                  {errors.currency && (
                    <p className="mt-1 text-[11px] text-destructive">
                      {errors.currency}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        status: v as (typeof STATUSES)[number],
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {editing && (
                  <Button variant="outline" onClick={startNew} disabled={saving}>
                    Cancel
                  </Button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary text-primary-foreground"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : editing ? (
                    "Save changes"
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" /> Create syndicate
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!saving) setDeleteOpen(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this syndicate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the syndicate. Memberships and ticket images linked to
              it will also be removed. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SyndicatesManager;
