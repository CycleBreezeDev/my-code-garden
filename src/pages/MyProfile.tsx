import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, Ticket, Users, MessageSquare, UsersRound, UserCheck, Compass, UserPlus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyProfile, type MyProfileData } from "@/hooks/useMyProfile";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { AvatarUploader } from "@/components/profile/AvatarUploader";
import { CoverUploader } from "@/components/profile/CoverUploader";
import { AccountSettingsCard } from "@/components/profile/AccountSettingsCard";
import { MyPostsTab } from "@/components/profile/MyPostsTab";
import { EmptyState } from "@/components/profile/EmptyState";
import MyTicketsSection from "@/components/MyTicketsSection";
import { FollowButton } from "@/components/social/FollowButton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatPrice, secondsUntil } from "@/lib/lotteryAssets";
import { Clock } from "lucide-react";
import { emitUsernameChange } from "@/lib/profileEvents";
import { toast } from "sonner";

const VALID_TABS = ["posts", "tickets", "groups", "followers", "following", "settings"] as const;
type ProfileTab = (typeof VALID_TABS)[number];

interface FollowRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const useFollowList = (
  meId: string | undefined,
  kind: "followers" | "following",
) => {
  const [rows, setRows] = useState<FollowRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meId) return;
    const load = async () => {
      setLoading(true);
      const col = kind === "followers" ? "follower_id" : "following_id";
      const filterCol = kind === "followers" ? "following_id" : "follower_id";
      const { data: edges } = await supabase
        .from("follows")
        .select(col)
        .eq(filterCol, meId)
        .limit(200);
      const ids = (edges ?? []).map((e: any) => e[col]).filter(Boolean) as string[];
      if (!ids.length) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [{ data: profs }, { data: usn }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", ids),
        supabase.from("user_profiles_public").select("user_id, username").in("user_id", ids),
      ]);
      const pm = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const um = new Map((usn ?? []).map((p: any) => [p.user_id, p.username]));
      setRows(
        ids.map((id) => ({
          user_id: id,
          username: (um.get(id) as string) ?? null,
          full_name: (pm.get(id) as any)?.full_name ?? null,
          avatar_url: (pm.get(id) as any)?.avatar_url ?? null,
        })),
      );
      setLoading(false);
    };
    load();
  }, [meId, kind]);

  return { rows, loading };
};

