import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ExternalLink, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import type { MyProfileData } from "@/hooks/useMyProfile";

interface ProfileHeaderProps {
  data: MyProfileData;
  onEdit: () => void;
}

const formatJoined = (iso: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

/**
 * Twitter-style header: cover banner, overlapping avatar, identity row,
 * follower stats, and quick actions. Mobile collapses the avatar and wraps
 * the stats — see Tailwind responsive classes below.
 */
export const ProfileHeader = ({ data, onEdit }: ProfileHeaderProps) => {
  const initial = (data.full_name || data.username || "?").charAt(0).toUpperCase();
  const joined = formatJoined(data.created_at);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Cover banner */}
      <div className="relative h-40 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/30">
        {data.cover_url && (
          <img src={data.cover_url} alt="Profile cover" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        {/* Avatar (overlapping) + actions row */}
        <div className="flex flex-wrap items-end justify-between gap-3 -mt-12 sm:-mt-14">
          <Avatar className="h-24 w-24 border-4 border-card shadow-lg sm:h-28 sm:w-28">
            {data.avatar_url && <AvatarImage src={data.avatar_url} />}
            <AvatarFallback className="text-3xl">{initial}</AvatarFallback>
          </Avatar>
          <div className="flex flex-wrap gap-2 pt-12 sm:pt-14">
            {data.username && (
              <Link to={`/u/${data.username}`}>
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  View public profile
                </Button>
              </Link>
            )}
            <Button onClick={onEdit} size="sm">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit profile
            </Button>
          </div>
        </div>

        {/* Identity */}
        <div className="mt-4 space-y-1">
          <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {data.full_name || data.username}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {data.username && <span>@{data.username}</span>}
            {data.country_code && <span>· {data.country_code}</span>}
            {joined && <span>· Joined {joined}</span>}
          </div>
          {data.bio && (
            <p className="pt-2 text-sm text-foreground sm:max-w-2xl">{data.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <span>
            <b className="text-foreground">{data.following_count}</b>{" "}
            <span className="text-muted-foreground">Following</span>
          </span>
          <span>
            <b className="text-foreground">{data.followers_count}</b>{" "}
            <span className="text-muted-foreground">Followers</span>
          </span>
          <span>
            <b className="text-foreground">{data.syndicates_count}</b>{" "}
            <span className="text-muted-foreground">Groups</span>
          </span>
        </div>
      </div>
    </div>
  );
};
