import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Combined view of the signed-in user's identity:
 *  - private profile row (full_name, avatar_url, cover_url) from `profiles`
 *  - public/social row (username, bio, country, counts) from `user_profiles_public`
 *
 * The hook returns a single flat object so settings forms don't have to juggle
 * two records. Mutators write to whichever underlying table owns the field.
 */
export interface MyProfileData {
  user_id: string;
  // private
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string | null;
  // public
  username: string;
  bio: string | null;
  country_code: string | null;
  is_public: boolean;
  email_digest_enabled: boolean;
  followers_count: number;
  following_count: number;
  syndicates_count: number;
}

export const useMyProfile = () => {
  const { user, profile: ctxProfile } = useAuth();
  const [data, setData] = useState<MyProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: priv }, { data: pub }] = await Promise.all([
      // Cast: `cover_url` is added in the my_profile migration but the generated
      // types may lag a deploy behind. Safe because RLS still enforces ownership.
      (supabase.from("profiles") as any)
        .select("full_name, avatar_url, cover_url, created_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles_public")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const privAny = priv as any;
    setData({
      user_id: user.id,
      full_name: privAny?.full_name ?? null,
      avatar_url: privAny?.avatar_url ?? null,
      cover_url: privAny?.cover_url ?? null,
      created_at: (priv as any)?.created_at ?? null,
      username: (pub as any)?.username ?? "",
      bio: (pub as any)?.bio ?? null,
      country_code: (pub as any)?.country_code ?? null,
      is_public: (pub as any)?.is_public ?? true,
      email_digest_enabled: (pub as any)?.email_digest_enabled ?? false,
      followers_count: (pub as any)?.followers_count ?? 0,
      following_count: (pub as any)?.following_count ?? 0,
      syndicates_count: (pub as any)?.syndicates_count ?? 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Patch the private `profiles` row (full_name / avatar_url / cover_url).
  const updatePrivate = async (
    patch: Partial<Pick<MyProfileData, "full_name" | "avatar_url" | "cover_url">>,
  ) => {
    if (!user) return { error: new Error("Not signed in") };
    // Cast: `cover_url` is added in the my_profile migration but the generated
    // types may lag a deploy behind. Safe because RLS still enforces ownership.
    const { error } = await (supabase.from("profiles") as any)
      .update(patch)
      .eq("user_id", user.id);
    if (!error) {
      setData((d) => (d ? { ...d, ...patch } : d));
    }
    return { error };
  };

  // Patch the public `user_profiles_public` row.
  const updatePublic = async (
    patch: Partial<
      Pick<
        MyProfileData,
        | "username"
        | "bio"
        | "country_code"
        | "is_public"
        | "email_digest_enabled"
      >
    >,
  ) => {
    if (!user) return { error: new Error("Not signed in") };
    const { error } = await supabase
      .from("user_profiles_public")
      .update(patch)
      .eq("user_id", user.id);
    if (!error) {
      setData((d) => (d ? { ...d, ...patch } : d));
    }
    return { error };
  };

  return {
    data,
    loading,
    refresh: load,
    updatePrivate,
    updatePublic,
    ctxAvatar: ctxProfile?.avatar_url ?? null,
  };
};
