import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ChatMessage {
  id: string;
  syndicate_id: string;
  user_id: string;
  body: string | null;
  image_path: string | null;
  kind: "text" | "image" | "system";
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
  author?: { username?: string | null; full_name?: string | null; avatar_url?: string | null };
  reactions?: { emoji: string; count: number; mine: boolean }[];
}

export const useSyndicateChat = (syndicateId: string | undefined) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const enrich = useCallback(
    async (raw: ChatMessage[]) => {
      if (!raw.length) return raw;
      const ids = raw.map((m) => m.user_id);
      const [{ data: profiles }, { data: usernames }, { data: reactions }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids),
        supabase.from("user_profiles_public").select("user_id, username").in("user_id", ids),
        supabase.from("message_reactions").select("message_id, emoji, user_id").in("message_id", raw.map((m) => m.id)),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const uMap = new Map((usernames ?? []).map((p: any) => [p.user_id, p.username]));
      const rMap = new Map<string, Map<string, { count: number; mine: boolean }>>();
      (reactions ?? []).forEach((r: any) => {
        if (!rMap.has(r.message_id)) rMap.set(r.message_id, new Map());
        const m = rMap.get(r.message_id)!;
        const cur = m.get(r.emoji) ?? { count: 0, mine: false };
        cur.count += 1;
        if (r.user_id === user?.id) cur.mine = true;
        m.set(r.emoji, cur);
      });
      return raw.map((m) => ({
        ...m,
        author: { ...(pMap.get(m.user_id) as any), username: uMap.get(m.user_id) as string | undefined },
        reactions: Array.from(rMap.get(m.id)?.entries() ?? []).map(([emoji, v]) => ({ emoji, ...v })),
      }));
    },
    [user],
  );

  const fetchAll = useCallback(async () => {
    if (!syndicateId) return;
    const { data, error } = await supabase
      .from("syndicate_messages")
      .select("*")
      .eq("syndicate_id", syndicateId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      setHasAccess(false);
      setLoading(false);
      return;
    }
    setHasAccess(true);
    const enriched = await enrich((data ?? []) as ChatMessage[]);
    setMessages(enriched);
    setLoading(false);
  }, [syndicateId, enrich]);

  useEffect(() => {
    fetchAll();
    if (!syndicateId) return;
    const ch = supabase
      .channel(`syn-chat:${syndicateId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "syndicate_messages", filter: `syndicate_id=eq.${syndicateId}` },
        () => fetchAll(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => fetchAll())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [syndicateId, fetchAll]);

  const send = async (body: string, replyToId?: string) => {
    if (!user || !syndicateId || !body.trim()) return;
    const { error } = await supabase.from("syndicate_messages").insert({
      syndicate_id: syndicateId,
      user_id: user.id,
      body: body.trim(),
      kind: "text",
      reply_to_id: replyToId ?? null,
    });
    if (error) throw error;
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find((m) => m.id === messageId)?.reactions?.find((r) => r.emoji === emoji);
    if (existing?.mine) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  return { messages, loading, hasAccess, send, react };
};
