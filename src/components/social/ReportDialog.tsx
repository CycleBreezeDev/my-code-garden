import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ReportDialog = ({
  open, onOpenChange, targetType, targetId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetType: "message" | "profile" | "feed_post" | "feed_comment";
  targetId: string;
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user || !reason.trim() || !targetId) return;
    setSubmitting(true);
    const { error } = await supabase.from("social_reports").insert({
      reporter_id: user.id, target_type: targetType, target_id: targetId, reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Report submitted. Thank you.");
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {targetType.replace("_", " ")}</DialogTitle>
        </DialogHeader>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you reporting this? (max 500 chars)" maxLength={500} rows={4} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!reason.trim() || submitting}>Submit report</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
