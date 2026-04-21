import { Bell, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const kindLabel = (n: { kind: string; body: string | null }) => {
  if (n.body) return n.body;
  switch (n.kind) {
    case "follow": return "Started following you";
    case "mention": return "Mentioned you";
    case "reaction": return "Reacted to your message";
    case "reply": return "Replied to your message";
    case "payout": return "You received a payout";
    case "syndicate_full": return "Group ticket is full";
    case "feed_like": return "Liked your post";
    case "feed_comment": return "Commented on your post";
    default: return n.kind;
  }
};

const kindHref = (n: { kind: string; entity_type: string | null; entity_id: string | null; metadata: any }) => {
  const synSlug = n.metadata?.syndicate_slug;
  const synId = n.metadata?.syndicate_id;
  if (synSlug) return `/group/${synSlug}`;
  if (n.kind === "feed_like" || n.kind === "feed_comment") return `/feed`;
  if (n.kind === "follow") return `/notifications`;
  return synId ? `/syndicates` : `/notifications`;
};

export const NotificationBell = () => {
  const { notifications, unread, markAllRead, markRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.slice(0, 20).map((n) => (
                <li key={n.id}>
                  <Link
                    to={kindHref(n)}
                    onClick={() => !n.read_at && markRead(n.id)}
                    className={`block px-3 py-2.5 hover:bg-secondary ${!n.read_at ? "bg-primary/5" : ""}`}
                  >
                    <div className="text-sm text-foreground">{kindLabel(n)}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t border-border px-3 py-2 text-center">
          <Link to="/notifications" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};
