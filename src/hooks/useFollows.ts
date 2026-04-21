import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const useFollow = (targetUserId: string | undefined) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setIsFollowing(false);
      return;
    }
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();
    setIsFollowing(!!data);
  }, [user, targetUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = async () => {
    if (!user || !targetUserId) {
      toast.error("Sign in to follow");
      return;
    }
    setLoading(true);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
      setIsFollowing(false);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
      if (error) toast.error(error.message);
      else setIsFollowing(true);
    }
    setLoading(false);
  };

  return { isFollowing, loading, toggle, canFollow: !!user && user.id !== targetUserId };
};
