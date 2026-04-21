import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNotifications } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { Check } from "lucide-react";

const labelFor = (n: any) => {
  if (n.body) return n.body;
  switch (n.kind) {
    case "follow": return "Started following you";
    case "mention": return "Mentioned you in a chat";
    case "reaction": return "Reacted to your message";
    case "reply": return "Replied to your message";
    case "payout": return "You received a payout";
    case "syndicate_full": return "Group ticket is now full";
    case "feed_like": return "Liked your post";
    case "feed_comment": return "Commented on your post";
    default: return n.kind;
  }
};

const hrefFor = (n: any) =>
  n.metadata?.syndicate_slug ? `/group/${n.metadata.syndicate_slug}` :
  (n.kind === "feed_like" || n.kind === "feed_comment") ? "/feed" : "/notifications";

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const { notifications, unread, loading, markAllRead, markRead } = useNotifications();
  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-heading text-3xl font-bold">Notifications</h1>
            {unread > 0 && <Button variant="outline" size="sm" onClick={markAllRead}><Check className="mr-1 h-3.5 w-3.5" /> Mark all read</Button>}
          </div>
          {loading ? null : notifications.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">You're all caught up 🎉</Card>
          ) : (
            <Card className="divide-y divide-border">
              {notifications.map((n) => (
                <Link
                  key={n.id} to={hrefFor(n)} onClick={() => !n.read_at && markRead(n.id)}
                  className={`block p-4 hover:bg-secondary ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  <div className="text-sm font-medium text-foreground">{labelFor(n)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Notifications;
