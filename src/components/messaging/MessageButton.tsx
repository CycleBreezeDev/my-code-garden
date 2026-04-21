import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDMThreads } from "@/hooks/useDMThreads";
import { toast } from "sonner";

export const MessageButton = ({ userId, size = "sm" }: { userId: string; size?: "sm" | "default" }) => {
  const { user } = useAuth();
  const { openWith } = useDMThreads();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!user || user.id === userId) return null;

  const onClick = async () => {
    setLoading(true);
    try {
      const id = await openWith(userId);
      if (id) navigate(`/messages?t=${id}`);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("not_eligible")) {
        toast.error("You can only message people who follow you back.");
      } else {
        toast.error(msg || "Could not start conversation");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={onClick} disabled={loading} variant="outline" size={size} className="gap-1.5">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
      Message
    </Button>
  );
};
