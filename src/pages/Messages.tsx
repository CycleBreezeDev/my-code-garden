import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useDMThreads } from "@/hooks/useDMThreads";
import { ThreadList } from "@/components/messaging/ThreadList";
import { MessageThread } from "@/components/messaging/MessageThread";
import { useAuth } from "@/contexts/AuthContext";

const MessagesShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-20">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        <h1 className="mb-4 font-heading text-2xl font-bold">Messages</h1>
        {children}
      </div>
    </main>
    <Footer />
  </div>
);

const FallbackCard = ({
  title,
  description,
  onRetry,
  retrying,
}: {
  title: string;
  description: string;
  onRetry: () => void;
  retrying?: boolean;
}) => (
  <Card className="flex h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <AlertTriangle className="h-6 w-6" />
    </div>
    <div className="space-y-1">
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
    <Button onClick={onRetry} disabled={retrying} className="gap-2">
      {retrying ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {retrying ? "Retrying…" : "Try again"}
    </Button>
  </Card>
);

const MessagesPage = () => {
  const { error: authError, retry: retryAuth, loading: authLoading } = useAuth();
  const { threads, loading, error: threadsError, refresh } = useDMThreads();
  const [params, setParams] = useSearchParams();
  const initial = params.get("t");
  const [activeId, setActiveId] = useState<string | null>(initial);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (initial && initial !== activeId) setActiveId(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // Default-select first thread on desktop when none chosen
  useEffect(() => {
    if (!activeId && threads.length > 0 && window.innerWidth >= 768) {
      setActiveId(threads[0].id);
    }
  }, [threads, activeId]);

  const select = (id: string) => {
    setActiveId(id);
    setParams({ t: id }, { replace: true });
  };

  // Auth failure → show retry card (don't render a blank page)
  if (authError) {
    return (
      <MessagesShell>
        <FallbackCard
          title="Couldn't verify your session"
          description={
            authError.message ||
            "We couldn't confirm you're signed in. Check your connection and try again."
          }
          onRetry={() => {
            setRetrying(true);
            retryAuth();
            // retryAuth flips loading; clear local retrying once auth resolves.
            setTimeout(() => setRetrying(false), 6000);
          }}
          retrying={retrying || authLoading}
        />
      </MessagesShell>
    );
  }

  // Threads/chat init failure → show retry card scoped to chat
  if (threadsError) {
    return (
      <MessagesShell>
        <FallbackCard
          title="Couldn't load your conversations"
          description={
            threadsError.message ||
            "Something went wrong while loading your inbox. Please try again."
          }
          onRetry={async () => {
            setRetrying(true);
            try {
              await refresh();
            } finally {
              setRetrying(false);
            }
          }}
          retrying={retrying}
        />
      </MessagesShell>
    );
  }

  return (
    <MessagesShell>
      <Card className="grid h-[70vh] grid-cols-1 overflow-hidden md:grid-cols-[320px_1fr]">
        {/* Thread list */}
        <aside className={`border-r border-border ${activeId ? "hidden md:block" : "block"}`}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ThreadList
              threads={threads}
              activeId={activeId}
              onSelect={select}
              emptyText="No conversations yet. Follow someone who follows you back, then tap Message on their profile."
            />
          )}
        </aside>

        {/* Active thread */}
        <section
          className={`min-h-0 ${activeId ? "block" : "hidden md:flex md:items-center md:justify-center"}`}
        >
          {activeId ? (
            <div className="flex h-full flex-col">
              <button
                className="border-b border-border px-4 py-2 text-left text-xs text-muted-foreground hover:bg-secondary md:hidden"
                onClick={() => {
                  setActiveId(null);
                  setParams({}, { replace: true });
                }}
              >
                ← Back to inbox
              </button>
              <div className="min-h-0 flex-1">
                <MessageThread threadId={activeId} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <MessageCircle className="h-10 w-10" />
              <div className="text-sm">Pick a conversation to start chatting.</div>
            </div>
          )}
        </section>
      </Card>
    </MessagesShell>
  );
};

export default MessagesPage;
