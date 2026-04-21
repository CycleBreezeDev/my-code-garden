import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useFeed } from "@/hooks/useFeed";
import { FeedCard } from "@/components/social/FeedCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Rss } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useState } from "react";

const Feed = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, toggleLike, refetch } = useFeed();
  const [refreshing, setRefreshing] = useState(false);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const handleRetry = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="mb-6 font-heading text-3xl font-bold">Activity feed</h1>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Rss className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2 className="font-heading text-lg font-semibold text-foreground">Your feed is quiet</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Follow people or join a group ticket — their activity will show here.
                </p>
              </div>
              <Button onClick={handleRetry} disabled={refreshing} variant="outline" className="gap-2">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {refreshing ? "Refreshing…" : "Try again"}
              </Button>
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
