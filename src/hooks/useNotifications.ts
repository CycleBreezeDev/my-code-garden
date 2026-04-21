import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AppNotification {
  id: string;
  kind: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  body: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnread(0);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as unknown as AppNotification[];
    setNotifications(list);
    setUnread(list.filter((n) => !n.read_at).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const ch = supabase
      .channel(`notifs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, fetchAll]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .eq("user_id", user.id);
    fetchAll();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  return { notifications, unread, loading, markAllRead, markRead, refetch: fetchAll };
};
