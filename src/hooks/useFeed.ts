import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FeedItem {
  id: string;
  user_id: string;
  kind: string;
  body: string | null;
  metadata: Record<string, any>;
  likes_count: number;
  comments_count: number;
  created_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  liked_by_me: boolean;
}

export const useFeed = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) { setItems([]); setLoading(false); return; }
    const { data } = await supabase.rpc("user_feed", { _limit: 50, _before: null });
    setItems((data ?? []) as FeedItem[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("feed_likes").insert({ post_id: postId, user_id: user.id });
    }
    fetchAll();
  };

  return { items, loading, refetch: fetchAll, toggleLike };
};
