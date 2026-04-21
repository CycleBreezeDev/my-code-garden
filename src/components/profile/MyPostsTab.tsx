import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FeedCard } from "@/components/social/FeedCard";
import type { FeedItem } from "@/hooks/useFeed";

interface MyPostsTabProps {
  /**
   * Current handle for the signed-in user. Passed in (rather than queried
   * locally) so a username change in Settings re-renders this tab and the
   * post-author links pick up the new `/u/<handle>` immediately.
   */
  username: string | null;
}

/**
 * Lists ONLY the signed-in user's own feed posts (system events + manual).
 * We can't reuse `user_feed` because it returns the follower-graph timeline,
 * so we hit `feed_posts` directly and stitch the same shape `FeedCard` expects.
 */
export const MyPostsTab = ({ username }: MyPostsTabProps) => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: posts } = await supabase
        .from("feed_posts")
        .select("id, user_id, kind, body, metadata, likes_count, comments_count, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const ids = (posts ?? []).map((p: any) => p.id);
      let likedSet = new Set<string>();
      if (ids.length) {
        const { data: likes } = await supabase
          .from("feed_likes")
          .select("post_id")
          .eq("user_id", user.id)
          .in("post_id", ids);
        likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
      }
      setItems(
        (posts ?? []).map(
          (p: any): FeedItem => ({
            id: p.id,
            user_id: p.user_id,
            kind: p.kind,
            body: p.body,
            metadata: p.metadata ?? {},
            likes_count: p.likes_count ?? 0,
            comments_count: p.comments_count ?? 0,
            created_at: p.created_at,
            username,
            full_name: profile?.full_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            liked_by_me: likedSet.has(p.id),
          }),
        ),
      );
      setLoading(false);
    };
    load();
    // `username` is in the dep list so a rename re-stamps every card's link.
  }, [user, profile, username]);

  const toggleLike = async (postId: string, liked: boolean) => {
    if (!user) return;
    if (liked) {
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("feed_likes").insert({ post_id: postId, user_id: user.id });
    }
    setItems((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !liked, likes_count: p.likes_count + (liked ? -1 : 1) }
          : p,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No posts yet — join a group or share a win to see it here.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeedCard key={item.id} item={item} onLike={toggleLike} />
      ))}
    </div>
  );
};