const UserList = ({
  rows,
  loading,
  empty,
}: {
  rows: FollowRow[];
  loading: boolean;
  empty: React.ReactNode;
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!rows.length) {
    return <>{empty}</>;
  }
  return (
    <Card className="divide-y divide-border">
      {rows.map((r) => {
        const init = (r.full_name || r.username || "?").charAt(0).toUpperCase();
        return (
          <div key={r.user_id} className="flex items-center justify-between p-3">
            <Link to={r.username ? `/u/${r.username}` : "#"} className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9">
                {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                <AvatarFallback>{init}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{r.full_name || r.username || "Member"}</div>
                <div className="text-xs text-muted-foreground">@{r.username ?? "—"}</div>
              </div>
            </Link>
            <FollowButton userId={r.user_id} size="sm" variant="outline" />
          </div>
        );
      })}
    </Card>
  );
};

const GroupsTab = ({ userId }: { userId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile-groups", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("syndicate_memberships")
        .select(
          "id, shares, amount_paid, created_at, syndicate:syndicates!inner(slug, name, total_shares, sold_shares, currency, draw:lottery_draws!inner(draw_date, lottery:lotteries!inner(name)))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!data?.length) {
    return (
      <EmptyState
        icon={Users}
        title="No groups yet"
        description="Pool funds with other players to chase bigger jackpots together. Browse open syndicates to join one in seconds."
        primary={{ label: "Browse groups", to: "/syndicates", icon: Compass }}
        secondary={{ label: "View lotteries", to: "/lotteries", icon: Ticket }}
      />
    );
  }
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <Link
          key={m.id}
          to={`/group/${m.syndicate.slug}`}
          className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{m.syndicate.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {m.syndicate.draw.lottery.name}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Ticket className="h-3 w-3" />
                  {m.shares} share{m.shares > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {m.syndicate.sold_shares}/{m.syndicate.total_shares}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.max(0, Math.floor(secondsUntil(m.syndicate.draw.draw_date) / 86400))}d
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="text-sm font-semibold text-primary">
                {formatPrice(Number(m.amount_paid), m.syndicate.currency)}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

const MyProfile = () => {
  const { user, refreshProfile } = useAuth();
  const { data, loading, refresh, updatePrivate } = useMyProfile();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as ProfileTab)
    : "posts";
  const setActiveTab = (next: ProfileTab) => {
    const p = new URLSearchParams(searchParams);
    if (next === "posts") p.delete("tab");
    else p.set("tab", next);
    setSearchParams(p, { replace: true });
  };

  const followers = useFollowList(user?.id, "followers");
  const following = useFollowList(user?.id, "following");

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pt-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Patch local + AuthContext (so the navbar avatar updates immediately).
  const handleAvatarChange = async (newUrl: string | null) => {
    const { error } = await updatePrivate({ avatar_url: newUrl });
    if (error) return;
    await refreshProfile?.();
  };
  const handleCoverChange = async (newUrl: string | null) => {
    await updatePrivate({ cover_url: newUrl });
  };

  const onEditSaved = async (next: Partial<MyProfileData>) => {
    // Detect a handle change BEFORE we refetch so we can confirm it to the
    // user with a clear "your @handle has propagated" toast.
    const previousUsername = data?.username ?? null;
    const usernameChanged =
      typeof next.username === "string" && next.username !== previousUsername;

    // 1) Re-pull our own combined record so the header / settings forms
    //    show the new handle without waiting on the next mount.
    await refresh();
    // 2) Reload the navbar profile (avatar/name) too — cheap, keeps the
    //    UserMenu in sync if the display name moved.
    await refreshProfile?.();
    // 3) Invalidate any cached query that includes the user's identity so
    //    /dashboard, /feed, /messages re-render with the new @handle next
    //    time the user navigates to them.
    if (user?.id && next.username) {
      queryClient.invalidateQueries({ queryKey: ["my-profile-groups", user.id] });
      queryClient.invalidateQueries({ queryKey: ["my-memberships", user.id] });
      // Broad invalidation — every feed/social hook keys off `user.id`.
      queryClient.invalidateQueries({ predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey.includes(user.id),
      });
      // 4) Ping the rest of the app (chat, member lists, DM threads) so
      //    they refetch their cached usernames.
      emitUsernameChange({ userId: user.id, username: next.username });
    }

    // 5) Confirm to the user that the change has propagated everywhere.
    if (usernameChanged && next.username) {
      toast.success(`@${next.username} is live`, {
        description: "Your new handle now shows on profile links, posts, and chats.",
      });
    } else {
      toast.success("Settings saved");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
          <ProfileHeader data={data} onEdit={() => setEditOpen(true)} />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProfileTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="posts" className="gap-1.5 text-xs sm:text-sm">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="gap-1.5 text-xs sm:text-sm">
                <Ticket className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tickets</span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Groups</span>
              </TabsTrigger>
              <TabsTrigger value="followers" className="gap-1.5 text-xs sm:text-sm">
                <UsersRound className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Followers</span>
              </TabsTrigger>
              <TabsTrigger value="following" className="gap-1.5 text-xs sm:text-sm">
                <UserCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Following</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="mt-6">
              <MyPostsTab username={data.username} />
            </TabsContent>
            <TabsContent value="tickets" className="mt-6">
              <MyTicketsSection />
            </TabsContent>
            <TabsContent value="groups" className="mt-6">
              <GroupsTab userId={data.user_id} />
            </TabsContent>
            <TabsContent value="followers" className="mt-6">
              <UserList
                rows={followers.rows}
                loading={followers.loading}
                empty={
                  <EmptyState
                    icon={UsersRound}
                    title="No followers yet"
                    description="Share posts, upload winning tickets, or invite friends so other players can find and follow you."
                    primary={{ label: "Share a post", to: "/feed", icon: Sparkles }}
                    secondary={{ label: "Find people", to: "/feed", icon: UserPlus }}
                  />
                }
              />
            </TabsContent>
            <TabsContent value="following" className="mt-6">
              <UserList
                rows={following.rows}
                loading={following.loading}
                empty={
                  <EmptyState
                    icon={UserCheck}
                    title="Not following anyone yet"
                    description="Follow other players to see their wins, group joins, and tips in your feed."
                    primary={{ label: "Discover players", to: "/feed", icon: Compass }}
                  />
                }
              />
            </TabsContent>
            <TabsContent value="settings" className="mt-6 space-y-6">
              <Card className="space-y-6 p-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Profile picture</h3>
                  <AvatarUploader
                    currentUrl={data.avatar_url}
                    fallback={(data.full_name || data.username || "?").charAt(0).toUpperCase()}
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Cover banner</h3>
                  <CoverUploader currentUrl={data.cover_url} onChange={handleCoverChange} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Identity</h3>
                  <p className="text-sm text-muted-foreground">
                    Display name, username, bio, country, and profile visibility.
                  </p>
                  <Button onClick={() => setEditOpen(true)} variant="outline" size="sm" className="mt-3">
                    Edit identity
                  </Button>
                </div>
              </Card>

              <AccountSettingsCard
                data={data}
                onDigestChange={(enabled) => {
                  // optimistic local sync — useMyProfile's row stays cached this way
                  refresh();
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        data={data}
        onSaved={onEditSaved}
      />
      <Footer />
    </div>
  );
};

export default MyProfile;
