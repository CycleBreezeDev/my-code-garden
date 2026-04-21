import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Trophy, Ticket, Users, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { FeedItem } from "@/hooks/useFeed";

const kindIcon = (kind: string) => {
  switch (kind) {
    case "system_payout": return <Trophy className="h-4 w-4 text-primary" />;
    case "system_join": return <Users className="h-4 w-4 text-primary" />;
    case "system_ticket": return <Ticket className="h-4 w-4 text-primary" />;
    case "system_full": return <Flame className="h-4 w-4 text-primary" />;
    default: return null;
  }
};

export const FeedCard = ({ item, onLike }: { item: FeedItem; onLike: (id: string, liked: boolean) => void }) => {
  const initial = (item.full_name || item.username || "?").charAt(0).toUpperCase();
  const synSlug = item.metadata?.syndicate_slug;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Link to={item.username ? `/u/${item.username}` : "#"}>
          <Avatar className="h-10 w-10">
            {item.avatar_url && <AvatarImage src={item.avatar_url} />}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Link to={item.username ? `/u/${item.username}` : "#"} className="font-medium hover:underline">
              {item.full_name || item.username || "Member"}
            </Link>
            {item.username && <span className="text-xs text-muted-foreground">@{item.username}</span>}
            <span className="text-xs text-muted-foreground">· {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
            {kindIcon(item.kind)}
            <span>{item.body}</span>
          </div>
          {synSlug && (
            <Link to={`/group/${synSlug}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
              View group ticket →
            </Link>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => onLike(item.id, item.liked_by_me)}>
              <Heart className={`h-3.5 w-3.5 ${item.liked_by_me ? "fill-primary text-primary" : ""}`} />
              {item.likes_count}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" disabled>
              <MessageCircle className="h-3.5 w-3.5" />
              {item.comments_count}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
