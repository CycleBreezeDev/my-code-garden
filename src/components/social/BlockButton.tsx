import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldOff, Shield } from "lucide-react";

export const BlockButton = ({ userId }: { userId: string }) => {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || user.id === userId) return;
    supabase.from("user_blocks").select("blocker_id").eq("blocker_id", user.id).eq("blocked_id", userId).maybeSingle()
      .then(({ data }) => setBlocked(!!data));
  }, [user, userId]);

  if (!user || user.id === userId) return null;

  const toggle = async () => {
    setLoading(true);
    if (blocked) {
      await supabase.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", userId);
      setBlocked(false);
      toast.success("User unblocked");
    } else {
      const { error } = await supabase.from("user_blocks").insert({ blocker_id: user.id, blocked_id: userId });
      if (error) toast.error(error.message);
      else { setBlocked(true); toast.success("User blocked"); }
    }
    setLoading(false);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggle} disabled={loading} className="gap-1.5">
      {blocked ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
      {blocked ? "Unblock" : "Block"}
    </Button>
  );
};
