import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useDMUnread = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    const { data } = await supabase.rpc("dm_unread_total");
    setCount((data as number) ?? 0);
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel(`dm-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_thread_reads", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  return { count, refresh };
};
