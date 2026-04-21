import { useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const drawSchema = z.object({
  lottery_id: z.string().uuid("Pick a lottery"),
  draw_date: z
    .string()
    .min(1, "Required")
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date"),
  jackpot_amount: z.coerce.number().min(0, "Must be ≥ 0"),
  currency: z
    .string()
    .trim()
    .length(3, "3-letter ISO code")
    .transform((s) => s.toUpperCase()),
});

const STATUSES = ["upcoming", "drawing", "completed"] as const;

/**
 * Card to create new lottery_draws rows from the admin Draws page.
 * Sits above the existing publish-results workflow so admins can
 * seed draws that the public Lotteries / Syndicates pages depend on.
 */
export const CreateDrawCard = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lotteryId, setLotteryId] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [jackpot, setJackpot] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("upcoming");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: lotteries } = useQuery({
    queryKey: ["admin-lotteries-for-draws"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("id, name, country, slug")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setLotteryId("");
    setDrawDate("");
    setJackpot("");
    setCurrency("USD");
    setStatus("upcoming");
    setErrors({});
  };

  const handleCreate = async () => {
    const parsed = drawSchema.safeParse({
      lottery_id: lotteryId,
      draw_date: drawDate,
      jackpot_amount: jackpot,
      currency,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path[0] as string] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { error } = await supabase.from("lottery_draws").insert({
        lottery_id: parsed.data.lottery_id,
        draw_date: new Date(parsed.data.draw_date).toISOString(),
        jackpot_amount: parsed.data.jackpot_amount,
        currency: parsed.data.currency,
        status,
      });
      if (error) throw error;
      toast.success("Draw created");
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
      qc.invalidateQueries({ queryKey: ["home-lotteries"] });
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-syndicate-draws"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create draw");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarPlus className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Create a draw</h2>
            <p className="text-xs text-muted-foreground">
              Schedule a new lottery draw. Required before creating syndicates.
            </p>
          </div>
        </div>
        <Button
          variant={open ? "outline" : "default"}
          size="sm"
          onClick={() => setOpen((p) => !p)}
        >
          {open ? "Cancel" : (
            <>
              <Plus className="mr-1.5 h-4 w-4" /> New draw
            </>
          )}
        </Button>
      </div>

      {open && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">Lottery</Label>
            <Select value={lotteryId} onValueChange={setLotteryId}>
              <SelectTrigger
                className={`mt-1 ${errors.lottery_id ? "border-destructive" : ""}`}
              >
                <SelectValue placeholder="Select a lottery" />
              </SelectTrigger>
              <SelectContent>
                {(lotteries ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                    {l.country ? ` · ${l.country}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.lottery_id && (
              <p className="mt-1 text-[11px] text-destructive">{errors.lottery_id}</p>
            )}
          </div>

          <div>
            <Label htmlFor="draw_date" className="text-xs">
              Draw date & time
            </Label>
            <Input
              id="draw_date"
              type="datetime-local"
              value={drawDate}
              onChange={(e) => setDrawDate(e.target.value)}
              className={`mt-1 ${errors.draw_date ? "border-destructive" : ""}`}
            />
            {errors.draw_date && (
              <p className="mt-1 text-[11px] text-destructive">{errors.draw_date}</p>
            )}
          </div>

          <div>
            <Label htmlFor="jackpot" className="text-xs">
              Estimated jackpot
            </Label>
            <Input
              id="jackpot"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={jackpot}
              onChange={(e) => setJackpot(e.target.value)}
              className={`mt-1 ${errors.jackpot_amount ? "border-destructive" : ""}`}
            />
            {errors.jackpot_amount && (
              <p className="mt-1 text-[11px] text-destructive">{errors.jackpot_amount}</p>
            )}
          </div>

          <div>
            <Label htmlFor="currency" className="text-xs">
              Currency
            </Label>
            <Input
              id="currency"
              maxLength={3}
              placeholder="USD"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className={`mt-1 uppercase ${errors.currency ? "border-destructive" : ""}`}
            />
            {errors.currency && (
              <p className="mt-1 text-[11px] text-destructive">{errors.currency}</p>
            )}
          </div>

          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as (typeof STATUSES)[number])}
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

          <div className="sm:col-span-2">
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create draw
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateDrawCard;
