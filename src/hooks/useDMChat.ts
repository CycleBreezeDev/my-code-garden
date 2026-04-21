import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DMMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  kind: "text" | "image" | "system";
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reactions?: { emoji: string; count: number; mine: boolean }[];
  image_url?: string | null;
}

export interface DMThreadDetail {
  id: string;
  other_user_id: string;
  other_username: string | null;
  other_full_name: string | null;
  other_avatar_url: string | null;
  other_last_read_at: string | null;
}

const TYPING_TTL_MS = 4000;

export const useDMChat = (threadId: string | undefined) => {
  const { user } = useAuth();
  const [thread, setThread] = useState<DMThreadDetail | null>(null);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingClearRef = useRef<number | null>(null);

  const enrichMessages = useCallback(
    async (raw: DMMessage[]): Promise<DMMessage[]> => {
      if (!raw.length) return raw;
      const ids = raw.map((m) => m.id);
      const { data: rx } = await supabase
        .from("dm_message_reactions")
        .select("message_id, emoji, user_id")
        .in("message_id", ids);
      const rMap = new Map<string, Map<string, { count: number; mine: boolean }>>();
      (rx ?? []).forEach((r: any) => {
        if (!rMap.has(r.message_id)) rMap.set(r.message_id, new Map());
        const m = rMap.get(r.message_id)!;
        const cur = m.get(r.emoji) ?? { count: 0, mine: false };
        cur.count += 1;
        if (r.user_id === user?.id) cur.mine = true;
        m.set(r.emoji, cur);
      });
      const out: DMMessage[] = await Promise.all(
        raw.map(async (m) => {
          let image_url: string | null = null;
          if (m.image_path) {
            const { data } = await supabase.storage.from("dm-attachments").createSignedUrl(m.image_path, 3600);
            image_url = data?.signedUrl ?? null;
          }
          return {
            ...m,
            reactions: Array.from(rMap.get(m.id)?.entries() ?? []).map(([emoji, v]) => ({ emoji, ...v })),
            image_url,
          };
        }),
      );
      return out;
    },
    [user?.id],
  );

  const loadThread = useCallback(async () => {
    if (!threadId || !user) return;
    const { data: t } = await supabase.from("dm_threads").select("*").eq("id", threadId).maybeSingle();
    if (!t) {
      setThread(null);
      setLoading(false);
      return;
    }
    const other = (t as any).user_a === user.id ? (t as any).user_b : (t as any).user_a;
    const [{ data: pr }, { data: pub }, { data: read }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", other).maybeSingle(),
      supabase.from("user_profiles_public").select("username").eq("user_id", other).maybeSingle(),
      supabase.from("dm_thread_reads").select("last_read_at").eq("thread_id", threadId).eq("user_id", other).maybeSingle(),
    ]);
    setThread({
      id: threadId,
      other_user_id: other,
      other_username: (pub as any)?.username ?? null,
      other_full_name: (pr as any)?.full_name ?? null,
      other_avatar_url: (pr as any)?.avatar_url ?? null,
      other_last_read_at: (read as any)?.last_read_at ?? null,
    });
  }, [threadId, user]);

  const loadMessages = useCallback(async () => {
    if (!threadId) return;
    const { data } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(300);
    const enriched = await enrichMessages((data ?? []) as DMMessage[]);
    setMessages(enriched);
    setLoading(false);
  }, [threadId, enrichMessages]);

  const markRead = useCallback(async () => {
    if (!threadId) return;
    await supabase.rpc("dm_mark_read", { _thread_id: threadId });
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    Promise.all([loadThread(), loadMessages()]).then(() => markRead());
    const ch = supabase
      .channel(`dm:${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_messages", filter: `thread_id=eq.${threadId}` },
        () => {
          loadMessages().then(() => markRead());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_message_reactions" },
        () => loadMessages(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_thread_reads", filter: `thread_id=eq.${threadId}` },
        () => loadThread(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_typing", filter: `thread_id=eq.${threadId}` },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row || row.user_id === user?.id) return;
          const ts = new Date(row.updated_at).getTime();
          if (Date.now() - ts < TYPING_TTL_MS) {
            setOtherTyping(true);
            if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
            typingClearRef.current = window.setTimeout(() => setOtherTyping(false), TYPING_TTL_MS);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    };
  }, [threadId, loadThread, loadMessages, markRead, user?.id]);

  const send = async (body: string, replyToId?: string) => {
    if (!user || !threadId || !body.trim()) return;
    const { error } = await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body: body.trim(),
      kind: "text",
      reply_to_id: replyToId ?? null,
    });
    if (error) throw error;
  };

  const sendImage = async (file: File, caption?: string) => {
    if (!user || !threadId) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${threadId}/${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("dm-attachments").upload(path, file, { upsert: false });
    if (upErr) throw upErr;
    const { error } = await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body: caption?.trim() || null,
      image_path: path,
      kind: "image",
    });
    if (error) throw error;
  };

  const react = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find((m) => m.id === messageId)?.reactions?.find((r) => r.emoji === emoji);
    if (existing?.mine) {
      await supabase.from("dm_message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
    } else {
      await supabase.from("dm_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const ping = useCallback(async () => {
    if (!user || !threadId) return;
    await supabase.from("dm_typing").upsert({ thread_id: threadId, user_id: user.id, updated_at: new Date().toISOString() });
  }, [user, threadId]);

  return { thread, messages, loading, otherTyping, send, sendImage, react, ping, markRead };
};
