import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Save, Palette, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { getColor, getLogo, type LotteryBranding } from "@/lib/lotteryAssets";
import { parseFormat, DEFAULT_FORMAT, type NumberFormat } from "@/lib/numberFormat";

type LotteryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  country: string | null;
  color: string | null;
  icon: string | null;
  draw_days: string | null;
  logo_url: string | null;
};

type Draft = {
  name: string;
  description: string;
  country: string;
  color: string;
  icon: string;
  draw_days: string;
  format: NumberFormat;
};

const LotteryBrandingManager = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<Draft>({
    name: "",
    description: "",
    country: "",
    color: "",
    icon: "",
    draw_days: "",
    format: DEFAULT_FORMAT,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: lotteries, isLoading } = useQuery({
    queryKey: ["admin-lotteries-branding"],
    queryFn: async (): Promise<LotteryRow[]> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("id, slug, name, description, country, color, icon, draw_days, logo_url")
        .order("name");
      if (error) throw error;
      return (data ?? []) as LotteryRow[];
    },
  });

  const selected = lotteries?.find((l) => l.id === selectedId);

  const handleSelect = (l: LotteryRow) => {
    setSelectedId(l.id);
    setDraft({
      name: l.name ?? "",
      description: l.description ?? "",
      country: l.country ?? "",
      color: l.color ?? "",
      icon: l.icon ?? "",
      draw_days: l.draw_days ?? "",
      format: parseFormat(undefined),
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!draft.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const f = draft.format;
    if (f.main.count < 1 || f.main.min < 0 || f.main.max < f.main.min || f.main.count > (f.main.max - f.main.min + 1)) {
      toast.error("Main numbers: count must fit within min/max range");
      return;
    }
    if (f.bonus.count > 0 && (f.bonus.min < 0 || f.bonus.max < f.bonus.min || f.bonus.count > (f.bonus.max - f.bonus.min + 1))) {
      toast.error("Bonus numbers: count must fit within min/max range");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lotteries")
        .update({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          country: draft.country.trim() || null,
          color: draft.color.trim() || null,
          icon: draft.icon.trim() || null,
          draw_days: draft.draw_days.trim() || null,
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Lottery updated");
      qc.invalidateQueries({ queryKey: ["admin-lotteries-branding"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!selected) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${selected.slug}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lottery-logos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("lottery-logos").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("lotteries")
        .update({ logo_url: pub.publicUrl })
        .eq("id", selected.id);
      if (updErr) throw updErr;
      toast.success("Logo uploaded");
      qc.invalidateQueries({ queryKey: ["admin-lotteries-branding"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const previewBranding: LotteryBranding | null = selected
    ? {
        slug: selected.slug,
        name: selected.name,
        color: draft.color || selected.color,
        icon: draft.icon || selected.icon,
        draw_days: draft.draw_days || selected.draw_days,
        logo_url: selected.logo_url,
      }
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-bold text-foreground">Lottery details & branding</h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* List */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pick a lottery
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : lotteries && lotteries.length > 0 ? (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {lotteries.map((l) => {
                const isSel = l.id === selectedId;
                const logo = getLogo(l);
                return (
                  <button
                    key={l.id}
                    onClick={() => handleSelect(l)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                      isSel
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/20 hover:border-primary/40"
                    }`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: getColor(l) }}
                    >
                      {logo ? (
                        <img src={logo} alt="" className="h-full w-full object-contain" />
                      ) : (
                        l.icon ?? l.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{l.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{l.slug}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No lotteries found.</p>
          )}
        </div>

        {/* Editor */}
        <div>
          {!selected ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
              <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a lottery to edit branding</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 p-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: getColor(previewBranding) }}
                >
                  {getLogo(previewBranding) ? (
                    <img
                      src={getLogo(previewBranding)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    draft.icon || (draft.name || selected.name).slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {draft.name || selected.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[draft.country, draft.draw_days].filter(Boolean).join(" · ") || "No country / draw days"}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <Label htmlFor="name" className="text-xs">Name</Label>
                <Input
                  id="name"
                  placeholder="Powerball"
                  value={draft.name}
                  maxLength={100}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-xs">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Short description shown on the lottery detail page"
                  value={draft.description}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Country */}
              <div>
                <Label htmlFor="country" className="text-xs">Country</Label>
                <Input
                  id="country"
                  placeholder="USA"
                  value={draft.country}
                  maxLength={60}
                  onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Color */}
              <div>
                <Label htmlFor="color" className="text-xs">
                  Brand color (hex)
                </Label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#3498db"}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                    aria-label="Pick color"
                  />
                  <Input
                    id="color"
                    placeholder="#3498db"
                    value={draft.color}
                    onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                  />
                </div>
              </div>

              {/* Icon */}
              <div>
                <Label htmlFor="icon" className="text-xs">
                  Short icon label (1–3 chars)
                </Label>
                <Input
                  id="icon"
                  maxLength={3}
                  placeholder="PB"
                  value={draft.icon}
                  onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Draw days */}
              <div>
                <Label htmlFor="draw_days" className="text-xs">
                  Draw days
                </Label>
                <Input
                  id="draw_days"
                  placeholder="Wed & Sat"
                  value={draft.draw_days}
                  onChange={(e) => setDraft((d) => ({ ...d, draw_days: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Number format */}
              <div className="rounded-xl border border-border bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Number format (Lucky Picks)</Label>
                  <span className="text-[10px] text-muted-foreground">
                    e.g. Powerball = main 5 / 1–69, bonus 1 / 1–26
                  </span>
                </div>

                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Main numbers
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="main-count" className="text-[11px] text-muted-foreground">Count</Label>
                    <Input
                      id="main-count"
                      type="number"
                      min={1}
                      max={20}
                      value={draft.format.main.count}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, main: { ...d.format.main, count: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="main-min" className="text-[11px] text-muted-foreground">Min</Label>
                    <Input
                      id="main-min"
                      type="number"
                      min={0}
                      value={draft.format.main.min}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, main: { ...d.format.main, min: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="main-max" className="text-[11px] text-muted-foreground">Max</Label>
                    <Input
                      id="main-max"
                      type="number"
                      min={1}
                      value={draft.format.main.max}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, main: { ...d.format.main, max: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="mb-2 mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Bonus numbers <span className="normal-case text-muted-foreground/70">(set count to 0 if none)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="bonus-count" className="text-[11px] text-muted-foreground">Count</Label>
                    <Input
                      id="bonus-count"
                      type="number"
                      min={0}
                      max={10}
                      value={draft.format.bonus.count}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, bonus: { ...d.format.bonus, count: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bonus-min" className="text-[11px] text-muted-foreground">Min</Label>
                    <Input
                      id="bonus-min"
                      type="number"
                      min={0}
                      value={draft.format.bonus.min}
                      disabled={draft.format.bonus.count === 0}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, bonus: { ...d.format.bonus, min: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bonus-max" className="text-[11px] text-muted-foreground">Max</Label>
                    <Input
                      id="bonus-max"
                      type="number"
                      min={0}
                      value={draft.format.bonus.max}
                      disabled={draft.format.bonus.count === 0}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          format: { ...d.format, bonus: { ...d.format.bonus, max: Number(e.target.value) || 0 } },
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-muted-foreground">
                  Affects the number grid members see when picking their own numbers and the server-side validator.
                </p>
              </div>

              <div>
                <Label className="text-xs">Logo image (PNG/SVG, &lt;2MB)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-2 text-xs text-muted-foreground hover:border-primary/50">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Choose file & upload"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {selected.logo_url && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    Current: {selected.logo_url}
                  </p>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary font-semibold text-primary-foreground"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LotteryBrandingManager;
