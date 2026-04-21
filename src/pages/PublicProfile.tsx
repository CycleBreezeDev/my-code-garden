import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "@/components/social/FollowButton";
import { BlockButton } from "@/components/social/BlockButton";
import { ReportDialog } from "@/components/social/ReportDialog";
import { MessageButton } from "@/components/messaging/MessageButton";
import { toast } from "sonner";

interface ProfileData {
  user_id: string;
  username: string;
  bio: string | null;
  country_code: string | null;
  followers_count: number;
  following_count: number;
  syndicates_count: number;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface FollowRow {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [country, setCountry] = useState("");
  const [followers, setFollowers] = useState<FollowRow[]>([]);
  const [following, setFollowing] = useState<FollowRow[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [reportOpen, setReportOpen] = useState(false);

  const isMe = user?.id === profile?.user_id;

  const load = async () => {
    setLoading(true);
    const { data: pub } = await supabase
      .from("user_profiles_public")
      .select("*")
      .eq("username", username!)
      .maybeSingle();
    if (!pub) { setProfile(null); setLoading(false); return; }
    const { data: pr } = await supabase.from("profiles").select("full_name, avatar_url, created_at").eq("user_id", pub.user_id).maybeSingle();
    setProfile({ ...(pub as any), ...(pr as any), user_id: pub.user_id });
    setBio(pub.bio ?? "");
    setEditUsername(pub.username);
    setCountry(pub.country_code ?? "");

    const [fwers, fwing] = await Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", pub.user_id).limit(50),
      supabase.from("follows").select("following_id").eq("follower_id", pub.user_id).limit(50),
    ]);
    const fwerIds = (fwers.data ?? []).map((r: any) => r.follower_id);
    const fwingIds = (fwing.data ?? []).map((r: any) => r.following_id);
    const allIds = Array.from(new Set([...fwerIds, ...fwingIds]));
    if (allIds.length) {
      const [{ data: profs }, { data: usn }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", allIds),
        supabase.from("user_profiles_public").select("user_id, username").in("user_id", allIds),
      ]);
      const pm = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const um = new Map((usn ?? []).map((p: any) => [p.user_id, p.username]));
      const build = (id: string): FollowRow => ({
        user_id: id,
        username: (um.get(id) as string) ?? null,
        full_name: (pm.get(id) as any)?.full_name ?? null,
        avatar_url: (pm.get(id) as any)?.avatar_url ?? null,
      });
      setFollowers(fwerIds.map(build));
      setFollowing(fwingIds.map(build));
    } else {
      setFollowers([]); setFollowing([]);
    }

    if (user?.id === pub.user_id) {
      const { data: sug } = await supabase.rpc("suggested_follows", { _limit: 12 });
      setSuggested(sug ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { if (username) load(); /* eslint-disable-next-line */ }, [username, user?.id]);

  const save = async () => {
    if (!user) return;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(editUsername)) {
      toast.error("Username: 3-24 chars, letters/numbers/underscore only");
      return;
    }
    const { error } = await supabase.from("user_profiles_public").update({
      username: editUsername, bio: bio.trim() || null, country_code: country.trim() || null,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    setEditing(false);
    if (editUsername !== username) window.location.href = `/u/${editUsername}`;
    else load();
  };

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="flex justify-center pt-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></div>;
  if (!profile) return <div className="min-h-screen bg-background"><Navbar /><div className="pt-32 text-center text-muted-foreground">Profile not found.</div></div>;

  const initial = (profile.full_name || profile.username).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Card className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  {editing ? (
                    <div className="space-y-2">
                      <Input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="username" maxLength={24} />
                      <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country code (e.g. NG)" maxLength={3} />
                      <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" maxLength={280} rows={2} />
                    </div>
                  ) : (
                    <>
                      <h1 className="font-heading text-2xl font-bold">{profile.full_name || profile.username}</h1>
                      <div className="text-sm text-muted-foreground">@{profile.username}{profile.country_code ? ` · ${profile.country_code}` : ""}</div>
                      {profile.bio && <p className="mt-2 max-w-md text-sm text-foreground">{profile.bio}</p>}
                      <div className="mt-3 flex gap-4 text-sm">
                        <span><b>{profile.followers_count}</b> <span className="text-muted-foreground">followers</span></span>
                        <span><b>{profile.following_count}</b> <span className="text-muted-foreground">following</span></span>
                        <span><b>{profile.syndicates_count}</b> <span className="text-muted-foreground">groups</span></span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {isMe ? (
                  editing ? (
                    <>
                      <Button onClick={save} size="sm"><Save className="mr-1 h-3.5 w-3.5" /> Save</Button>
                      <Button onClick={() => setEditing(false)} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
                    </>
                  ) : (
                    <Button onClick={() => setEditing(true)} variant="outline" size="sm"><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                  )
                ) : (
                  <>
                    <FollowButton userId={profile.user_id} />
                    <MessageButton userId={profile.user_id} />
                    <BlockButton userId={profile.user_id} />
                    <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>Report</Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <Tabs defaultValue={isMe ? "suggested" : "followers"} className="mt-6">
            <TabsList>
              <TabsTrigger value="followers">Followers ({followers.length})</TabsTrigger>
              <TabsTrigger value="following">Following ({following.length})</TabsTrigger>
              {isMe && <TabsTrigger value="suggested">Suggested</TabsTrigger>}
            </TabsList>
            <TabsContent value="followers">
              <UserList rows={followers} emptyText="No followers yet" />
            </TabsContent>
            <TabsContent value="following">
              <UserList rows={following} emptyText="Not following anyone yet" />
            </TabsContent>
            {isMe && (
              <TabsContent value="suggested">
                <UserList
                  rows={suggested.map((s: any) => ({ user_id: s.user_id, username: s.username, full_name: null, avatar_url: null }))}
                  emptyText="Join a group ticket to see suggestions"
                  hint={(s) => suggested.find((x: any) => x.user_id === s.user_id)?.mutual_syndicates ? `${suggested.find((x: any) => x.user_id === s.user_id).mutual_syndicates} shared group(s)` : ""}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="profile" targetId={profile.user_id} />
      <Footer />
    </div>
  );
};

const UserList = ({ rows, emptyText, hint }: { rows: FollowRow[]; emptyText: string; hint?: (r: FollowRow) => string }) => {
  if (!rows.length) return <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">{emptyText}</Card>;
  return (
    <Card className="mt-3 divide-y divide-border">
      {rows.map((r) => {
        const init = (r.full_name || r.username || "?").charAt(0).toUpperCase();
        return (
          <div key={r.user_id} className="flex items-center justify-between p-3">
            <Link to={r.username ? `/u/${r.username}` : "#"} className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9">
                {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                <AvatarFallback>{init}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-medium truncate">{r.full_name || r.username || "Member"}</div>
                <div className="text-xs text-muted-foreground">@{r.username ?? "—"}{hint ? ` · ${hint(r)}` : ""}</div>
              </div>
            </Link>
            <FollowButton userId={r.user_id} size="sm" variant="outline" />
          </div>
        );
      })}
    </Card>
  );
};

export default PublicProfile;
