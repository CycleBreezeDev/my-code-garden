import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFeed } from "@/hooks/useFeed";
import { FeedCard } from "@/components/social/FeedCard";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const Feed = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, toggleLike } = useFeed();

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="mb-6 font-heading text-3xl font-bold">Activity feed</h1>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Follow people or join a group ticket — their activity will show here.
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((item) => <FeedCard key={item.id} item={item} onLike={toggleLike} />)}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Feed;
