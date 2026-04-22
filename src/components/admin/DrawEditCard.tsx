import { useEffect, useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Pencil } from "lucide-react";
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

const STATUSES = ["upcoming", "drawing", "completed"] as const;
type Status = (typeof STATUSES)[number];

type Draw = {
  id: string;
  draw_date: string;
  status: string;
  jackpot_amount: number;
  currency: string;
  lottery: { name: string };
  syndicates: { id: string; name: string }[] | null;
  draw_results: { id: string }[] | null;
};

const drawSchema = z.object({
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

/** Convert a UTC ISO timestamp to the value format expected by datetime-local */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface DrawEditCardProps {
  draw: Draw;
  onClose: () => void;
}

/**
 * Inline editor for an existing draw row. Lets admins fix the most
 * common data mistakes (wrong jackpot, wrong currency, wrong date,
 * wrong status) and delete a draw outright. Deleting cascades to
 * related syndicates via the FK, so we surface a clear warning.
 */
export const DrawEditCard = ({ draw, onClose }: DrawEditCardProps) => {
  const qc = useQueryClient();
  const [drawDate, setDrawDate] = useState(toLocalInput(draw.draw_date));
  const [jackpot, setJackpot] = useState(String(draw.jackpot_amount));
  const [currency, setCurrency] = useState(draw.currency);
  const [status, setStatus] = useState<Status>(
    (STATUSES as readonly string[]).includes(draw.status) ? (draw.status as Status) : "upcoming",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset state when admin switches between draws
  useEffect(() => {
    setDrawDate(toLocalInput(draw.draw_date));
    setJackpot(String(draw.jackpot_amount));
    setCurrency(draw.currency);
    setStatus((STATUSES as readonly string[]).includes(draw.status) ? (draw.status as Status) : "upcoming");
    setErrors({});
  }, [draw.id, draw.draw_date, draw.jackpot_amount, draw.currency, draw.status]);

  const linkedSyndicates = draw.syndicates?.length ?? 0;
  const isPublished = (draw.draw_results?.length ?? 0) > 0;

  const handleSave = async () => {
    const parsed = drawSchema.safeParse({
      draw_date: drawDate,
      jackpot_amount: jackpot,
      currency,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as string] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lottery_draws")
        .update({
          draw_date: new Date(parsed.data.draw_date).toISOString(),
          jackpot_amount: parsed.data.jackpot_amount,
          currency: parsed.data.currency,
          status,
        })
        .eq("id", draw.id);
      if (error) throw error;
      toast.success("Draw updated");
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
      qc.invalidateQueries({ queryKey: ["home-lotteries"] });
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-syndicate-draws"] });
      qc.invalidateQueries({ queryKey: ["lottery-detail"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update draw");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("lottery_draws").delete().eq("id", draw.id);
      if (error) throw error;
      toast.success("Draw deleted");
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ["admin-draws"] });
      qc.invalidateQueries({ queryKey: ["home-lotteries"] });
      qc.invalidateQueries({ queryKey: ["syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-syndicates"] });
      qc.invalidateQueries({ queryKey: ["admin-syndicate-draws"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete draw");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Pencil className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Edit draw</h2>
            <p className="text-xs text-muted-foreground">{draw.lottery?.name ?? "Lottery"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {isPublished && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground">
          Results have been published for this draw. Edits to date/jackpot won't change payouts that
          already happened.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="edit_draw_date" className="text-xs">
            Draw date & time
          </Label>
          <Input
            id="edit_draw_date"
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
          <Label htmlFor="edit_jackpot" className="text-xs">
            Estimated jackpot
          </Label>
          <Input
            id="edit_jackpot"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={jackpot}
            onChange={(e) => setJackpot(e.target.value)}
            className={`mt-1 ${errors.jackpot_amount ? "border-destructive" : ""}`}
          />
          {errors.jackpot_amount && (
            <p className="mt-1 text-[11px] text-destructive">{errors.jackpot_amount}</p>
          )}
        </div>

        <div>
          <Label htmlFor="edit_currency" className="text-xs">
            Currency
          </Label>
          <Input
            id="edit_currency"
            maxLength={3}
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
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
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

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          disabled={saving || deleting}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete draw
        </Button>
        <Button onClick={handleSave} disabled={saving || deleting}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" /> Save changes
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draw?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the {draw.lottery?.name ?? "lottery"} draw scheduled for{" "}
              {new Date(draw.draw_date).toLocaleString()}.
              {linkedSyndicates > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  ⚠ {linkedSyndicates} linked group ticket{linkedSyndicates === 1 ? "" : "s"} will
                  also be removed.
                </span>
              )}
              {isPublished && (
                <span className="mt-2 block font-semibold text-destructive">
                  ⚠ Published results for this draw will also be removed. Already-credited wallet
                  payouts are NOT reversed.
                </span>
              )}
              <span className="mt-2 block">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
                </>
              ) : (
                "Delete draw"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DrawEditCard;
