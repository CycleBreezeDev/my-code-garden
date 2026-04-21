import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DMThreadSummary {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
}

export const useDMThreads = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<DMThreadSummary[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setThreads([]);
      setUnreadTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setError(null);
      const { data: ts, error: threadsError } = await supabase
        .from("dm_threads")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (threadsError) throw threadsError;
      const list = ts ?? [];
      if (!list.length) {
        setThreads([]);
        setUnreadTotal(0);
        setLoading(false);
        return;
      }
      const otherIds = list.map((t: any) => (t.user_a === user.id ? t.user_b : t.user_a));
      const ids = list.map((t: any) => t.id);
      const [{ data: profs }, { data: usn }, { data: reads }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", otherIds),
        supabase.from("user_profiles_public").select("user_id, username").in("user_id", otherIds),
        supabase.from("dm_thread_reads").select("thread_id, last_read_at").eq("user_id", user.id).in("thread_id", ids),
      ]);
      const pm = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const um = new Map((usn ?? []).map((p: any) => [p.user_id, p.username]));
      const rm = new Map((reads ?? []).map((r: any) => [r.thread_id, r.last_read_at]));

      // Unread per thread
      const unreadCounts = new Map<string, number>();
      await Promise.all(
        list.map(async (t: any) => {
          const lastRead = rm.get(t.id) ?? "1970-01-01T00:00:00Z";
          const { count } = await supabase
            .from("dm_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", t.id)
            .neq("sender_id", user.id)
            .gt("created_at", lastRead);
          unreadCounts.set(t.id, count ?? 0);
        }),
      );

      const summaries: DMThreadSummary[] = list.map((t: any) => {
        const other = t.user_a === user.id ? t.user_b : t.user_a;
        const p: any = pm.get(other);
        return {
          id: t.id,
          other_user_id: other,
          other_username: (um.get(other) as string) ?? null,
          other_full_name: p?.full_name ?? null,
          other_avatar_url: p?.avatar_url ?? null,
          last_message_at: t.last_message_at,
          last_message_preview: t.last_message_preview,
          unread_count: unreadCounts.get(t.id) ?? 0,
        };
      });
      setThreads(summaries);
      setUnreadTotal(summaries.reduce((s, x) => s + x.unread_count, 0));
    } catch (err) {
      console.error("[useDMThreads] fetch failed", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
    if (!user) return;
    const ch = supabase
      .channel(`dm-threads:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_messages" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_threads" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_thread_reads", filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, fetchAll]);

  const openWith = async (otherUserId: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc("get_or_create_dm_thread", { _other: otherUserId });
    if (error) {
      throw error;
    }
    return data as string;
  };

  return { threads, unreadTotal, loading, error, openWith, refresh: fetchAll };
};
