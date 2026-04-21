import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { FollowButton } from "./FollowButton";

interface Member {
  user_id: string;
  shares: number;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export const SyndicateMembers = ({ syndicateId }: { syndicateId: string }) => {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    (async () => {
      const { data: mems } = await supabase
        .from("syndicate_memberships")
        .select("user_id, shares")
        .eq("syndicate_id", syndicateId);
      if (!mems?.length) { setMembers([]); return; }
      // Aggregate shares per user
      const agg = new Map<string, number>();
      mems.forEach((m: any) => agg.set(m.user_id, (agg.get(m.user_id) ?? 0) + m.shares));
      const ids = Array.from(agg.keys());
      const [{ data: profiles }, { data: usernames }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids),
        supabase.from("user_profiles_public").select("user_id, username").in("user_id", ids),
      ]);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const uMap = new Map((usernames ?? []).map((p: any) => [p.user_id, p.username]));
      setMembers(ids.map((id) => ({
        user_id: id,
        shares: agg.get(id) ?? 0,
        full_name: (pMap.get(id) as any)?.full_name ?? null,
        avatar_url: (pMap.get(id) as any)?.avatar_url ?? null,
        username: (uMap.get(id) as string) ?? null,
      })).sort((a, b) => b.shares - a.shares));
    })();
  }, [syndicateId]);

  if (!members.length) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">No members yet.</Card>;
  }

  return (
    <Card className="divide-y divide-border">
      {members.map((m) => {
        const initial = (m.full_name || m.username || "?").charAt(0).toUpperCase();
        return (
          <div key={m.user_id} className="flex items-center justify-between p-3">
            <Link to={m.username ? `/u/${m.username}` : "#"} className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10">
                {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{m.full_name || m.username || "Member"}</div>
                <div className="text-xs text-muted-foreground">@{m.username ?? "—"} · {m.shares} share{m.shares > 1 ? "s" : ""}</div>
              </div>
            </Link>
            <FollowButton userId={m.user_id} size="sm" variant="outline" />
          </div>
        );
      })}
    </Card>
  );
};
